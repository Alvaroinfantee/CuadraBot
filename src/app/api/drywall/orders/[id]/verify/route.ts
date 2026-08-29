import { NextResponse } from "next/server"
import {
  drywallMaxUploadBytes,
} from "@/lib/config"
import { verifyDrywallDraftToken } from "@/lib/drywall-portal"
import { drywallTokenSchema } from "@/lib/drywall-takeoff-schemas"
import { jsonError } from "@/lib/http"
import {
  PdfVerificationError,
  verifyPdfStream,
} from "@/lib/pdf-verification"
import { consumeTakeoffRateLimit } from "@/lib/request-rate-limit"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const bodyResult = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.drywallVerifyJson
  )
  const parsed = drywallTokenSchema.safeParse(
    bodyResult.ok ? bodyResult.value : null
  )
  if (!parsed.success) return jsonError("La sesión del pedido no es válida.", 401)

  const supabase = createSupabaseAdminClient()
  const { data: project, error: projectError } = await supabase
    .from("drywall_takeoff_projects")
    .select("id,draft_token_hash,status")
    .eq("id", id)
    .maybeSingle()
  if (
    projectError ||
    !project ||
    !verifyDrywallDraftToken(project.draft_token_hash, parsed.data.accessToken)
  ) {
    return jsonError("No se encontró el pedido.", 404)
  }
  if (project.status === "awaiting_payment") {
    const { data: verifiedFiles, error: verifiedFilesError } = await supabase
      .from("drywall_takeoff_files")
      .select("id,original_filename,size_bytes,page_count,verified_sha256,upload_status")
      .eq("project_id", id)
      .order("created_at", { ascending: true })
    if (
      verifiedFilesError ||
      !verifiedFiles?.length ||
      verifiedFiles.some(
        (file) =>
          file.upload_status !== "verified" ||
          !file.page_count ||
          !file.verified_sha256
      )
    ) {
      return jsonError("La verificación guardada está incompleta.", 409)
    }
    return NextResponse.json({
      project: { id, status: project.status },
      files: verifiedFiles.map((file) => ({
        id: file.id,
        filename: file.original_filename,
        sizeBytes: file.size_bytes,
        pageCount: file.page_count,
        checksum: file.verified_sha256,
      })),
    })
  }
  if (project.status !== "upload_incomplete") {
    return jsonError("Este pedido ya no admite nuevas verificaciones.", 409)
  }

  try {
    const limit = await consumeTakeoffRateLimit({
      supabase,
      request,
      userId: id,
      action: "verify_drywall_order",
    })
    if (!limit.allowed) {
      const response = jsonError(
        "Demasiados intentos de verificación. Inténtalo más tarde.",
        429
      )
      response.headers.set("Retry-After", String(limit.retryAfterSeconds))
      return response
    }
  } catch {
    return jsonError("La verificación no está disponible.", 503)
  }

  const { data: files, error: filesError } = await supabase
    .from("drywall_takeoff_files")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true })
  if (filesError || !files?.length) {
    return jsonError("No se encontraron los planos del pedido.", 409)
  }

  let totalBytes = 0
  const verifiedFiles: Array<{
    id: string
    filename: string
    sizeBytes: number
    pageCount: number
    checksum: string
  }> = []
  try {
    for (const file of files) {
      const { data: signed, error: signError } = await supabase.storage
        .from(file.bucket)
        .createSignedUrl(file.storage_path, 5 * 60)
      if (signError || !signed?.signedUrl) {
        throw new Error("No se pudo leer uno de los planos cargados.")
      }

      const download = await fetch(signed.signedUrl, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5 * 60 * 1000),
      })
      if (!download.ok || !download.body) {
        throw new Error("No se pudo descargar uno de los planos cargados.")
      }

      const verified = await verifyPdfStream(download.body, {
        maxBytes: drywallMaxUploadBytes,
        maxPages: 500,
      })
      totalBytes += verified.originalSizeBytes
      if (
        verified.originalSizeBytes !== file.size_bytes
      ) {
        throw new Error(
          `${file.original_filename}: el archivo recibido no coincide con la verificación del navegador.`
        )
      }

      const { error: updateError } = await supabase
        .from("drywall_takeoff_files")
        .update({
          upload_status: "verified",
          verified_sha256: verified.originalSha256,
          page_count: verified.originalPageCount,
          verified_at: new Date().toISOString(),
        })
        .eq("id", file.id)
      if (updateError) throw new Error(updateError.message)
      verifiedFiles.push({
        id: file.id,
        filename: file.original_filename,
        sizeBytes: verified.originalSizeBytes,
        pageCount: verified.originalPageCount,
        checksum: verified.originalSha256,
      })
    }
    if (totalBytes > drywallMaxUploadBytes) {
      throw new Error("El conjunto de planos supera el límite total de carga.")
    }
  } catch (error) {
    const message =
      error instanceof PdfVerificationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo verificar el PDF."
    await supabase
      .from("drywall_takeoff_files")
      .update({ upload_status: "rejected", rejection_reason: message })
      .eq("project_id", id)
      .neq("upload_status", "verified")
    return jsonError(message, 422)
  }

  const { error: updateProjectError } = await supabase
    .from("drywall_takeoff_projects")
    .update({ status: "awaiting_payment" })
    .eq("id", id)
    .eq("status", "upload_incomplete")
  if (updateProjectError) return jsonError("No se pudo finalizar la carga.", 503)

  await supabase.from("drywall_takeoff_events").insert({
    project_id: id,
    event_name: "uploads_verified",
    actor: "system",
    metadata: { file_count: files.length, size_bytes: totalBytes },
  })

  return NextResponse.json(
    {
      project: { id, status: "awaiting_payment" },
      files: verifiedFiles,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
