import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { normalizeTakeoffJobClaimResult } from "../src/lib/takeoff-job-claim"

const migrationsDirectory = fileURLToPath(
  new URL("../supabase/migrations", import.meta.url)
)
const customerId = "91919191-9191-4919-8919-919191919191"

test("atomic dispatch orders paid rush, paid standard, then free samples", async () => {
  const db = await createDatabase()
  const jobs = {
    rushOlder: "10101010-1010-4010-8010-101010101010",
    rushNewer: "20202020-2020-4020-8020-202020202020",
    standard: "30303030-3030-4030-8030-303030303030",
    sample: "40404040-4040-4040-8040-404040404040",
    exhausted: "50505050-5050-4050-8050-505050505050",
  }

  try {
    await db.exec(`
      insert into auth.users (id, email, raw_user_meta_data)
      values (
        '${customerId}',
        'queue-priority@example.test',
        '{"full_name":"Queue Priority"}'::jsonb
      );

      insert into public.takeoff_jobs (
        id,
        user_id,
        project_name,
        trades,
        status,
        priority,
        free_sample,
        input_file_count,
        input_page_count,
        attempt_count,
        max_attempts,
        queued_at,
        created_at
      )
      values
        (
          '${jobs.rushOlder}', '${customerId}', 'Older paid rush',
          array['fixture_device_counts']::text[], 'queued', 'rush', false,
          1, 1, 0, 3, now() - interval '20 minutes',
          now() - interval '20 minutes'
        ),
        (
          '${jobs.rushNewer}', '${customerId}', 'Newer paid rush',
          array['fixture_device_counts']::text[], 'queued', 'rush', false,
          1, 1, 0, 3, now() - interval '10 minutes',
          now() - interval '10 minutes'
        ),
        (
          '${jobs.standard}', '${customerId}', 'Paid standard',
          array['fixture_device_counts']::text[], 'queued', 'standard', false,
          1, 1, 0, 3, now() - interval '30 minutes',
          now() - interval '30 minutes'
        ),
        (
          '${jobs.sample}', '${customerId}', 'Free sample',
          array['fixture_device_counts']::text[], 'queued', 'standard', true,
          1, 1, 0, 3, now() - interval '40 minutes',
          now() - interval '40 minutes'
        ),
        (
          '${jobs.exhausted}', '${customerId}', 'Exhausted paid rush',
          array['fixture_device_counts']::text[], 'queued', 'rush', false,
          1, 1, 3, 3, now() - interval '50 minutes',
          now() - interval '50 minutes'
        );
    `)

    const first = await claimNext(db, "queue-worker-1")
    assert.equal(first.id, jobs.rushOlder)
    assert.equal(first.attempt_count, 1)
    assert.match(first.claim_token ?? "", /^[0-9a-f-]{36}$/i)

    const resumed = await claimNext(db, "queue-worker-1")
    assert.equal(resumed.id, first.id)
    assert.equal(resumed.claim_token, first.claim_token)
    assert.equal(resumed.attempt_count, 1)

    const acknowledged = await db.query<ClaimedJob>(
      `select
        (claimed).id::text as id,
        (claimed).claim_token::text as claim_token,
        (claimed).attempt_count
      from (
        select public.claim_takeoff_job($1::uuid, $2::text) as claimed
      ) as result`,
      [first.id, "queue-worker-1"]
    )
    assert.deepEqual(acknowledged.rows, [first])

    const second = await claimNext(db, "queue-worker-2")
    const third = await claimNext(db, "queue-worker-3")
    const fourth = await claimNext(db, "queue-worker-4")
    const empty = await claimNext(db, "queue-worker-5")

    assert.equal(second.id, jobs.rushNewer)
    assert.equal(third.id, jobs.standard)
    assert.equal(fourth.id, jobs.sample)
    assert.equal(empty.id, null)

    const events = await db.query<{ job_id: string; count: number }>(`
      select job_id::text, count(*)::int as count
      from public.takeoff_job_events
      where event_type = 'job_claimed'
        and job_id in (
          '${jobs.rushOlder}',
          '${jobs.rushNewer}',
          '${jobs.standard}',
          '${jobs.sample}'
        )
      group by job_id
      order by job_id;
    `)
    assert.equal(events.rows.length, 4)
    assert.ok(events.rows.every((row) => row.count === 1))

    const privileges = await db.query<{
      authenticated_execute: boolean
      service_execute: boolean
    }>(`
      select
        has_function_privilege(
          'authenticated',
          'public.claim_next_takeoff_job(text)',
          'execute'
        ) as authenticated_execute,
        has_function_privilege(
          'service_role',
          'public.claim_next_takeoff_job(text)',
          'execute'
        ) as service_execute;
    `)
    assert.deepEqual(privileges.rows, [
      { authenticated_execute: false, service_execute: true },
    ])
  } finally {
    await db.close()
  }
})

test("next-job route delegates selection and claim to the atomic RPC", async () => {
  const route = await readFile(
    fileURLToPath(
      new URL(
        "../src/app/api/internal/worker/takeoff/jobs/next/route.ts",
        import.meta.url
      )
    ),
    "utf8"
  )

  assert.match(route, /\.rpc\("claim_next_takeoff_job"/)
  assert.match(route, /p_worker_id:\s*worker\.workerId/)
  assert.match(route, /normalizeTakeoffJobClaimResult\(data\)/)
  assert.doesNotMatch(route, /\.order\("priority"/)
  assert.doesNotMatch(route, /\.from\("takeoff_jobs"\)/)

  const migration = await readFile(
    fileURLToPath(
      new URL(
        "../supabase/migrations/20260806224500_atomic_priority_takeoff_claim.sql",
        import.meta.url
      )
    ),
    "utf8"
  )
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /hashtext\(p_worker_id\)/)
})

test("claim acknowledgement rejects an empty composite as unavailable", async () => {
  const route = await readFile(
    fileURLToPath(
      new URL(
        "../src/app/api/internal/worker/takeoff/jobs/[id]/claim/route.ts",
        import.meta.url
      )
    ),
    "utf8"
  )

  assert.match(route, /normalizeTakeoffJobClaimResult\(data\)/)
  assert.match(route, /if \(!job\).*409/)
  assert.match(route, /NextResponse\.json\(\{ job \}\)/)
})

test("next-job response preserves an explicit null claim", () => {
  assert.equal(normalizeTakeoffJobClaimResult(null), null)
  assert.equal(normalizeTakeoffJobClaimResult(undefined), null)
})

test("next-job response normalizes an all-null PostgREST composite to no job", () => {
  const emptyComposite = {
    id: null,
    user_id: null,
    status: null,
    claim_token: null,
  }
  assert.equal(normalizeTakeoffJobClaimResult(emptyComposite), null)
})

test("next-job response rejects partial composites and invalid job IDs", () => {
  const emptyComposite = {
    id: null,
    user_id: null,
    status: null,
    claim_token: null,
  }
  assert.equal(
    normalizeTakeoffJobClaimResult({
      ...emptyComposite,
      status: "processing",
    }),
    null
  )
  assert.equal(
    normalizeTakeoffJobClaimResult({
      ...emptyComposite,
      id: "not-a-uuid",
      status: "processing",
    }),
    null
  )
  assert.equal(normalizeTakeoffJobClaimResult({}), null)
  assert.equal(normalizeTakeoffJobClaimResult([]), null)
  assert.equal(normalizeTakeoffJobClaimResult("not-a-job"), null)
  assert.equal(normalizeTakeoffJobClaimResult(42), null)
})

test("next-job response preserves a claimed job with a valid ID", () => {
  const claimedJob = {
    id: "60606060-6060-4060-8060-606060606060",
    user_id: customerId,
    status: "processing",
    claim_token: null,
  }
  assert.equal(normalizeTakeoffJobClaimResult(claimedJob), claimedJob)
})

type ClaimedJob = {
  id: string | null
  claim_token: string | null
  attempt_count: number | null
}

async function claimNext(db: PGlite, workerId: string) {
  const result = await db.query<ClaimedJob>(
    `select
      (claimed).id::text as id,
      (claimed).claim_token::text as claim_token,
      (claimed).attempt_count
    from (
      select public.claim_next_takeoff_job($1::text) as claimed
    ) as result`,
    [workerId]
  )
  assert.equal(result.rows.length, 1)
  return result.rows[0]
}

async function createDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz default now(),
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null
    );
    create function storage.foldername(name text)
    returns text[]
    language sql
    immutable
    as $$ select string_to_array(name, '/') $$;
  `)

  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort()
  for (const file of migrationFiles) {
    await db.exec(await readFile(`${migrationsDirectory}/${file}`, "utf8"))
  }
  return db
}
