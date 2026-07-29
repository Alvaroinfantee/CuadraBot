import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { requiredServiceChecks } from "../src/lib/admin-analytics"
import {
  partitionAbandonedUploadObjects,
  partitionArchivedObjects,
  partitionRetentionObjects,
} from "../src/lib/document-archive"
import { sanitizePdfFilename } from "../src/lib/http"

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260729183933_secure_document_archive.sql",
    import.meta.url
  ),
  "utf8"
)

test("source archives have a private tenant registry and immutable tombstones", () => {
  assert.match(migration, /create table public\.document_archives/)
  assert.match(migration, /sha256 text not null/)
  assert.match(migration, /constraint document_archives_job_unique unique \(job_id\)/)
  assert.match(migration, /alter table public\.document_archives enable row level security/)
  assert.match(
    migration,
    /create policy "customers read own archived documents"[\s\S]*auth\.uid\(\)\) = user_id/
  )
  assert.match(
    migration,
    /revoke all on table public\.document_archives\s+from public, anon, authenticated/
  )
  assert.match(
    migration,
    /drop policy if exists "takeoff uploads owner read" on storage\.objects/
  )
  assert.match(
    migration,
    /grant select \([\s\S]*original_filename[\s\S]*deleted_at[\s\S]*\) on table public\.document_archives to authenticated/
  )
  assert.doesNotMatch(
    migration,
    /grant select \([\s\S]*legal_hold_reason[\s\S]*\) on table public\.document_archives to authenticated/
  )
  assert.doesNotMatch(
    migration,
    /grant select, insert, update, delete on table public\.document_archives/
  )
  assert.match(
    migration,
    /Document archive rows are permanent tombstones and cannot be deleted/
  )
  assert.match(
    migration,
    /insert into public\.document_archives[\s\S]*job\.free_sample is false[\s\S]*on conflict \(job_id\) do nothing/
  )
  assert.match(
    migration,
    /document-archive:historical-backfill-gaps/
  )
  assert.match(
    migration,
    /where job\.input_page_count > 0\s+and job\.status not in \('draft', 'awaiting_upload'\)/
  )
  assert.match(migration, /536870912::bigint -- 512 MiB/)
  assert.match(migration, /21474836480::bigint -- 20 GiB/)
  assert.match(
    migration,
    /subscription\.status in \('trialing', 'active', 'past_due'\)/
  )
  assert.match(
    migration,
    /billing_order\.kind = 'credit_pack'[\s\S]*billing_order\.status = 'fulfilled'/
  )
  assert.match(
    migration,
    /fulfillment\.status = 'fulfilled'/
  )
})

test("abandoned-upload cleanup preserves verified historical gaps", () => {
  const objects = [
    {
      id: "unverified",
      job_id: "draft-job",
      file_role: "input",
      bucket: "takeoff-uploads",
      storage_path: "user/draft-job/upload.pdf",
      verified_at: null,
    },
    {
      id: "historical",
      job_id: "historical-job",
      file_role: "input",
      bucket: "takeoff-uploads",
      storage_path: "user/historical-job/source.pdf",
      verified_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "sample",
      job_id: "sample-job",
      file_role: "input",
      bucket: "takeoff-uploads",
      storage_path: "user/sample-job/sample.pdf",
      verified_at: "2026-01-01T00:00:00.000Z",
    },
  ]
  const partition = partitionAbandonedUploadObjects(objects, [
    {
      job_id: "sample-job",
      bucket: "takeoff-uploads",
      storage_path: "user/sample-job/original.pdf",
      status: "retained",
    },
  ])

  assert.deepEqual(
    partition.protectedObjects.map((object) => object.id),
    ["historical"]
  )
  assert.deepEqual(
    partition.deletableObjects.map((object) => object.id),
    ["unverified", "sample"]
  )
})

test("archive lifecycle and object integrity are independent", () => {
  assert.match(
    migration,
    /status in \(\s*'retained',\s*'deletion_requested',\s*'deleting',\s*'deleted'/
  )
  assert.match(
    migration,
    /integrity_status in \('verified', 'missing'\)/
  )
  assert.match(migration, /legal_hold_at timestamptz/)
  assert.match(migration, /deletion_requested_at timestamptz/)

  const integrityRoute = readFileSync(
    new URL(
      "../src/app/api/internal/cron/archive-integrity/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(
    integrityRoute,
    /"record_document_archive_presence"[\s\S]*p_present: false/
  )
  assert.match(
    integrityRoute,
    /"record_document_archive_presence"[\s\S]*p_present: true/
  )
  assert.match(integrityRoute, /p_checked_at: checkedAt/)
  assert.match(integrityRoute, /const CHECK_CONCURRENCY = 10/)
  assert.match(integrityRoute, /Promise\.all/)
  assert.match(integrityRoute, /"get_document_archive_metrics"/)
  assert.match(integrityRoute, /globalMissing \|\| overdueVerification/)
  assert.match(
    migration,
    /document_archives_check_attempt_idx[\s\S]*where status <> 'deleted'/
  )
  assert.doesNotMatch(integrityRoute, /\.update\(\{\s*status: "missing"/)
  assert.doesNotMatch(integrityRoute, /\.update\(\{\s*status: "retained"/)
  assert.match(
    migration,
    /revoke all on table public\.document_archives from service_role;\s*grant select on table public\.document_archives to service_role/
  )
})

test("only non-archived working copies and outputs are retention eligible", () => {
  const objects = [
    {
      id: "source",
      bucket: "takeoff-uploads",
      storage_path: "user/job/source.pdf",
    },
    {
      id: "sample",
      bucket: "takeoff-uploads",
      storage_path: "user/job/sample.pdf",
    },
    {
      id: "result",
      bucket: "takeoff-results",
      storage_path: "user/job/results/result.xlsx",
    },
  ]
  const partition = partitionArchivedObjects(objects, [
    {
      bucket: "takeoff-uploads",
      storage_path: "user/job/source.pdf",
      status: "retained",
    },
  ])
  assert.deepEqual(
    partition.protectedObjects.map((object) => object.id),
    ["source"]
  )
  assert.deepEqual(
    partition.deletableObjects.map((object) => object.id),
    ["sample", "result"]
  )

  const afterDeletion = partitionArchivedObjects(objects, [
    {
      bucket: "takeoff-uploads",
      storage_path: "user/job/source.pdf",
      status: "deleted",
    },
  ])
  assert.equal(afterDeletion.protectedObjects.length, 0)
})

test("retention protects unresolved historical inputs and only removes a registered sample copy", () => {
  const objects = [
    {
      id: "historical-source",
      job_id: "legacy-job",
      file_role: "input",
      bucket: "takeoff-uploads",
      storage_path: "user/legacy-job/source.pdf",
    },
    {
      id: "registered-source",
      job_id: "sample-job",
      file_role: "input",
      bucket: "takeoff-uploads",
      storage_path: "user/sample-job/original.pdf",
    },
    {
      id: "sample-copy",
      job_id: "sample-job",
      file_role: "input",
      bucket: "takeoff-uploads",
      storage_path: "user/sample-job/sample.pdf",
    },
  ]
  const partition = partitionRetentionObjects(objects, [
    {
      job_id: "sample-job",
      bucket: "takeoff-uploads",
      storage_path: "user/sample-job/original.pdf",
      status: "retained",
    },
  ])

  assert.deepEqual(
    partition.protectedObjects.map((object) => object.id),
    ["historical-source", "registered-source"]
  )
  assert.deepEqual(
    partition.deletableObjects.map((object) => object.id),
    ["sample-copy"]
  )
})

test("verification archives original bytes before preparing a free-sample copy", () => {
  const submitRoute = readFileSync(
    new URL(
      "../src/app/api/takeoff/jobs/[id]/submit/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  const originalHash = submitRoute.indexOf("const originalSha256")
  const register = submitRoute.indexOf('"register_verified_document_archive"')
  const sampleUpload = submitRoute.indexOf(".upload(verifiedStoragePath")
  const finalize = submitRoute.indexOf('"finalize_takeoff_verification"')

  assert.ok(originalHash >= 0)
  assert.ok(register > originalHash)
  assert.ok(sampleUpload > register)
  assert.ok(finalize > sampleUpload)
  assert.doesNotMatch(submitRoute, /\.remove\(\[originalStoragePath\]\)/)
  assert.match(
    submitRoute,
    /document-archive-capacity:\$\{user\.id\}/
  )
})

test("abandoned-job cleanup always removes an orphan sample copy", () => {
  const reconciler = readFileSync(
    new URL(
      "../src/app/api/internal/cron/reconcile/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(
    reconciler,
    /for \(const job of cleanupJobs \?\? \[\]\) \{[\s\S]*const samplePath = `\$\{job\.user_id\}\/\$\{job\.id\}\/sample\.pdf`[\s\S]*paths\.add\(samplePath\)/
  )
  assert.doesNotMatch(
    reconciler,
    /if \(uploadRows\.some\(\(row\) => row\.job_id === job\.id\)\) continue/
  )
  assert.match(
    reconciler,
    /\.is\("upload_cleanup_completed_at", null\)/
  )
  assert.match(
    reconciler,
    /upload_cleanup_completed_at: new Date\(\)\.toISOString\(\)/
  )
  assert.match(reconciler, /protectedPaths\.has\(storageObjectKey\(/)
  assert.match(
    migration,
    /takeoff_jobs_upload_cleanup_pending_idx[\s\S]*upload_cleanup_completed_at is null/
  )
})

test("archive integrity is a required admin health reporter", () => {
  assert.equal(
    requiredServiceChecks.some(
      (check) =>
        check.serviceName === "cuadrabot-archive" &&
        check.checkName === "source-integrity"
    ),
    true
  )
})

test("source downloads enforce ownership and audited admin access", () => {
  const customerRoute = readFileSync(
    new URL(
      "../src/app/api/takeoff/jobs/[id]/source/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(customerRoute, /\.eq\("user_id", user\.id\)/)
  assert.match(customerRoute, /createSignedUrl\(archive\.storage_path, 5 \* 60/)
  assert.match(customerRoute, /archive\.status === "deletion_requested"/)
  assert.match(customerRoute, /archive\.status === "deleting"/)
  assert.match(customerRoute, /"Cache-Control", "private, no-store, max-age=0"/)
  assert.match(customerRoute, /"Referrer-Policy", "no-referrer"/)

  const adminRoute = readFileSync(
    new URL(
      "../src/app/api/admin/documents/[id]/download/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  const audit = adminRoute.indexOf('"document_archive.downloaded"')
  const redirect = adminRoute.indexOf("NextResponse.redirect")
  assert.ok(audit >= 0 && redirect > audit)
  assert.match(
    adminRoute,
    /download was blocked because the audit entry could not be recorded/
  )

  const legacyAdminRoute = readFileSync(
    new URL(
      "../src/app/api/admin/takeoff/jobs/[id]/download/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(legacyAdminRoute, /file\.file_role === "input"/)
})

test("admin hold and deletion requests are atomic with their audit record", () => {
  assert.match(
    migration,
    /create or replace function public\.admin_transition_document_archive/
  )
  assert.match(
    migration,
    /p_action not in \(\s*'place_hold',\s*'release_hold',\s*'request_deletion',\s*'cancel_deletion'/
  )
  assert.match(
    migration,
    /insert into public\.admin_audit_log[\s\S]*audit_action[\s\S]*return updated_archive/
  )
  assert.match(
    migration,
    /A legal hold blocks source-plan deletion/
  )
  assert.match(
    migration,
    /create or replace function public\.finalize_document_archive_deletion[\s\S]*Recent verified absence[\s\S]*document_archive\.deletion_finalized/
  )
  assert.match(
    migration,
    /A second active administrator must approve source-plan deletion/
  )
  assert.match(
    migration,
    /revoke execute on function public\.admin_transition_document_archive[\s\S]*from public, anon, authenticated/
  )

  const actions = readFileSync(
    new URL("../src/app/admin/document-actions.ts", import.meta.url),
    "utf8"
  )
  const claim = actions.indexOf('"begin_document_archive_deletion"')
  const remove = actions.indexOf(".remove([archive.storage_path])")
  const presence = actions.indexOf(".exists(archive.storage_path)")
  const finalize = actions.indexOf('"finalize_document_archive_deletion"')
  assert.ok(
    claim >= 0 && remove > claim && presence > remove && finalize > presence
  )
  assert.match(actions, /confirmation !== "DELETE SOURCE"/)
  assert.match(
    actions,
    /archive\.deletion_requested_by === admin\.id/
  )
  assert.match(migration, /Source-plan deletion is already in progress/)
  assert.match(
    migration,
    /archived_at > now\(\) - interval '2 hours 5 minutes'/
  )
  assert.match(migration, /release_document_archive_deletion/)
})

test("archive lookup failures stop retention before any object deletion", () => {
  const retention = readFileSync(
    new URL(
      "../src/app/api/internal/cron/retention/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  const archiveFailure = retention.indexOf(
    'outcome.failures.push("document_archive_query_failed")'
  )
  const partition = retention.indexOf("} = partitionRetentionObjects(")
  const deletion = retention.indexOf(
    "const deletion = await removeTrackedStorageObjects"
  )
  assert.ok(archiveFailure >= 0)
  assert.ok(partition > archiveFailure)
  assert.ok(deletion > partition)
})

test("new storage keys do not expose the customer filename", () => {
  const createRoute = readFileSync(
    new URL("../src/app/api/takeoff/jobs/route.ts", import.meta.url),
    "utf8"
  )
  assert.match(
    createRoute,
    /const storagePath = `\$\{user\.id\}\/\$\{job\.id\}\/\$\{crypto\.randomUUID\(\)\}\.pdf`/
  )
  assert.doesNotMatch(createRoute, /sanitizeFilename/)
})

test("archive download names cannot inject headers or lose the PDF extension", () => {
  assert.equal(
    sanitizePdfFilename("..\r\nCustomer Plan"),
    ".._Customer_Plan.pdf"
  )
  assert.equal(sanitizePdfFilename("plán final.PDF"), "plan_final.PDF")
})
