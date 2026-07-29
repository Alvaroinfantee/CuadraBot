import { NextResponse } from "next/server"
import { getActiveUser } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { getRequestLocale } from "@/lib/i18n-server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const [user, locale] = await Promise.all([
    getActiveUser(),
    getRequestLocale(),
  ])
  const copy =
    locale === "es"
      ? {
          login: "Inicia sesión para descargar archivos.",
          choose: "Selecciona un archivo.",
          notFound: "No se encontró el entregable.",
          internal: "No se pudo consultar el entregable.",
          processing:
            "Los entregables estarán disponibles cuando termine el procesamiento.",
          unavailable: "Los entregables actuales no están disponibles.",
          prepare: "No se pudo preparar la descarga.",
        }
      : {
          login: "Log in to download files.",
          choose: "Choose a file.",
          notFound: "Deliverable not found.",
          internal: "Could not read the deliverable.",
          processing:
            "Deliverables are released after processing completes.",
          unavailable: "Current deliverables are not available.",
          prepare: "Could not prepare the download.",
        }
  if (!user) return jsonError(copy.login, 401)

  const { id } = await context.params
  const fileId = new URL(request.url).searchParams.get("file")
  if (!fileId) return jsonError(copy.choose, 400)

  const supabase = createSupabaseAdminClient()
  const { data: job, error: jobError } = await supabase
    .from("takeoff_jobs")
    .select("id,status,claim_token")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (jobError) return jsonError(copy.internal, 500)
  if (!job) return jsonError(copy.notFound, 404)

  let deliverablesAvailable = job.status === "completed"
  if (job.status === "needs_review") {
    const { count, error: eventError } = await supabase
      .from("takeoff_job_events")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job.id)
      .eq("user_id", user.id)
      .eq("event_type", "correction_requested")
    if (eventError) return jsonError(copy.internal, 500)
    deliverablesAvailable = (count ?? 0) > 0
  }
  if (!deliverablesAvailable) {
    return jsonError(copy.processing, 409)
  }
  if (!job.claim_token) {
    return jsonError(copy.unavailable, 409)
  }

  const { data: file, error } = await supabase
    .from("takeoff_files")
    .select("id,bucket,storage_path,file_role")
    .eq("id", fileId)
    .eq("job_id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return jsonError(copy.internal, 500)
  if (!file || file.file_role === "input") {
    return jsonError(copy.notFound, 404)
  }
  const currentResultsPrefix =
    `${user.id}/${job.id}/results/${job.claim_token}/`
  if (!file.storage_path.startsWith(currentResultsPrefix)) {
    return jsonError(copy.notFound, 404)
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 5 * 60, { download: true })

  if (signError || !signed) {
    return jsonError(copy.prepare, 500)
  }

  return NextResponse.redirect(signed.signedUrl)
}
