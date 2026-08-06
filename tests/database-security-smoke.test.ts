import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

const migrationsDirectory = fileURLToPath(
  new URL("../supabase/migrations", import.meta.url)
)

const customerId = "11111111-1111-4111-8111-111111111111"
const otherCustomerId = "22222222-2222-4222-8222-222222222222"
const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const secondAdminId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const historicalJobId = "33333333-3333-4333-8333-333333333333"
const historicalFileId = "44444444-4444-4444-8444-444444444444"
const compatibleBackfillJobId = "17171717-1717-4717-8717-171717171717"
const archiveMigration = "20260729183933_secure_document_archive.sql"
const processorUsageMigration = "20260806120000_takeoff_processor_usage.sql"

async function createSupabaseDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } })

  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
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
    if (file === archiveMigration) {
      await db.exec(`
        insert into auth.users (id, email, raw_user_meta_data)
        values
          ('${customerId}', 'customer@example.test', '{"full_name":"Customer"}'),
          ('${otherCustomerId}', 'other@example.test', '{"full_name":"Other"}'),
          ('${adminId}', 'admin@example.test', '{"full_name":"Admin"}'),
          ('${secondAdminId}', 'approver@example.test', '{"full_name":"Approver"}');

        update public.profiles
        set role = 'admin'
        where id in ('${adminId}', '${secondAdminId}');

        insert into public.takeoff_jobs (
          id,
          user_id,
          project_name,
          trades,
          status,
          input_file_count,
          input_page_count,
          free_sample,
          created_at,
          updated_at
        )
        values (
          '${historicalJobId}',
          '${customerId}',
          'Archive smoke test',
          array['flooring_finishes']::text[],
          'ready',
          1,
          3,
          false,
          now() - interval '3 hours',
          now() - interval '3 hours'
        );

        insert into public.takeoff_files (
          id,
          job_id,
          user_id,
          bucket,
          storage_path,
          original_filename,
          file_role,
          mime_type,
          size_bytes,
          sha256,
          page_count,
          verified_at
        )
        values (
          '${historicalFileId}',
          '${historicalJobId}',
          '${customerId}',
          'takeoff-uploads',
          '${customerId}/${historicalJobId}/55555555-5555-4555-8555-555555555555.pdf',
          'plans.pdf',
          'input',
          'application/pdf',
          2048,
          repeat('a', 64),
          3,
          now() - interval '3 hours'
        );
      `)
    }

    if (file === processorUsageMigration) {
      await db.exec(`
        insert into public.takeoff_jobs (
          id,
          user_id,
          project_name,
          trades,
          status,
          input_file_count,
          input_page_count
        )
        values (
          '${compatibleBackfillJobId}',
          '${otherCustomerId}',
          'Compatible profile backfill',
          array['fixture_device_counts', 'cable_conduit_runs']::text[],
          'needs_review',
          1,
          2
        );
      `)
    }

    await db.exec(await readFile(`${migrationsDirectory}/${file}`, "utf8"))
  }

  return db
}

async function expectRejected(operation: () => Promise<unknown>) {
  let rejected = false
  try {
    await operation()
  } catch {
    rejected = true
  }
  assert.equal(rejected, true)
}

test("archive migration enforces tenant access, billing capacity, and deletion controls", async () => {
  const db = await createSupabaseDatabase()

  try {
    const registry = await db.query<{
      rls_enabled: boolean
      customer_table_select: boolean
      customer_safe_select: boolean
      customer_sensitive_select: boolean
      customer_insert: boolean
      service_direct_update: boolean
      upload_read_policy_removed: boolean
    }>(`
      select
        c.relrowsecurity as rls_enabled,
        has_table_privilege(
          'authenticated',
          'public.document_archives',
          'select'
        ) as customer_table_select,
        has_column_privilege(
          'authenticated',
          'public.document_archives',
          'id',
          'select'
        ) as customer_safe_select,
        has_column_privilege(
          'authenticated',
          'public.document_archives',
          'legal_hold_reason',
          'select'
        ) as customer_sensitive_select,
        has_table_privilege(
          'authenticated',
          'public.document_archives',
          'insert'
        ) as customer_insert,
        has_table_privilege(
          'service_role',
          'public.document_archives',
          'update'
        ) as service_direct_update,
        not exists (
          select 1
          from pg_policies
          where schemaname = 'storage'
            and tablename = 'objects'
            and policyname = 'takeoff uploads owner read'
        ) as upload_read_policy_removed
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'document_archives';
    `)

    assert.deepEqual(registry.rows[0], {
      rls_enabled: true,
      customer_table_select: false,
      customer_safe_select: true,
      customer_sensitive_select: false,
      customer_insert: false,
      service_direct_update: false,
      upload_read_policy_removed: true,
    })

    const processorUsageRegistry = await db.query<{
      rls_enabled: boolean
      customer_select: boolean
      customer_insert: boolean
      service_select: boolean
      service_insert: boolean
      customer_policy_count: number
    }>(`
      select
        c.relrowsecurity as rls_enabled,
        has_table_privilege(
          'authenticated',
          'public.takeoff_processor_usage',
          'select'
        ) as customer_select,
        has_table_privilege(
          'authenticated',
          'public.takeoff_processor_usage',
          'insert'
        ) as customer_insert,
        has_table_privilege(
          'service_role',
          'public.takeoff_processor_usage',
          'select'
        ) as service_select,
        has_table_privilege(
          'service_role',
          'public.takeoff_processor_usage',
          'insert'
        ) as service_insert,
        (
          select count(*)::int
          from pg_policies
          where schemaname = 'public'
            and tablename = 'takeoff_processor_usage'
            and roles::text like '%authenticated%'
        ) as customer_policy_count
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'takeoff_processor_usage';
    `)

    assert.deepEqual(processorUsageRegistry.rows[0], {
      rls_enabled: true,
      customer_select: false,
      customer_insert: false,
      service_select: true,
      service_insert: true,
      customer_policy_count: 0,
    })

    const profileBackfill = await db.query<{
      id: string
      processor_version: string | null
    }>(`
      select id, processor_version
      from public.takeoff_jobs
      where id in ('${compatibleBackfillJobId}', '${historicalJobId}')
      order by id;
    `)
    const profilesByJob = new Map(
      profileBackfill.rows.map((row) => [row.id, row.processor_version])
    )
    assert.equal(
      profilesByJob.get(compatibleBackfillJobId),
      "analyze-building-drawings@2026-08-06"
    )
    assert.equal(profilesByJob.get(historicalJobId), null)

    const processorUsageClaim = "16161616-1616-4616-8616-161616161616"
    await db.exec(`
      insert into public.takeoff_processor_usage (
        job_id,
        claim_token,
        worker_id,
        schema_version,
        provider,
        model,
        pricing_as_of,
        currency,
        usage_turns,
        input_tokens,
        uncached_input_tokens,
        cached_input_tokens,
        cache_write_tokens,
        output_tokens,
        reasoning_output_tokens,
        estimated_cost_usd,
        estimated_cost_usd_upper_bound,
        estimated_cost_usd_all_input_uncached,
        estimated_cost_usd_all_input_uncached_upper_bound,
        long_context_pricing_may_apply,
        rate_snapshot_usd_per_million
      )
      values (
        '${historicalJobId}',
        '${processorUsageClaim}',
        'worker-smoke',
        1,
        'openai',
        'gpt-5.6-sol',
        '2026-08-06',
        'USD',
        1,
        100000,
        70000,
        20000,
        10000,
        5000,
        1000,
        0.5725,
        null,
        0.65,
        null,
        false,
        '{"input":5,"cached_input":0.5,"cache_write":6.25,"output":30}'::jsonb
      );
    `)
    const storedProcessorUsage = await db.query<{
      all_input_uncached_cost: number
      all_input_uncached_upper_is_null: boolean
    }>(`
      select
        estimated_cost_usd_all_input_uncached::float8 as all_input_uncached_cost,
        estimated_cost_usd_all_input_uncached_upper_bound is null as all_input_uncached_upper_is_null
      from public.takeoff_processor_usage
      where claim_token = '${processorUsageClaim}';
    `)
    assert.deepEqual(storedProcessorUsage.rows, [
      {
        all_input_uncached_cost: 0.65,
        all_input_uncached_upper_is_null: true,
      },
    ])
    await expectRejected(() =>
      db.exec(`
        update public.takeoff_processor_usage
        set
          long_context_pricing_may_apply = true,
          estimated_cost_usd_upper_bound = 1.25
        where claim_token = '${processorUsageClaim}';
      `)
    )

    const resultBucket = await db.query<{ file_size_limit: number }>(`
      select file_size_limit
      from storage.buckets
      where id = 'takeoff-results';
    `)
    assert.deepEqual(resultBucket.rows, [{ file_size_limit: 262_144_000 }])

    const backfill = await db.query<{
      status: string
      integrity_status: string
    }>(`
      select status, integrity_status
      from public.document_archives
      where job_id = '${historicalJobId}';
    `)
    assert.deepEqual(backfill.rows, [
      { status: "retained", integrity_status: "verified" },
    ])

    await db.exec(`
      set role authenticated;
      select set_config(
        'request.jwt.claim.sub',
        '${customerId}',
        false
      );
    `)
    const ownerRows = await db.query(`
      select id
      from public.document_archives
      where job_id = '${historicalJobId}';
    `)
    assert.equal(ownerRows.rows.length, 1)

    await db.exec(`
      select set_config(
        'request.jwt.claim.sub',
        '${otherCustomerId}',
        false
      );
    `)
    const otherRows = await db.query(`
      select id
      from public.document_archives
      where job_id = '${historicalJobId}';
    `)
    assert.equal(otherRows.rows.length, 0)
    await expectRejected(() =>
      db.exec(`
        update public.document_archives
        set integrity_status = 'missing'
        where job_id = '${historicalJobId}';
      `)
    )
    await db.exec("reset role;")

    const quotaJobId = "66666666-6666-4666-8666-666666666666"
    const paidJobId = "77777777-7777-4777-8777-777777777777"
    const paidFileId = "88888888-8888-4888-8888-888888888888"
    const paidToken = "99999999-9999-4999-8999-999999999999"

    await db.exec(`
      insert into public.takeoff_jobs (
        id,
        user_id,
        project_name,
        trades,
        status,
        input_file_count,
        input_page_count
      )
      values
        (
          '${quotaJobId}',
          '${otherCustomerId}',
          'Free archive quota',
          array['flooring_finishes']::text[],
          'ready',
          1,
          1
        ),
        (
          '${paidJobId}',
          '${otherCustomerId}',
          'Paid archive attempt',
          array['flooring_finishes']::text[],
          'awaiting_upload',
          1,
          1
        );

      update public.takeoff_jobs
      set
        verification_token = '${paidToken}',
        verification_started_at = now()
      where id = '${paidJobId}';

      insert into public.takeoff_files (
        id,
        job_id,
        user_id,
        bucket,
        storage_path,
        original_filename,
        file_role,
        mime_type,
        size_bytes,
        sha256,
        page_count,
        verified_at
      )
      values (
        '${paidFileId}',
        '${paidJobId}',
        '${otherCustomerId}',
        'takeoff-uploads',
        '${otherCustomerId}/${paidJobId}/source.pdf',
        'paid-plan.pdf',
        'input',
        'application/pdf',
        4096,
        repeat('c', 64),
        1,
        now()
      );

      insert into public.document_archives (
        job_id,
        user_id,
        bucket,
        storage_path,
        original_filename,
        mime_type,
        size_bytes,
        sha256,
        page_count
      )
      values (
        '${quotaJobId}',
        '${otherCustomerId}',
        'takeoff-uploads',
        '${otherCustomerId}/${quotaJobId}/source.pdf',
        'quota-plan.pdf',
        'application/pdf',
        536870912,
        repeat('b', 64),
        1
      );
    `)

    const registerPaidArchive = () =>
      db.query(
        `select public.register_verified_document_archive(
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          4096,
          $5::text,
          1
        )`,
        [
          paidJobId,
          otherCustomerId,
          paidToken,
          paidFileId,
          "c".repeat(64),
        ]
      )

    await expectRejected(registerPaidArchive)

    const billingOrderId = "12121212-1212-4212-8212-121212121212"
    await db.exec(`
      insert into public.billing_orders (
        id,
        user_id,
        sku,
        kind,
        status,
        credits,
        amount,
        currency,
        stripe_price_id,
        fulfilled_at
      )
      values (
        '${billingOrderId}',
        '${otherCustomerId}',
        'credits-100',
        'credit_pack',
        'fulfilled',
        100,
        1000,
        'usd',
        'price_smoke',
        now()
      );

      insert into public.stripe_credit_fulfillments (
        source_type,
        source_id,
        user_id,
        billing_order_id,
        status,
        credits,
        fulfilled_at
      )
      values (
        'stripe_checkout_session',
        'cs_smoke',
        '${otherCustomerId}',
        '${billingOrderId}',
        'fulfilled',
        100,
        now()
      );
    `)
    await registerPaidArchive()

    const freshArchive = await db.query<{ id: string }>(`
      select id
      from public.document_archives
      where job_id = '${paidJobId}';
    `)
    const freshArchiveId = freshArchive.rows[0]?.id
    assert.ok(freshArchiveId)
    await db.query(
      `select public.admin_transition_document_archive(
        $1::uuid,
        $2::uuid,
        $3::text,
        'request_deletion',
        'Fresh signed upload replay test'
      )`,
      [freshArchiveId, adminId, "admin@example.test"]
    )
    await expectRejected(() =>
      db.query(
        `select public.begin_document_archive_deletion(
          $1::uuid,
          $2::uuid,
          $3::text,
          'Signed upload capability must expire first'
        )`,
        [freshArchiveId, secondAdminId, "approver@example.test"]
      )
    )

    const refundedJobId = "13131313-1313-4313-8313-131313131313"
    const refundedFileId = "14141414-1414-4414-8414-141414141414"
    const refundedToken = "15151515-1515-4515-8515-151515151515"
    await db.exec(`
      update public.billing_orders
      set status = 'refunded'
      where id = '${billingOrderId}';

      update public.stripe_credit_fulfillments
      set status = 'refunded', refunded_at = now()
      where billing_order_id = '${billingOrderId}';

      insert into public.takeoff_jobs (
        id,
        user_id,
        project_name,
        trades,
        status,
        input_file_count,
        input_page_count,
        verification_token,
        verification_started_at
      )
      values (
        '${refundedJobId}',
        '${otherCustomerId}',
        'Refunded archive attempt',
        array['flooring_finishes']::text[],
        'awaiting_upload',
        1,
        1,
        '${refundedToken}',
        now()
      );

      insert into public.takeoff_files (
        id,
        job_id,
        user_id,
        bucket,
        storage_path,
        original_filename,
        file_role,
        mime_type,
        size_bytes,
        sha256,
        page_count,
        verified_at
      )
      values (
        '${refundedFileId}',
        '${refundedJobId}',
        '${otherCustomerId}',
        'takeoff-uploads',
        '${otherCustomerId}/${refundedJobId}/source.pdf',
        'refunded-plan.pdf',
        'input',
        'application/pdf',
        4096,
        repeat('d', 64),
        1,
        now()
      );
    `)
    await expectRejected(() =>
      db.query(
        `select public.register_verified_document_archive(
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          4096,
          $5::text,
          1
        )`,
        [
          refundedJobId,
          otherCustomerId,
          refundedToken,
          refundedFileId,
          "d".repeat(64),
        ]
      )
    )

    const archiveResult = await db.query<{ id: string }>(`
      select id
      from public.document_archives
      where job_id = '${historicalJobId}';
    `)
    const archiveId = archiveResult.rows[0]?.id
    assert.ok(archiveId)

    await db.query(
      `select public.admin_transition_document_archive(
        $1::uuid,
        $2::uuid,
        $3::text,
        'place_hold',
        'Preserve for contractual dispute'
      )`,
      [archiveId, adminId, "admin@example.test"]
    )
    await expectRejected(() =>
      db.query(
        `select public.admin_transition_document_archive(
          $1::uuid,
          $2::uuid,
          $3::text,
          'request_deletion',
          'Customer erasure request'
        )`,
        [archiveId, adminId, "admin@example.test"]
      )
    )
    await db.query(
      `select public.admin_transition_document_archive(
        $1::uuid,
        $2::uuid,
        $3::text,
        'release_hold',
        'Contractual dispute is closed'
      )`,
      [archiveId, adminId, "admin@example.test"]
    )
    await db.query(
      `select public.admin_transition_document_archive(
        $1::uuid,
        $2::uuid,
        $3::text,
        'request_deletion',
        'Customer erasure request'
      )`,
      [archiveId, adminId, "admin@example.test"]
    )

    await expectRejected(() =>
      db.query(
        `select public.begin_document_archive_deletion(
          $1::uuid,
          $2::uuid,
          $3::text,
          'Requesting administrator cannot self-approve'
        )`,
        [archiveId, adminId, "admin@example.test"]
      )
    )

    const deletionClaim = await db.query<{ token: string }>(
      `select (public.begin_document_archive_deletion(
        $1::uuid,
        $2::uuid,
        $3::text,
        'Second administrator approved exact-path removal'
      )).deletion_token as token`,
      [archiveId, secondAdminId, "approver@example.test"]
    )
    const deletionToken = deletionClaim.rows[0]?.token
    assert.ok(deletionToken)

    await expectRejected(() =>
      db.query(
        `select public.admin_transition_document_archive(
          $1::uuid,
          $2::uuid,
          $3::text,
          'cancel_deletion',
          'Attempted cancellation during deletion'
        )`,
        [archiveId, adminId, "admin@example.test"]
      )
    )

    await db.query(
      `select public.finalize_document_archive_deletion(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::text,
        'Verified object erasure',
        now()
      )`,
      [
        archiveId,
        deletionToken,
        secondAdminId,
        "approver@example.test",
      ]
    )

    const tombstone = await db.query<{
      status: string
      integrity_status: string
      deleted: boolean
    }>(`
      select
        status,
        integrity_status,
        deleted_at is not null as deleted
      from public.document_archives
      where id = '${archiveId}';
    `)
    assert.deepEqual(tombstone.rows, [
      {
        status: "deleted",
        integrity_status: "missing",
        deleted: true,
      },
    ])
    await expectRejected(() =>
      db.exec(`
        delete from public.document_archives
        where id = '${archiveId}';
      `)
    )

    const auditCount = await db.query<{ count: number }>(`
      select count(*)::int as count
      from public.admin_audit_log
      where target_type = 'document_archive'
        and target_id = '${archiveId}';
    `)
    assert.equal(auditCount.rows[0]?.count, 5)
  } finally {
    await db.close()
  }
})
