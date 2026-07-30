import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { getBearerToken, jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_ARCHIVES_PER_RUN = 100
const CHECK_CONCURRENCY = 10
const HEALTH_TTL_HOURS = 30

type ArchiveRow = {
  id: string
  job_id: string
  user_id: string
  bucket: string
  storage_path: string
  status: "retained" | "deletion_requested" | "deleting"
  integrity_status: "verified" | "missing"
  last_check_attempt_at: string
}

export async function GET(request: Request) {
  return checkArchiveIntegrity(request)
}

export async function POST(request: Request) {
  return checkArchiveIntegrity(request)
}

async function checkArchiveIntegrity(request: Request) {
  const token = getBearerToken(request)
  const expected = process.env.CRON_SECRET
  if (!token || !expected || !safeEqual(token, expected)) {
    return jsonError("Unauthorized archive-integrity request.", 401)
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("document_archives")
    .select(
      "id,job_id,user_id,bucket,storage_path,status,integrity_status,last_check_attempt_at"
    )
    .neq("status", "deleted")
    .order("last_check_attempt_at", { ascending: true })
    .limit(MAX_ARCHIVES_PER_RUN)

  let operationalErrors = error ? 1 : 0
  let verified = 0
  let missing = 0
  const checkedAt = new Date().toISOString()

  for (const batch of chunks((data ?? []) as ArchiveRow[], CHECK_CONCURRENCY)) {
    const results = await Promise.all(
      batch.map((archive) =>
        checkOneArchive(supabase, archive, checkedAt)
      )
    )
    for (const result of results) {
      verified += result.verified
      missing += result.missing
      operationalErrors += result.operationalErrors
    }
  }

  const verificationBefore = new Date(
    Date.parse(checkedAt) - 8 * 24 * 60 * 60 * 1000
  ).toISOString()
  const { data: metricsData, error: metricsError } = await supabase.rpc(
    "get_document_archive_metrics",
    { p_verification_before: verificationBefore }
  )
  if (metricsError) operationalErrors += 1
  const metrics = asMetrics(metricsData)
  const globalMissing = metricsError ? missing : metrics.missing
  const overdueVerification = metricsError ? 0 : metrics.overdueVerification
  const status =
    globalMissing || overdueVerification || operationalErrors
      ? "degraded"
      : "healthy"
  const { error: healthError } = await supabase.from("service_health").upsert(
    {
      service_name: "cuadrabot-archive",
      check_name: "source-integrity",
      status,
      message: `${verified} source archives confirmed present in this batch; ${globalMissing} missing and ${overdueVerification} overdue across all stored sources; ${operationalErrors} operational errors.`,
      details: {
        inspected: data?.length ?? 0,
        verified,
        missingInBatch: missing,
        missing: globalMissing,
        overdueVerification,
        stored: metrics.stored,
        operationalErrors,
        batchLimit: MAX_ARCHIVES_PER_RUN,
        batchTruncated: (data?.length ?? 0) === MAX_ARCHIVES_PER_RUN,
        oldestAttemptInspected:
          ((data ?? [])[0] as ArchiveRow | undefined)
            ?.last_check_attempt_at ?? null,
        concurrency: CHECK_CONCURRENCY,
        check: "storage_object_exists",
      },
      checked_at: checkedAt,
      expires_at: new Date(
        Date.parse(checkedAt) + HEALTH_TTL_HOURS * 60 * 60 * 1000
      ).toISOString(),
    },
    { onConflict: "service_name,check_name" }
  )

  if (healthError) {
    return jsonError(
      `Could not record archive-integrity health: ${healthError.message}`,
      500
    )
  }

  return NextResponse.json({
    inspected: data?.length ?? 0,
    verified,
    missingInBatch: missing,
    missing: globalMissing,
    overdueVerification,
    operationalErrors,
  })
}

async function checkOneArchive(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  archive: ArchiveRow,
  checkedAt: string
) {
  let operationalErrors = 0
  const { data: exists, error: existsError } = await supabase.storage
    .from(archive.bucket)
    .exists(archive.storage_path)

  if (existsError) {
    const { error: attemptError } = await supabase.rpc(
      "record_document_archive_presence",
      {
        p_archive_id: archive.id,
        p_present: null,
        p_checked_at: checkedAt,
      }
    )
    return {
      verified: 0,
      missing: 0,
      operationalErrors: 1 + (attemptError ? 1 : 0),
    }
  }

  if (!exists) {
    const { data: updateData, error: updateError } = await supabase.rpc(
      "record_document_archive_presence",
      {
        p_archive_id: archive.id,
        p_present: false,
        p_checked_at: checkedAt,
      }
    )
    if (updateError) {
      return { verified: 0, missing: 0, operationalErrors: 1 }
    }

    const missingRecorded =
      readIntegrityStatus(updateData) === "missing"
    if (missingRecorded) {
      const alertError = await recordMissingArchiveAlert(supabase, archive)
      if (alertError) operationalErrors += 1
    }
    return {
      verified: 0,
      missing: missingRecorded ? 1 : 0,
      operationalErrors,
    }
  }

  const { data: updateData, error: updateError } = await supabase.rpc(
    "record_document_archive_presence",
    {
      p_archive_id: archive.id,
      p_present: true,
      p_checked_at: checkedAt,
    }
  )
  if (updateError) {
    return { verified: 0, missing: 0, operationalErrors: 1 }
  }

  if (
    archive.integrity_status === "missing" &&
    readIntegrityStatus(updateData) === "verified"
  ) {
    const { error: resolveError } = await supabase
      .from("admin_alerts")
      .update({
        status: "resolved",
        resolved_at: checkedAt,
        last_seen_at: checkedAt,
      })
      .eq("dedupe_key", `document-archive-missing:${archive.id}`)
      .in("status", ["open", "acknowledged"])
    if (resolveError) operationalErrors += 1
  }

  return { verified: 1, missing: 0, operationalErrors }
}

async function recordMissingArchiveAlert(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  archive: ArchiveRow
) {
  const now = new Date().toISOString()
  const dedupeKey = `document-archive-missing:${archive.id}`
  const { data: existing, error: readError } = await supabase
    .from("admin_alerts")
    .select("id,occurrence_count")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle()
  if (readError) return readError

  if (existing) {
    const { error } = await supabase
      .from("admin_alerts")
      .update({
        severity: "critical",
        status: "open",
        message:
          "A retained source plan is registered in the database but is missing from private Storage.",
        occurrence_count: existing.occurrence_count + 1,
        last_seen_at: now,
        resolved_at: null,
        metadata: {
          archive_id: archive.id,
          bucket: archive.bucket,
          storage_path: archive.storage_path,
        },
      })
      .eq("id", existing.id)
    return error
  }

  const { error } = await supabase.from("admin_alerts").insert({
    severity: "critical",
    category: "data",
    title: "Archived source plan is missing",
    message:
      "A retained source plan is registered in the database but is missing from private Storage.",
    status: "open",
    dedupe_key: dedupeKey,
    entity_type: "document_archive",
    entity_id: archive.id,
    user_id: archive.user_id,
    job_id: archive.job_id,
    metadata: {
      bucket: archive.bucket,
      storage_path: archive.storage_path,
    },
    first_seen_at: now,
    last_seen_at: now,
  })
  return error
}

function safeEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function asMetrics(value: unknown) {
  const metrics =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {}
  return {
    stored: nonNegativeNumber(metrics.stored),
    missing: nonNegativeNumber(metrics.missing),
    overdueVerification: nonNegativeNumber(metrics.overdueVerification),
  }
}

function nonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0
}

function readIntegrityStatus(value: unknown) {
  if (!value || typeof value !== "object") return null
  const status = (value as Record<string, unknown>).integrity_status
  return status === "verified" || status === "missing" ? status : null
}
