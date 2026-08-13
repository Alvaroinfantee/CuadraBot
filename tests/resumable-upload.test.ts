import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  resumableUploadFingerprint,
  signedTusNeedsStandardFallback,
  SUPABASE_TUS_CHUNK_SIZE_BYTES,
  SUPABASE_TUS_RETRY_DELAYS_MS,
} from "../src/lib/supabase/resumable-upload"
import { getSupabaseResumableUploadEndpoint } from "../src/lib/supabase/storage-endpoint"

test("uses the hosted direct Storage TUS endpoint and required six MiB chunks", () => {
  assert.equal(
    getSupabaseResumableUploadEndpoint("https://Project-Ref.supabase.co"),
    "https://project-ref.storage.supabase.co/storage/v1/upload/resumable"
  )
  assert.equal(SUPABASE_TUS_CHUNK_SIZE_BYTES, 6 * 1024 * 1024)
  assert.deepEqual(SUPABASE_TUS_RETRY_DELAYS_MS, [
    0,
    3_000,
    5_000,
    10_000,
    20_000,
  ])
  assert.throws(() =>
    getSupabaseResumableUploadEndpoint("http://project-ref.supabase.co")
  )
})

test("only falls back when Supabase rejects its signed TUS compact JWS", () => {
  const rejectedToken = Object.assign(new Error("TUS creation failed"), {
    originalResponse: {
      getStatus: () => 400,
      getBody: () => '{"message":"Invalid Compact JWS"}',
    },
  })
  const unrelatedFailure = Object.assign(new Error("Network unavailable"), {
    originalResponse: {
      getStatus: () => 503,
      getBody: () => "Service unavailable",
    },
  })

  assert.equal(signedTusNeedsStandardFallback(rejectedToken), true)
  assert.equal(signedTusNeedsStandardFallback(unrelatedFailure), false)
  assert.equal(signedTusNeedsStandardFallback(new Error("Invalid Compact JWS")), false)
})

test("pause and retry retain the same draft job path and resumable fingerprint", () => {
  const file = {
    name: "plans.pdf",
    type: "application/pdf",
    size: 20_000_000,
    lastModified: 1_786_000_000_000,
  }
  const firstGrant = {
    bucket: "takeoff-uploads",
    path: "user/job/source.pdf",
  }
  const sameDraftRetry = { ...firstGrant }
  const differentDraft = {
    bucket: "takeoff-uploads",
    path: "user/another-job/source.pdf",
  }

  assert.equal(
    resumableUploadFingerprint(file, firstGrant),
    resumableUploadFingerprint(file, sameDraftRetry)
  )
  assert.notEqual(
    resumableUploadFingerprint(file, firstGrant),
    resumableUploadFingerprint(file, differentDraft)
  )

  const form = read("src/components/takeoff/new-takeoff-form.tsx")
  const retryBlock = form.match(
    /let currentDraft = draftUpload[\s\S]*?setProgress\(20\)/
  )
  assert.ok(retryBlock)
  assert.match(retryBlock[0], /if \(!currentDraft\)/)
  assert.match(retryBlock[0], /fetch\("\/api\/takeoff\/jobs"/)
  assert.match(form, /grant: currentDraft/)
  assert.match(
    form,
    /`\/api\/takeoff\/jobs\/\$\{currentDraft\.jobId\}\/submit`/
  )
  assert.match(
    form,
    /async function cancelUpload\(\) \{\s*await activeUploadTask\.current\?\.cancel\(\)\s*\}/
  )
  assert.doesNotMatch(
    form.match(/async function cancelUpload[\s\S]*?\n  \}/)?.[0] ?? "",
    /resetPreparedDraft/
  )
})

test("signed TUS uploads are non-upserting and preserve server verification", () => {
  const resumable = read("src/lib/supabase/resumable-upload.ts")
  const createRoute = read("src/app/api/takeoff/jobs/route.ts")
  const submitRoute = read("src/app/api/takeoff/jobs/[id]/submit/route.ts")
  const verifier = read("src/lib/pdf-verification.ts")
  const artifactRoute = read(
    "src/app/api/internal/worker/takeoff/jobs/[id]/artifacts/route.ts"
  )

  assert.match(resumable, /"x-signature": grant\.token/)
  assert.match(resumable, /uploadToSignedUrl\(grant\.path, grant\.token, file/)
  assert.doesNotMatch(resumable, /x-upsert|authorization/i)
  assert.match(resumable, /findPreviousUploads\(\)/)
  assert.match(resumable, /resumeFromPreviousUpload/)
  assert.match(resumable, /upload\.abort\(false\)/)
  assert.match(resumable, /removeFingerprintOnSuccess: true/)
  assert.match(createRoute, /createSignedUploadUrl\(storagePath, \{ upsert: false \}\)/)
  assert.match(createRoute, /getSupabaseResumableUploadEndpoint/)
  assert.match(verifier, /createHash\("sha256"\)/)
  assert.match(submitRoute, /originalSizeBytes/)

  // Small generated workbook/PDF artifact uploads intentionally keep their
  // existing signed standard-upload path; only customer blueprint uploads use TUS.
  assert.match(artifactRoute, /createSignedUploadUrl\(storagePath/)
  assert.doesNotMatch(artifactRoute, /tus-js-client|upload\/resumable/)
})

test("PDF verification acquires a global lease before streaming to isolated qpdf", () => {
  const submitRoute = read("src/app/api/takeoff/jobs/[id]/submit/route.ts")
  const verifier = read("src/lib/pdf-verification.ts")
  const dockerfile = read("Dockerfile")
  const leaseMigration = read(
    "supabase/migrations/20260806223000_global_takeoff_verification_lease.sql"
  )
  const acquireAt = submitRoute.indexOf('"begin_takeoff_verification"')
  const signedDownloadAt = submitRoute.indexOf(
    ".createSignedUrl(sourceFile.storage_path"
  )

  assert.ok(acquireAt >= 0)
  assert.ok(signedDownloadAt > acquireAt)
  assert.match(submitRoute, /finally\s*{\s*await releaseVerification/)
  assert.match(submitRoute, /verifyPdfStream\(download\.body/)
  assert.doesNotMatch(submitRoute, /PDFDocument|\.arrayBuffer\(\)|\.download\(/)
  assert.match(verifier, /ulimit -v/)
  assert.match(verifier, /ulimit -t/)
  assert.match(verifier, /ulimit -f/)
  assert.match(verifier, /process\.kill\(-child\.pid, "SIGKILL"\)/)
  assert.match(verifier, /QPDF_STDIO_LIMIT_BYTES = 8 \* 1024/)
  assert.match(dockerfile, /qpdf=12\.3\.2-r0/)
  assert.match(dockerfile, /USER nextjs/)
  assert.match(leaseMigration, /pg_advisory_xact_lock/)
  assert.match(leaseMigration, /active_verifications\s*>=\s*1/)
  assert.match(
    leaseMigration,
    /verification_started_at\s*>\s*now\(\)\s*-\s*interval '15 minutes'/
  )
  assert.match(
    leaseMigration,
    /revoke execute on function public\.begin_takeoff_verification\(uuid, uuid\)[\s\S]*from public, anon, authenticated/
  )
})

test("public launch enforces the 25 MiB source cap in code and Storage", () => {
  const config = read("src/lib/config.ts")
  const environment = read(".env.example")
  const migration = read(
    "supabase/migrations/20260806192139_admin_bootstrap_recovery.sql"
  )

  assert.match(config, /launchUploadCeilingMb = 25/)
  assert.match(config, /Math\.min\(configuredUploadMb, launchUploadCeilingMb\)/)
  assert.match(environment, /^MAX_UPLOAD_MB=25$/m)
  assert.match(migration, /set file_size_limit = 26214400/)
})

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
