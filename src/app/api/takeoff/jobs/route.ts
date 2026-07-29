import { NextResponse, type NextRequest } from "next/server"
import { getAppFeatures } from "@/lib/app-settings"
import { jsonError } from "@/lib/http"
import { getCurrentProfile, getCurrentUser } from "@/lib/auth"
import { takeoffUploadBucket } from "@/lib/config"
import { consumeTakeoffRateLimit } from "@/lib/request-rate-limit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { takeoffDraftSchema } from "@/lib/takeoff-schemas"
import { buildTakeoffInstructions } from "@/lib/takeoff-instructions"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const [user, profile, features] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    getAppFeatures(),
  ])

  if (!user || !profile) return jsonError("Log in to create a takeoff.", 401)
  if (profile.status !== "active") {
    return jsonError("This workspace is not active.", 403)
  }
  if (features.configurationError) {
    return jsonError("Takeoff settings are temporarily unavailable.", 503)
  }
  if (features.maintenance) {
    return jsonError(features.maintenanceMessage, 503)
  }

  const body = await request.json().catch(() => null)
  const parsed = takeoffDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the project details.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  if (parsed.data.mode === "sample" && parsed.data.trades.length !== 1) {
    return jsonError("A free sample covers exactly one trade.", 422)
  }
  if (parsed.data.mode === "sample" && !features.freeSample) {
    return jsonError("The free sample is currently unavailable.", 403)
  }

  if (parsed.data.mode === "sample" && profile.free_sample_used_at) {
    return jsonError("The free sample for this workspace has already been used.", 409)
  }

  const supabase = createSupabaseAdminClient()
  let rateLimit: Awaited<ReturnType<typeof consumeTakeoffRateLimit>>
  try {
    rateLimit = await consumeTakeoffRateLimit({
      supabase,
      request,
      userId: user.id,
      action: "create_takeoff",
    })
  } catch {
    return jsonError("Request limits are temporarily unavailable.", 503)
  }
  if (!rateLimit.allowed) {
    const response = jsonError(
      "Too many new takeoff requests. Try again later.",
      429
    )
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds))
    return response
  }

  const { count: outstandingCount, error: outstandingError } = await supabase
    .from("takeoff_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["awaiting_upload", "ready"])

  if (outstandingError) {
    return jsonError("Could not verify the upload queue.", 503)
  }
  if ((outstandingCount ?? 0) >= 3) {
    return jsonError(
      "Finish or wait for an existing upload before creating another takeoff.",
      429
    )
  }

  const idempotencyKey = crypto.randomUUID()
  const { data: job, error: jobError } = await supabase
    .from("takeoff_jobs")
    .insert({
      user_id: user.id,
      idempotency_key: idempotencyKey,
      project_name: parsed.data.projectName,
      trades: parsed.data.trades,
      sample_page:
        parsed.data.mode === "sample" ? parsed.data.samplePage ?? 1 : null,
      status: "awaiting_upload",
      priority: "standard",
      discipline: parsed.data.trades.join(","),
      customer_notes: parsed.data.notes || null,
      instructions: buildTakeoffInstructions({
        projectName: parsed.data.projectName,
        trades: parsed.data.trades,
        customerNotes: parsed.data.notes,
        samplePage:
          parsed.data.mode === "sample" ? parsed.data.samplePage ?? 1 : null,
      }),
      input_file_count: 1,
      free_sample: parsed.data.mode === "sample",
      result_summary: {
        original_size_bytes: parsed.data.sizeBytes,
      },
    })
    .select("*")
    .single()

  if (jobError || !job) {
    const limited = jobError?.message.includes("existing upload")
    return jsonError(
      jobError?.message ?? "Could not create the takeoff.",
      limited ? 429 : 500
    )
  }

  const storagePath = `${user.id}/${job.id}/${crypto.randomUUID()}.pdf`
  const { data: signed, error: signError } = await supabase.storage
    .from(takeoffUploadBucket)
    .createSignedUploadUrl(storagePath, { upsert: false })

  if (signError || !signed) {
    await supabase.from("takeoff_jobs").delete().eq("id", job.id)
    return jsonError(signError?.message ?? "Could not prepare the upload.", 500)
  }

  const { error: fileError } = await supabase.from("takeoff_files").insert({
    job_id: job.id,
    user_id: user.id,
    bucket: takeoffUploadBucket,
    storage_path: storagePath,
    original_filename: parsed.data.filename,
    file_role: "input",
    mime_type: "application/pdf",
    size_bytes: parsed.data.sizeBytes,
  })

  if (fileError) {
    await supabase.from("takeoff_jobs").delete().eq("id", job.id)
    return jsonError(fileError.message, 500)
  }

  await Promise.all([
    supabase.from("takeoff_job_events").insert({
      job_id: job.id,
      user_id: user.id,
      event_type: "draft_created",
      from_status: null,
      to_status: "awaiting_upload",
      actor_type: "user",
      actor_user_id: user.id,
      message: "Takeoff draft created; waiting for the plan upload.",
    }),
    supabase.from("analytics_events").insert({
      user_id: user.id,
      job_id: job.id,
      event_name: "takeoff_draft_created",
      country_code: normalizedHeader(request, "x-vercel-ip-country", 2),
      region: normalizedHeader(request, "x-vercel-ip-country-region", 120),
      city: normalizedHeader(request, "x-vercel-ip-city", 120),
      source: "product",
      metadata: {
        mode: parsed.data.mode,
        trades: parsed.data.trades,
      },
    }),
  ])

  return NextResponse.json(
    {
      job: { id: job.id, status: job.status },
      upload: {
        bucket: takeoffUploadBucket,
        path: storagePath,
        token: signed.token,
      },
    },
    { status: 201 }
  )
}

function normalizedHeader(
  request: NextRequest,
  name: string,
  maxLength: number
) {
  const value = request.headers.get(name)?.trim()
  return value ? decodeURIComponent(value).slice(0, maxLength) : null
}
