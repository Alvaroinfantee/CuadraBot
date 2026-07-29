import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"
import { getAppFeatures } from "@/lib/app-settings"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { maxPlanPages, maxUploadBytes } from "@/lib/config"
import { consumeTakeoffRateLimit } from "@/lib/request-rate-limit"
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

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const [user, profile, features] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
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
  const body = await request.json().catch(() => ({}))
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
    return jsonError("The free sample is currently unavailable.", 403)
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

  const { data: download, error: downloadError } = await supabase.storage
    .from(sourceFile.bucket)
    .download(sourceFile.storage_path)
  if (downloadError || !download) {
    return jsonError(
      downloadError?.message ?? "The uploaded plan could not be verified.",
      409
    )
  }
  if (download.size > maxUploadBytes) {
    return jsonError("The uploaded plan exceeds the file limit.", 413)
  }

  let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(
    await download.arrayBuffer()
  )
  if (!isPdf(bytes)) return jsonError("The uploaded object is not a PDF.", 422)

  let pdf: PDFDocument
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: false })
  } catch {
    return jsonError("The PDF is invalid, encrypted, or password protected.", 422)
  }

  const originalPageCount = pdf.getPageCount()
  if (originalPageCount < 1 || originalPageCount > maxPlanPages) {
    return jsonError(
      `Plan sets must contain between 1 and ${maxPlanPages} pages.`,
      422
    )
  }

  const samplePage =
    job.free_sample ? parsed.data.samplePage ?? job.sample_page ?? 1 : null
  if (samplePage && samplePage > originalPageCount) {
    return jsonError(
      `Sample page ${samplePage} is outside this ${originalPageCount}-page PDF.`,
      422
    )
  }

  const originalStoragePath = sourceFile.storage_path
  const originalSizeBytes = bytes.byteLength
  const originalSha256 = createHash("sha256").update(bytes).digest("hex")
  let verifiedStoragePath = originalStoragePath
  let effectivePageCount = originalPageCount
  if (job.free_sample && samplePage) {
    const samplePdf = await PDFDocument.create()
    const [page] = await samplePdf.copyPages(pdf, [samplePage - 1])
    samplePdf.addPage(page)
    bytes = await samplePdf.save()
    effectivePageCount = 1
  }

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
    return jsonError("The free sample for this workspace is no longer available.", 409)
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const dueAt = price.turnaroundHours
    ? new Date(Date.now() + price.turnaroundHours * 60 * 60 * 1000).toISOString()
    : null

  const { data: verification, error: verificationError } = await supabase.rpc(
    "begin_takeoff_verification",
    {
      p_job_id: job.id,
      p_user_id: user.id,
    }
  )
  const verificationToken = verification?.verification_token
  if (verificationError || typeof verificationToken !== "string") {
    return jsonError(
      verificationError?.message ?? "Could not claim plan verification.",
      409
    )
  }

  const { error: archiveError } = await supabase.rpc(
    "register_verified_document_archive",
    {
      p_job_id: job.id,
      p_user_id: user.id,
      p_verification_token: verificationToken,
      p_file_id: sourceFile.id,
      p_size_bytes: originalSizeBytes,
      p_sha256: originalSha256,
      p_page_count: originalPageCount,
    }
  )
  if (archiveError) {
    await releaseVerification(supabase, job.id, user.id, verificationToken)
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
          requested_size_bytes: originalSizeBytes,
          requested_page_count: originalPageCount,
        },
      })
    }
    return jsonError(
      archiveError.message || "Could not securely archive the source plan.",
      409
    )
  }

  if (job.free_sample) {
    verifiedStoragePath = `${user.id}/${job.id}/sample.pdf`
    const { error: sampleUploadError } = await supabase.storage
      .from(sourceFile.bucket)
      .upload(verifiedStoragePath, Buffer.from(bytes), {
        contentType: "application/pdf",
        upsert: true,
      })
    if (sampleUploadError) {
      await releaseVerification(
        supabase,
        job.id,
        user.id,
        verificationToken
      )
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
      p_size_bytes: bytes.byteLength,
      p_sha256: sha256,
      p_original_page_count: originalPageCount,
      p_page_count: effectivePageCount,
      p_sample_page: samplePage,
      p_scope: price.tier,
      p_quoted_credits: price.credits,
      p_due_at: dueAt,
      p_result_summary: {
        original_page_count: originalPageCount,
        verified_page_count: effectivePageCount,
        pricing_tier: price.tier,
        source_archive_sha256: originalSha256,
      },
    }
  )

  if (finalizeError || !readyJob) {
    await releaseVerification(supabase, job.id, user.id, verificationToken)
    return jsonError(
      finalizeError?.message ?? "Could not finalize plan verification.",
      409
    )
  }

  return NextResponse.json({
    job: { id: readyJob.id, status: readyJob.status },
    quote: { ...price, pageCount: effectivePageCount },
  })
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
      return jsonError("The free sample has already been used.", 409)
    }
    const { data, error } = await supabase.rpc("queue_free_sample", {
      p_job_id: job.id,
      p_idempotency_key: `sample:${job.id}`,
    })
    if (error || !data) {
      return jsonError(error?.message ?? "Could not queue the free sample.", 409)
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

function isPdf(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 5 &&
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
  )
}
