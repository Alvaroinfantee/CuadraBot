import { createHash, randomBytes } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import {
  drywallUploadBucket,
  getRequiredEnv,
} from "@/lib/config"
import { hashDrywallDraftToken } from "@/lib/drywall-portal"
import { drywallDraftSchema } from "@/lib/drywall-takeoff-schemas"
import { jsonError, sanitizePdfFilename } from "@/lib/http"
import { consumeTakeoffRateLimit } from "@/lib/request-rate-limit"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getSupabaseResumableUploadEndpoint } from "@/lib/supabase/storage-endpoint"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const bodyResult = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.drywallDraftJson
  )
  if (!bodyResult.ok) {
    return jsonError(
      bodyResult.reason === "too_large"
        ? "La solicitud es demasiado grande."
        : "No se pudo leer la solicitud.",
      bodyResult.reason === "too_large" ? 413 : 400
    )
  }

  const parsed = drywallDraftSchema.safeParse(bodyResult.value)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisa los datos del proyecto.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const supabase = createSupabaseAdminClient()
  const emailNormalized = parsed.data.email.toLowerCase()
  const emailDigest = createHash("sha256").update(emailNormalized).digest("hex")
  try {
    const limit = await consumeTakeoffRateLimit({
      supabase,
      request,
      userId: emailDigest,
      action: "create_drywall_order",
    })
    if (!limit.allowed) {
      const response = jsonError(
        "Demasiados intentos de pedido. Inténtalo de nuevo más tarde.",
        429
      )
      response.headers.set("Retry-After", String(limit.retryAfterSeconds))
      return response
    }
  } catch {
    return jsonError("La protección del formulario no está disponible.", 503)
  }

  const { data: customer, error: customerError } = await supabase
    .from("drywall_takeoff_customers")
    .upsert(
      {
        email: parsed.data.email,
        email_normalized: emailNormalized,
        company: parsed.data.company || null,
      },
      { onConflict: "email_normalized" }
    )
    .select("id")
    .single()
  if (customerError || !customer) {
    return jsonError("No se pudo preparar el cliente.", 503)
  }

  const accessToken = randomBytes(32).toString("base64url")
  const { data: project, error: projectError } = await supabase
    .from("drywall_takeoff_projects")
    .insert({
      customer_id: customer.id,
      draft_token_hash: hashDrywallDraftToken(accessToken),
      project_name: parsed.data.projectName,
      location: parsed.data.location,
      project_type: parsed.data.projectType,
      desired_bid_date: parsed.data.bidDate || null,
      customer_notes: parsed.data.notes || null,
      marketing_attribution: parsed.data.marketing,
      session_identifier: parsed.data.sessionId || null,
    })
    .select("id,status")
    .single()
  if (projectError || !project) {
    return jsonError("No se pudo crear el proyecto.", 503)
  }

  try {
    const prepared = []
    for (const source of parsed.data.files) {
      const fileId = crypto.randomUUID()
      const filename = sanitizePdfFilename(source.filename)
      const storagePath = `${project.id}/${fileId}-${filename}`
      const { error: fileError } = await supabase
        .from("drywall_takeoff_files")
        .insert({
          id: fileId,
          project_id: project.id,
          bucket: drywallUploadBucket,
          storage_path: storagePath,
          original_filename: source.filename,
          mime_type: "application/pdf",
          size_bytes: source.sizeBytes,
        })
      if (fileError) throw new Error(fileError.message)

      const { data: signed, error: signError } = await supabase.storage
        .from(drywallUploadBucket)
        .createSignedUploadUrl(storagePath, { upsert: false })
      if (signError || !signed?.token) {
        throw new Error(signError?.message ?? "Signed upload unavailable.")
      }
      prepared.push({
        fileId,
        filename: source.filename,
        bucket: drywallUploadBucket,
        path: storagePath,
        token: signed.token,
        endpoint: getSupabaseResumableUploadEndpoint(
          getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")
        ),
      })
    }

    await supabase.from("drywall_takeoff_events").insert({
      project_id: project.id,
      event_name: "draft_created",
      actor: "customer",
      metadata: {
        file_count: prepared.length,
        attribution: parsed.data.marketing,
      },
    })

    return NextResponse.json(
      {
        project: { id: project.id, status: project.status },
        accessToken,
        uploads: prepared,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    await supabase
      .from("drywall_takeoff_projects")
      .delete()
      .eq("id", project.id)
    console.error("Drywall draft preparation failed.", {
      projectId: project.id,
      error: error instanceof Error ? error.message : "unknown",
    })
    return jsonError("No se pudieron preparar las cargas privadas.", 503)
  }
}
