import { NextResponse } from "next/server"
import { getAppFeatures } from "@/lib/app-settings"
import { getCurrentAuthContext } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { maxPlanPages, maxUploadBytes } from "@/lib/config"
import {
  PdfVerificationError,
  verifyPdfStream,
} from "@/lib/pdf-verification"
import { consumeTakeoffRateLimit } from "@/lib/request-rate-limit"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"
import { getTakeoffPrice } from "@/lib/takeoff-pricing"
import { takeoffSubmitSchema } from "@/lib/takeoff-schemas"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { TakeoffTrade } from "@/lib/takeoff-types"

type Context = { params: Promise<{ id: string }> }
type PreparedJob = {
  id: string
  user_id: string
  status: string
  scope: string | null
  quoted_credits: number
  free_sample: boolean
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const [{ user, profile }, features] = await Promise.all([
    getCurrentAuthContext(),
    getAppFeatures(),
  ])
  if (!user || !profile) return jsonError("Log in to continue.", 401)
  if (profile.status !== "active") return jsonError("Workspace is not active.", 403)
  if (features.configurationError) {
    return jsonError("Takeoff settings are temporarily unavailable.", 503)
  }
  if (features.maintenance) {
    return jsonError(features.maintenanceMessage, 503)
  }
  const bodyResult = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.takeoffSubmitJson
  )
  if (!bodyResult.ok && bodyResult.reason === "too_large") {
    return jsonError("Takeoff submission payload is too large.", 413)
  }
  const body = bodyResult.ok ? bodyResult.value : {}
  const parsed = takeoffSubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const supabase = createSupabaseAdminClient()
  const { data: job, error: jobError } = await supabase
    .from("takeoff_jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (jobError) return jsonError(jobError.message, 500)
  if (!job) return jsonError("Takeoff not found.", 404)
  if (job.free_sample && !features.freeSample) {
    return jsonError("The free trial is currently unavailable.", 403)
  }

  if (parsed.data.confirm) {
    return confirmPreparedJob(supabase, job, profile.free_sample_used_at)
  }

  if (job.status !== "awaiting_upload") {
    return jsonError("This takeoff has already been verified.", 409)
  }

  let rateLimit: Awaited<ReturnType<typeof consumeTakeoffRateLimit>>
  try {
    rateLimit = await consumeTakeoffRateLimit({
      supabase,
      request,
      userId: user.id,
      action: "verify_takeoff",
    })
  } catch {
    return jsonError("Request limits are temporarily unavailable.", 503)
  }
  if (!rateLimit.allowed) {
    const response = jsonError(
      "Too many plan verification attempts. Try again later.",
      429
    )
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds))
    return response
  }

  const { data: sourceFile, error: fileError } = await supabase
    .from("takeoff_files")
    .select("*")
    .eq("job_id", job.id)
    .eq("user_id", user.id)
    .eq("file_role", "input")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fileError) return jsonError(fileError.message, 500)
  if (!sourceFile) return jsonError("The plan upload is missing.", 409)

  const { data: verification, error: verificationError } = await supabase.rpc(
    "begin_takeoff_verification",
    {
      p_job_id: job.id,
      p_user_id: user.id,
    }
  )
  const verificationToken = verification?.verification_token
  if (verificationError || typeof verificationToken !== "string") {
    if (verificationError?.message.includes("verification capacity is busy")) {
      const response = jsonError(
        "Plan verification is busy. Try again shortly.",
        503
      )
      response.headers.set("Retry-After", "30")
      return response
    }
    return jsonError(
      verificationError?.message ?? "Could not claim plan verification.",
      409
    )
  }

  try {
    const { data: signedDownload, error: downloadError } = await supabase.storage
      .from(sourceFile.bucket)
      .createSignedUrl(sourceFile.storage_path, 180)
    if (downloadError || !signedDownload?.signedUrl) {
      return jsonError(
        downloadError?.message ?? "The uploaded plan could not be verified.",
        409
      )
    }

    let download: Response
    try {
      download = await fetch(signedDownload.signedUrl, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(120_000),
      })
    } catch {
      return jsonError("The uploaded plan could not be downloaded.", 409)
    }
    if (!download.ok || !download.body) {
      return jsonError("The uploaded plan could not be downloaded.", 409)
    }
    const declaredLength = Number(download.headers.get("content-length"))
    if (Number.isFinite(declaredLength) && declaredLength > maxUploadBytes) {
      return jsonError("The uploaded plan exceeds the file limit.", 413)
    }

    const samplePage =
      job.free_sample ? parsed.data.samplePage ?? job.sample_page ?? 1 : null
    let verified: Awaited<ReturnType<typeof verifyPdfStream>>
    try {
      verified = await verifyPdfStream(download.body, {
        maxBytes: maxUploadBytes,
        maxPages: maxPlanPages,
        samplePage,
      })
    } catch (error) {
      return pdfVerificationErrorResponse(error)
    }

    const originalStoragePath = sourceFile.storage_path
    let verifiedStoragePath = originalStoragePath
    const effectivePageCount = job.free_sample ? 1 : verified.originalPageCount

    const { count: paidCount } = await supabase
      .from("takeoff_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("free_sample", false)
      .eq("status", "completed")

    const price = getTakeoffPrice({
      mode: job.free_sample ? "sample" : "standard",
      pageCount: effectivePageCount,
      trades: job.trades as TakeoffTrade[],
      freeSampleAvailable: !profile.free_sample_used_at,
      firstPaidAvailable: (paidCount ?? 0) === 0,
    })

    if (job.free_sample && price.tier !== "free_sample") {
      return jsonError(
        "This user's free trial is no longer available.",
        409
      )
    }

    const dueAt = price.turnaroundHours
      ? new Date(
          Date.now() + price.turnaroundHours * 60 * 60 * 1000
        ).toISOString()
      : null

    const { error: archiveError } = await supabase.rpc(
      "register_verified_document_archive",
      {
        p_job_id: job.id,
        p_user_id: user.id,
        p_verification_token: verificationToken,
        p_file_id: sourceFile.id,
        p_size_bytes: verified.originalSizeBytes,
        p_sha256: verified.originalSha256,
        p_page_count: verified.originalPageCount,
      }
    )
    if (archiveError) {
      if (archiveError.message.toLowerCase().includes("archive capacity")) {
        await supabase.from("admin_alerts").insert({
          severity: "warning",
          category: "data",
          title: "Customer source archive reached capacity",
          message:
            "A verified plan could not enter durable source storage because this account reached its archive byte or document limit.",
          status: "open",
          dedupe_key: `document-archive-capacity:${user.id}`,
          entity_type: "profile",
          entity_id: user.id,
          user_id: user.id,
          job_id: job.id,
          metadata: {
            requested_size_bytes: verified.originalSizeBytes,
            requested_page_count: verified.originalPageCount,
          },
        })
      }
      return jsonError(
        archiveError.message || "Could not securely archive the source plan.",
        409
      )
    }

    if (job.free_sample) {
      if (!verified.sampleBytes || samplePage === null) {
        return jsonError("The sample PDF could not be isolated.", 422)
      }
      verifiedStoragePath = `${user.id}/${job.id}/sample.pdf`
      const { error: sampleUploadError } = await supabase.storage
        .from(sourceFile.bucket)
        .upload(verifiedStoragePath, verified.sampleBytes, {
          contentType: "application/pdf",
          upsert: true,
        })
      if (sampleUploadError) {
        return jsonError(sampleUploadError.message, 500)
      }
    }

    const { data: readyJob, error: finalizeError } = await supabase.rpc(
      "finalize_takeoff_verification",
      {
        p_job_id: job.id,
        p_user_id: user.id,
        p_verification_token: verificationToken,
        p_file_id: sourceFile.id,
        p_storage_path: verifiedStoragePath,
        p_size_bytes: verified.verifiedSizeBytes,
        p_sha256: verified.verifiedSha256,
        p_original_page_count: verified.originalPageCount,
        p_page_count: effectivePageCount,
        p_sample_page: samplePage,
        p_scope: price.tier,
        p_quoted_credits: price.credits,
        p_due_at: dueAt,
        p_result_summary: {
          original_page_count: verified.originalPageCount,
          verified_page_count: effectivePageCount,
          pricing_tier: price.tier,
          source_archive_sha256: verified.originalSha256,
        },
      }
    )

    if (finalizeError || !readyJob) {
      return jsonError(
        finalizeError?.message ?? "Could not finalize plan verification.",
        409
      )
    }

    return NextResponse.json({
      job: { id: readyJob.id, status: readyJob.status },
      quote: { ...price, pageCount: effectivePageCount },
    })
  } finally {
    await releaseVerification(
      supabase,
      job.id,
      user.id,
      verificationToken
    ).catch(() => undefined)
  }
}

function pdfVerificationErrorResponse(error: unknown) {
  if (!(error instanceof PdfVerificationError)) {
    return jsonError("The uploaded plan could not be verified.", 409)
  }
  if (error.code === "too_large") return jsonError(error.message, 413)
  if (error.code === "timeout") {
    const response = jsonError(
      "Plan verification timed out. Try a simplified PDF or contact support.",
      422
    )
    response.headers.set("Retry-After", "30")
    return response
  }
  return jsonError(error.message, 422)
}

async function releaseVerification(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
  userId: string,
  verificationToken: string
) {
  await supabase.rpc("release_takeoff_verification", {
    p_job_id: jobId,
    p_user_id: userId,
    p_verification_token: verificationToken,
  })
}

async function confirmPreparedJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: PreparedJob,
  freeSampleUsedAt: string | null
) {
  if (job.status === "queued") {
    return NextResponse.json({ job: { id: job.id, status: job.status } })
  }
  if (job.status !== "ready") {
    return jsonError("Verify the plan and review its quote first.", 409)
  }
  if (job.free_sample) {
    if (freeSampleUsedAt) {
      return jsonError("The free trial has already been used.", 409)
    }
    const { data, error } = await supabase.rpc("queue_free_sample", {
      p_job_id: job.id,
      p_idempotency_key: `sample:${job.id}`,
    })
    if (error || !data) {
      return jsonError(error?.message ?? "Could not queue the free trial.", 409)
    }
  } else {
    const { error } = await supabase.rpc("reserve_takeoff_credits", {
      p_job_id: job.id,
      p_credits: job.quoted_credits,
      p_idempotency_key: `reserve:${job.id}`,
      p_metadata: { pricing_tier: job.scope },
    })
    if (error) {
      const insufficient = error.message.toLowerCase().includes("insufficient")
      const { data: account } = await supabase
        .from("credit_accounts")
        .select("balance")
        .eq("user_id", job.user_id)
        .maybeSingle()
      return NextResponse.json(
        {
          error: error.message,
          required: job.quoted_credits,
          available: account?.balance ?? 0,
        },
        { status: insufficient ? 402 : 409 }
      )
    }
  }

  await supabase.from("analytics_events").insert({
    user_id: job.user_id,
    job_id: job.id,
    event_name: "takeoff_queued",
    source: "product",
    metadata: {
      credits: job.quoted_credits,
      free_sample: job.free_sample,
    },
  })

  return NextResponse.json({
    job: { id: job.id, status: "queued" },
  })
}
