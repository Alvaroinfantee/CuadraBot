import { randomUUID, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { getBearerToken, jsonError } from "@/lib/http"
import {
  partitionRetentionObjects,
  storageObjectKey,
} from "@/lib/document-archive"
import {
  parseProjectFileRetentionDays,
  PROJECT_FILE_RETENTION_SETTING_KEY,
  projectFileRetentionCutoff,
  projectFileRetentionStatuses,
} from "@/lib/project-file-retention"
import { removeTrackedStorageObjects } from "@/lib/project-file-retention-storage"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const MAX_JOBS_PER_RUN = 50
const MAX_FILES_PER_RUN = 1_000
const STORAGE_DELETE_BATCH_SIZE = 100
const RETENTION_HEALTH_TTL_HOURS = 30
const RETENTION_LEASE_HOURS = 2
const allowedBuckets = new Set(["takeoff-uploads", "takeoff-results"])

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>

type TerminalJob = {
  id: string
  status: string
  project_files_retention_at: string
}

type ProjectFile = {
  id: string
  job_id: string
  bucket: string
  storage_path: string
  file_role: string
}

type DocumentArchive = {
  job_id: string
  bucket: string
  storage_path: string
  status: string
}

type RetentionOutcome = {
  retentionDays: number | null
  cutoff: string | null
  jobsInspected: number
  jobsEligible: number
  jobsSkippedAfterRecheck: number
  filesInspected: number
  sourceFilesProtected: number
  objectDeleteRequestsSucceeded: number
  metadataRowsDeleted: number
  jobsMarkedPurged: number
  fileBatchTruncated: boolean
  marketingRetentionCutoff: string | null
  marketingEventsDeleted: number
  failures: string[]
}

export async function GET(request: Request) {
  return runProjectFileRetention(request)
}

export async function POST(request: Request) {
  return runProjectFileRetention(request)
}

async function runProjectFileRetention(request: Request) {
  const token = getBearerToken(request)
  const expected = process.env.CRON_SECRET
  if (!token || !expected || !safeEqual(token, expected)) {
    return jsonError("Unauthorized retention request.", 401)
  }

  const supabase = createSupabaseAdminClient()
  const outcome: RetentionOutcome = {
    retentionDays: null,
    cutoff: null,
    jobsInspected: 0,
    jobsEligible: 0,
    jobsSkippedAfterRecheck: 0,
    filesInspected: 0,
    sourceFilesProtected: 0,
    objectDeleteRequestsSucceeded: 0,
    metadataRowsDeleted: 0,
    jobsMarkedPurged: 0,
    fileBatchTruncated: false,
    marketingRetentionCutoff: null,
    marketingEventsDeleted: 0,
    failures: [],
  }

  const { data: setting, error: settingError } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", PROJECT_FILE_RETENTION_SETTING_KEY)
    .maybeSingle()

  if (settingError || !setting) {
    outcome.failures.push("retention_setting_unavailable")
    return finishRetentionRun(supabase, outcome)
  }

  const parsedSetting = parseProjectFileRetentionDays(setting.value)
  if (!parsedSetting.ok) {
    outcome.failures.push("retention_setting_invalid")
    return finishRetentionRun(supabase, outcome)
  }

  outcome.retentionDays = parsedSetting.days
  outcome.cutoff = projectFileRetentionCutoff(new Date(), parsedSetting.days)

  const { data: candidates, error: candidateError } = await supabase
    .from("takeoff_jobs")
    .select("id,status,project_files_retention_at")
    .in("status", [...projectFileRetentionStatuses])
    .is("project_files_purged_at", null)
    .lt("project_files_retention_at", outcome.cutoff)
    .order("project_files_retention_at", { ascending: true })
    .limit(MAX_JOBS_PER_RUN)

  if (candidateError) {
    outcome.failures.push("terminal_job_query_failed")
    return finishRetentionRun(supabase, outcome)
  }

  const candidateJobs = (candidates ?? []) as TerminalJob[]
  outcome.jobsInspected = candidateJobs.length
  if (!candidateJobs.length) return finishRetentionRun(supabase, outcome)

  const candidateIds = candidateJobs.map((job) => job.id)
  const claimToken = randomUUID()
  const claimed = await claimRetentionJobs(
    supabase,
    candidateIds,
    outcome.cutoff,
    claimToken
  )
  if (!claimed.ok) {
    outcome.failures.push("terminal_job_claim_failed")
    return finishRetentionRun(supabase, outcome)
  }

  outcome.jobsEligible = claimed.ids.size
  outcome.jobsSkippedAfterRecheck =
    candidateIds.length - claimed.ids.size
  if (!claimed.ids.size) return finishRetentionRun(supabase, outcome)

  try {
    const [fileResult, archiveResult] = await Promise.all([
      supabase
        .from("takeoff_files")
        .select("id,job_id,bucket,storage_path,file_role")
        .in("job_id", [...claimed.ids])
        .order("created_at", { ascending: true })
        .limit(MAX_FILES_PER_RUN),
      supabase
        .from("document_archives")
        .select("job_id,bucket,storage_path,status")
        .in("job_id", [...claimed.ids])
        .neq("status", "deleted"),
    ])

    if (fileResult.error) {
      outcome.failures.push("project_file_query_failed")
    } else if (archiveResult.error) {
      outcome.failures.push("document_archive_query_failed")
    } else {
      const trackedFiles = (fileResult.data ?? []) as ProjectFile[]
      const archives = (archiveResult.data ?? []) as DocumentArchive[]
      const {
        protectedPaths,
        protectedObjects,
        deletableObjects: files,
      } = partitionRetentionObjects(
        trackedFiles,
        archives
      )
      outcome.filesInspected = trackedFiles.length
      outcome.sourceFilesProtected = protectedObjects.length
      outcome.fileBatchTruncated = trackedFiles.length === MAX_FILES_PER_RUN

      const byBucket = Map.groupBy(files, (file) => file.bucket)
      for (const [bucket, bucketFiles] of byBucket) {
        if (!allowedBuckets.has(bucket)) {
          outcome.failures.push("unexpected_storage_bucket")
          continue
        }

        for (const batch of chunks(bucketFiles, STORAGE_DELETE_BATCH_SIZE)) {
          const deletion = await removeTrackedStorageObjects(
            supabase.storage.from(bucket),
            batch
          )
          if (deletion.failed) {
            outcome.failures.push("storage_object_delete_failed")
          }
          if (!deletion.succeeded.length) continue

          outcome.objectDeleteRequestsSucceeded += deletion.succeeded.length
          const { data: deletedRows, error: metadataError } = await supabase
            .from("takeoff_files")
            .delete()
            .eq("bucket", bucket)
            .in("job_id", [...claimed.ids])
            .in("id", deletion.succeeded.map((file) => file.id))
            .select("id")

          if (metadataError) {
            outcome.failures.push("file_metadata_delete_failed")
            continue
          }

          outcome.metadataRowsDeleted += deletedRows?.length ?? 0
        }
      }

      await markFullyPurgedJobs(
        supabase,
        claimed.ids,
        claimToken,
        protectedPaths,
        outcome
      )
    }
  } catch {
    outcome.failures.push("unexpected_retention_failure")
  }

  await releaseRetentionClaim(supabase, claimToken, outcome)
  return finishRetentionRun(supabase, outcome)
}

async function claimRetentionJobs(
  supabase: SupabaseAdmin,
  jobIds: string[],
  cutoff: string,
  claimToken: string
): Promise<{ ok: true; ids: Set<string> } | { ok: false }> {
  const claimedAt = new Date()
  const { error: staleClaimError } = await supabase
    .from("takeoff_jobs")
    .update({
      project_files_purge_token: null,
      project_files_purge_started_at: null,
      project_files_purge_expires_at: null,
    })
    .in("id", jobIds)
    .not("project_files_purge_token", "is", null)
    .lte("project_files_purge_expires_at", claimedAt.toISOString())
  if (staleClaimError) return { ok: false }

  const { data, error } = await supabase
    .from("takeoff_jobs")
    .update({
      project_files_purge_token: claimToken,
      project_files_purge_started_at: claimedAt.toISOString(),
      project_files_purge_expires_at: new Date(
        claimedAt.getTime() + RETENTION_LEASE_HOURS * 60 * 60 * 1000
      ).toISOString(),
    })
    .in("id", jobIds)
    .in("status", [...projectFileRetentionStatuses])
    .is("project_files_purged_at", null)
    .is("project_files_purge_token", null)
    .lt("project_files_retention_at", cutoff)
    .select("id")
  if (error) return { ok: false }

  return {
    ok: true,
    ids: new Set((data ?? []).map((job) => job.id as string)),
  }
}

async function markFullyPurgedJobs(
  supabase: SupabaseAdmin,
  eligibleJobIds: Set<string>,
  claimToken: string,
  protectedPaths: Set<string>,
  outcome: RetentionOutcome
) {
  if (!eligibleJobIds.size) return

  const ids = [...eligibleJobIds]
  const apparentlyPurged: string[] = []
  for (const batch of chunks(ids, 10)) {
    const checks = await Promise.all(
      batch.map(async (jobId) => {
        const { data, error } = await supabase
          .from("takeoff_files")
          .select("bucket,storage_path")
          .eq("job_id", jobId)
        const remaining = (data ?? []).some(
          (file) =>
            !protectedPaths.has(
              storageObjectKey(file.bucket as string, file.storage_path as string)
            )
        )
        return { jobId, remaining, error }
      })
    )

    for (const check of checks) {
      if (check.error) {
        outcome.failures.push("remaining_file_query_failed")
      } else if (!check.remaining) {
        apparentlyPurged.push(check.jobId)
      }
    }
  }

  for (const batch of chunks(apparentlyPurged, STORAGE_DELETE_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("takeoff_jobs")
      .update({ project_files_purged_at: new Date().toISOString() })
      .in("id", batch)
      .in("status", [...projectFileRetentionStatuses])
      .is("project_files_purged_at", null)
      .eq("project_files_purge_token", claimToken)
      .select("id")
    if (error) {
      outcome.failures.push("purged_job_marker_failed")
      continue
    }
    outcome.jobsMarkedPurged += data?.length ?? 0
  }
}

async function releaseRetentionClaim(
  supabase: SupabaseAdmin,
  claimToken: string,
  outcome: RetentionOutcome
) {
  const { error } = await supabase
    .from("takeoff_jobs")
    .update({
      project_files_purge_token: null,
      project_files_purge_started_at: null,
      project_files_purge_expires_at: null,
    })
    .eq("project_files_purge_token", claimToken)
  if (error) outcome.failures.push("retention_claim_release_failed")
}

async function finishRetentionRun(
  supabase: SupabaseAdmin,
  outcome: RetentionOutcome
) {
  await pruneMarketingEvents(supabase, outcome)
  const uniqueFailures = [...new Set(outcome.failures)]
  outcome.failures = uniqueFailures
  let alertWriteFailed = false

  if (uniqueFailures.length) {
    try {
      await createOrTouchRetentionAlert(supabase, outcome)
    } catch {
      alertWriteFailed = true
      outcome.failures.push("admin_alert_write_failed")
    }
  }

  const checkedAt = new Date()
  const status = outcome.failures.length ? "degraded" : "healthy"
  const { error: healthError } = await supabase.from("service_health").upsert(
    {
      service_name: "cuadrabot-retention",
      check_name: "project-files",
      status,
      message: outcome.failures.length
        ? `Generated-file retention finished with ${outcome.failures.length} operational issue(s).`
        : `${outcome.metadataRowsDeleted} generated or working file(s) removed after the configured window; ${outcome.sourceFilesProtected} source file(s) protected.`,
      details: {
        retentionDays: outcome.retentionDays,
        cutoff: outcome.cutoff,
        jobsInspected: outcome.jobsInspected,
        jobsEligible: outcome.jobsEligible,
        jobsSkippedAfterRecheck: outcome.jobsSkippedAfterRecheck,
        filesInspected: outcome.filesInspected,
        sourceFilesProtected: outcome.sourceFilesProtected,
        objectDeleteRequestsSucceeded:
          outcome.objectDeleteRequestsSucceeded,
        metadataRowsDeleted: outcome.metadataRowsDeleted,
        jobsMarkedPurged: outcome.jobsMarkedPurged,
        fileBatchTruncated: outcome.fileBatchTruncated,
        marketingRetentionCutoff: outcome.marketingRetentionCutoff,
        marketingEventsDeleted: outcome.marketingEventsDeleted,
        failures: outcome.failures,
        alertWriteFailed,
      },
      checked_at: checkedAt.toISOString(),
      expires_at: new Date(
        checkedAt.getTime() + RETENTION_HEALTH_TTL_HOURS * 60 * 60 * 1000
      ).toISOString(),
    },
    { onConflict: "service_name,check_name" }
  )

  if (healthError) {
    return jsonError("Could not record generated-file retention health.", 500)
  }

  return NextResponse.json(
    {
      retentionDays: outcome.retentionDays,
      cutoff: outcome.cutoff,
      jobsInspected: outcome.jobsInspected,
      jobsEligible: outcome.jobsEligible,
      jobsSkippedAfterRecheck: outcome.jobsSkippedAfterRecheck,
      filesInspected: outcome.filesInspected,
      objectDeleteRequestsSucceeded:
        outcome.objectDeleteRequestsSucceeded,
      metadataRowsDeleted: outcome.metadataRowsDeleted,
      jobsMarkedPurged: outcome.jobsMarkedPurged,
      fileBatchTruncated: outcome.fileBatchTruncated,
      marketingRetentionCutoff: outcome.marketingRetentionCutoff,
      marketingEventsDeleted: outcome.marketingEventsDeleted,
      failures: outcome.failures,
    },
    { status: outcome.failures.length ? 500 : 200 }
  )
}

async function pruneMarketingEvents(
  supabase: SupabaseAdmin,
  outcome: RetentionOutcome
) {
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 13)
  outcome.marketingRetentionCutoff = cutoff.toISOString()

  const { count, error } = await supabase
    .from("marketing_events")
    .delete({ count: "exact" })
    .lt("occurred_at", outcome.marketingRetentionCutoff)
  if (error) {
    outcome.failures.push("marketing_event_retention_failed")
    return
  }
  outcome.marketingEventsDeleted = count ?? 0
}

async function createOrTouchRetentionAlert(
  supabase: SupabaseAdmin,
  outcome: RetentionOutcome
) {
  const now = new Date().toISOString()
  const dedupeKey = "retention:project-files"
  const metadata = {
    failures: [...new Set(outcome.failures)],
    jobsInspected: outcome.jobsInspected,
    filesInspected: outcome.filesInspected,
    metadataRowsDeleted: outcome.metadataRowsDeleted,
  }
  const { data: existing, error: readError } = await supabase
    .from("admin_alerts")
    .select("id,occurrence_count")
    .eq("dedupe_key", dedupeKey)
    .in("status", ["open", "acknowledged"])
    .maybeSingle()
  if (readError) throw new Error("Could not read retention alert.")

  if (existing) {
    const { error } = await supabase
      .from("admin_alerts")
      .update({
        severity: "critical",
        title: "Generated-file retention needs attention",
        message:
          "One or more generated or working files could not complete the configured cleanup. Archived source plans remain protected, and no metadata is removed when Storage deletion fails.",
        occurrence_count: existing.occurrence_count + 1,
        last_seen_at: now,
        metadata,
      })
      .eq("id", existing.id)
    if (error) throw new Error("Could not update retention alert.")
    return
  }

  const { error } = await supabase.from("admin_alerts").insert({
    severity: "critical",
    category: "system",
    title: "Generated-file retention needs attention",
    message:
      "One or more generated or working files could not complete the configured cleanup. Archived source plans remain protected, and no metadata is removed when Storage deletion fails.",
    status: "open",
    dedupe_key: dedupeKey,
    entity_type: "app_setting",
    entity_id: PROJECT_FILE_RETENTION_SETTING_KEY,
    metadata,
    first_seen_at: now,
    last_seen_at: now,
  })
  if (error && error.code !== "23505") {
    throw new Error("Could not create retention alert.")
  }
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function safeEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}
