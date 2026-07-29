import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { getBearerToken, jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const token = getBearerToken(request)
  const expected = process.env.CRON_SECRET
  if (!token || !expected || !safeEqual(token, expected)) {
    return jsonError("Unauthorized reconciliation request.", 401)
  }

  const supabase = createSupabaseAdminClient()
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: staleJobs, error } = await supabase
    .from("takeoff_jobs")
    .select("*")
    .eq("status", "processing")
    .lt("updated_at", staleBefore)

  if (error) return jsonError(error.message, 500)

  let requeued = 0
  let failed = 0
  let staleSkipped = 0
  let transitionErrors = 0
  for (const job of staleJobs ?? []) {
    const exhausted = job.attempt_count >= job.max_attempts
    const { data: transitioned, error: transitionError } = await supabase.rpc(
      "fail_takeoff_job",
      {
        p_job_id: job.id,
        p_worker_id: null,
        p_claim_token: job.claim_token,
        p_stage: exhausted ? "stale_claim_exhausted" : "stale_claim",
        p_message: exhausted
          ? "Processing stopped updating after the maximum retry count."
          : "Processing stopped updating and was queued for another attempt.",
        p_retryable: true,
        p_force_terminal: exhausted,
        p_idempotency_key: `release:stale-terminal:${job.id}`,
        p_stale_before: staleBefore,
      }
    )

    if (transitionError || !transitioned) {
      transitionErrors += 1
      continue
    }

    if (transitioned.status === "queued") {
      requeued += 1
    }
    if (transitioned.status === "failed") {
      failed += 1
    }
    if (transitioned.status === "processing") {
      staleSkipped += 1
    }
  }

  const uploadCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: abandonedJobs, error: abandonedQueryError } = await supabase
    .from("takeoff_jobs")
    .select("id,user_id")
    .in("status", ["awaiting_upload", "ready"])
    .lt("created_at", uploadCutoff)
    .order("created_at", { ascending: true })
    .limit(100)

  let expiredUploads = 0
  let expirationErrors = abandonedQueryError ? 1 : 0
  for (const job of abandonedJobs ?? []) {
    const { data: expired, error: expirationError } = await supabase.rpc(
      "expire_abandoned_takeoff_job",
      {
        p_job_id: job.id,
        p_cutoff: uploadCutoff,
      }
    )

    if (expirationError) {
      expirationErrors += 1
    } else if (expired) {
      expiredUploads += 1
    }
  }

  const { data: cleanupJobs, error: cleanupQueryError } = await supabase
    .from("takeoff_jobs")
    .select("id,user_id")
    .eq("status", "canceled")
    .eq("stage", "upload_expired")
    .order("updated_at", { ascending: true })
    .limit(200)

  if (cleanupQueryError) expirationErrors += 1

  const cleanupJobIds = (cleanupJobs ?? []).map((job) => job.id)
  let deletedUploadObjects = 0
  if (cleanupJobIds.length) {
    const { data: uploadRows, error: uploadRowsError } = await supabase
      .from("takeoff_files")
      .select("id,job_id,user_id,bucket,storage_path")
      .in("job_id", cleanupJobIds)
      .eq("file_role", "input")

    if (uploadRowsError) {
      expirationErrors += 1
    } else {
      const jobsById = new Map(
        (cleanupJobs ?? []).map((job) => [job.id, job])
      )
      const pathsByBucket = new Map<string, Set<string>>()
      for (const row of uploadRows ?? []) {
        const paths = pathsByBucket.get(row.bucket) ?? new Set<string>()
        paths.add(row.storage_path)
        paths.add(`${row.user_id}/${row.job_id}/sample.pdf`)
        pathsByBucket.set(row.bucket, paths)
      }
      for (const job of cleanupJobs ?? []) {
        if ((uploadRows ?? []).some((row) => row.job_id === job.id)) continue
        const paths =
          pathsByBucket.get(process.env.TAKEOFF_UPLOAD_BUCKET ?? "takeoff-uploads") ??
          new Set<string>()
        paths.add(`${job.user_id}/${job.id}/sample.pdf`)
        pathsByBucket.set(
          process.env.TAKEOFF_UPLOAD_BUCKET ?? "takeoff-uploads",
          paths
        )
      }

      let storageCleanupSucceeded = true
      for (const [bucket, paths] of pathsByBucket) {
        const { data: removed, error: removeError } = await supabase.storage
          .from(bucket)
          .remove([...paths])
        if (removeError) {
          storageCleanupSucceeded = false
          expirationErrors += 1
        } else {
          deletedUploadObjects += removed?.length ?? 0
        }
      }

      if (storageCleanupSucceeded && uploadRows?.length) {
        const { error: metadataDeleteError } = await supabase
          .from("takeoff_files")
          .delete()
          .in(
            "id",
            uploadRows.map((row) => row.id)
          )
        if (metadataDeleteError) expirationErrors += 1
      }

      void jobsById
    }
  }

  const rateLimitCutoff = new Date(
    Date.now() - 2 * 24 * 60 * 60 * 1000
  ).toISOString()
  const { error: rateCleanupError } = await supabase
    .from("api_rate_limits")
    .delete()
    .lt("updated_at", rateLimitCutoff)
  if (rateCleanupError) expirationErrors += 1

  const checkTime = new Date()
  const { error: healthError } = await supabase.from("service_health").upsert(
    {
      service_name: "cuadrabot-reconciler",
      check_name: "stale-claims",
      status:
        failed || transitionErrors || expirationErrors
          ? "degraded"
          : "healthy",
      message: `${requeued} requeued, ${staleSkipped} active claims preserved, ${failed} terminal failures, ${expiredUploads} abandoned uploads expired, ${transitionErrors + expirationErrors} errors.`,
      details: {
        inspected: staleJobs?.length ?? 0,
        requeued,
        staleSkipped,
        failed,
        transitionErrors,
        abandonedInspected: abandonedJobs?.length ?? 0,
        expiredUploads,
        deletedUploadObjects,
        expirationErrors,
      },
      checked_at: checkTime.toISOString(),
      expires_at: new Date(checkTime.getTime() + 20 * 60 * 1000).toISOString(),
    },
    { onConflict: "service_name,check_name" }
  )

  if (healthError) {
    return jsonError(`Could not record reconciler health: ${healthError.message}`, 500)
  }

  return NextResponse.json({
    inspected: staleJobs?.length ?? 0,
    requeued,
    staleSkipped,
    failed,
    transitionErrors,
    abandonedInspected: abandonedJobs?.length ?? 0,
    expiredUploads,
    deletedUploadObjects,
    expirationErrors,
  })
}

export async function GET(request: Request) {
  return POST(request)
}

function safeEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}
