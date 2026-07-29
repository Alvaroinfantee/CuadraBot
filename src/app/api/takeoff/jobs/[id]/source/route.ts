import { NextResponse } from "next/server"
import { getActiveUser } from "@/lib/auth"
import { jsonError, sanitizePdfFilename } from "@/lib/http"
import { getRequestLocale } from "@/lib/i18n-server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const [user, locale] = await Promise.all([
    getActiveUser(),
    getRequestLocale(),
  ])
  const copy =
    locale === "es"
      ? {
          login: "Inicia sesión para descargar el plano original.",
          notFound: "No se encontró el plano original archivado.",
          internal: "No se pudo consultar el plano original archivado.",
          deleting:
            "Este plano original está en un proceso de eliminación aprobado y ya no se puede descargar.",
          missing:
            "El plano original archivado no está disponible temporalmente. Se ha avisado al equipo de soporte.",
          prepare: "No se pudo preparar la descarga del plano original.",
        }
      : {
          login: "Log in to download the source plan.",
          notFound: "Archived source plan not found.",
          internal: "Could not read the archived source plan.",
          deleting:
            "This source plan is in an approved deletion workflow and is no longer available for customer download.",
          missing:
            "The archived source plan is temporarily unavailable. Support has been alerted.",
          prepare: "Could not prepare the source-plan download.",
        }
  if (!user) return jsonError(copy.login, 401)

  const { id } = await context.params
  const supabase = createSupabaseAdminClient()
  const { data: archive, error } = await supabase
    .from("document_archives")
    .select(
      "id,bucket,storage_path,original_filename,status,integrity_status"
    )
    .eq("job_id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return jsonError(copy.internal, 500)
  if (!archive || archive.status === "deleted") {
    return jsonError(copy.notFound, 404)
  }
  if (
    archive.status === "deletion_requested" ||
    archive.status === "deleting"
  ) {
    return jsonError(copy.deleting, 409)
  }
  if (archive.integrity_status === "missing") {
    return jsonError(copy.missing, 503)
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(archive.bucket)
    .createSignedUrl(archive.storage_path, 5 * 60, {
      download: sanitizePdfFilename(archive.original_filename),
    })
  if (signError || !signed) {
    return jsonError(copy.prepare, 500)
  }

  await supabase.from("analytics_events").insert({
    user_id: user.id,
    job_id: id,
    event_name: "source_plan_downloaded",
    source: "product",
    metadata: { archive_id: archive.id },
  })

  const response = NextResponse.redirect(signed.signedUrl)
  response.headers.set("Cache-Control", "private, no-store, max-age=0")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
