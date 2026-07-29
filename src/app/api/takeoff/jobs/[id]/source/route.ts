import { NextResponse } from "next/server"
import { getActiveUser } from "@/lib/auth"
import { jsonError, sanitizePdfFilename } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const user = await getActiveUser()
  if (!user) return jsonError("Log in to download the source plan.", 401)

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

  if (error) return jsonError(error.message, 500)
  if (!archive || archive.status === "deleted") {
    return jsonError("Archived source plan not found.", 404)
  }
  if (
    archive.status === "deletion_requested" ||
    archive.status === "deleting"
  ) {
    return jsonError(
      "This source plan is in an approved deletion workflow and is no longer available for customer download.",
      409
    )
  }
  if (archive.integrity_status === "missing") {
    return jsonError(
      "The archived source plan is temporarily unavailable. Support has been alerted.",
      503
    )
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(archive.bucket)
    .createSignedUrl(archive.storage_path, 5 * 60, {
      download: sanitizePdfFilename(archive.original_filename),
    })
  if (signError || !signed) {
    return jsonError(
      signError?.message ?? "Could not prepare the source-plan download.",
      500
    )
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
