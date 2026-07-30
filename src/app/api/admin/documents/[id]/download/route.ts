import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { jsonError, sanitizePdfFilename } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, context: Context) {
  const admin = await requireAdmin()
  const { id } = await context.params
  if (!uuidPattern.test(id)) return jsonError("Document not found.", 404)

  const supabase = createSupabaseAdminClient()
  const { data: archive, error } = await supabase
    .from("document_archives")
    .select(
      "id,job_id,user_id,bucket,storage_path,original_filename,status,integrity_status,deleted_at"
    )
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("Could not read archived document", {
      archiveId: id,
      error: error.message,
    })
    return jsonError("Could not retrieve the document.", 500)
  }
  if (!archive || archive.deleted_at || archive.status === "deleted") {
    return jsonError("Document not found.", 404)
  }
  if (archive.status === "deleting") {
    return jsonError("Document deletion is in progress.", 409)
  }
  if (archive.integrity_status === "missing") {
    return jsonError(
      "The archived file is marked missing and cannot be downloaded.",
      409
    )
  }

  const expectedPrefix = `${archive.user_id}/${archive.job_id}/`
  if (
    archive.bucket !== "takeoff-uploads" ||
    !archive.storage_path.startsWith(expectedPrefix)
  ) {
    console.error("Archived document path failed namespace validation", {
      archiveId: archive.id,
    })
    return jsonError("The archived file failed a security check.", 409)
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(archive.bucket)
    .createSignedUrl(archive.storage_path, 5 * 60, {
      download: sanitizePdfFilename(archive.original_filename),
    })
  if (signError || !signed) {
    console.error("Could not sign archived document", {
      archiveId: archive.id,
      error: signError?.message,
    })
    return jsonError("Could not prepare the document download.", 500)
  }

  const { error: auditError } = await supabase
    .from("admin_audit_log")
    .insert({
      actor_user_id: admin.id,
      actor_email: admin.email,
      action: "document_archive.downloaded",
      target_type: "document_archive",
      target_id: archive.id,
      reason: "Downloaded from the secure document archive.",
      after_state: {
        job_id: archive.job_id,
        user_id: archive.user_id,
        original_filename: archive.original_filename,
      },
    })
  if (auditError) {
    console.error("Archived document download audit failed", {
      archiveId: archive.id,
      error: auditError.message,
    })
    return jsonError(
      "The download was blocked because the audit entry could not be recorded.",
      500
    )
  }

  const response = NextResponse.redirect(signed.signedUrl)
  response.headers.set("Cache-Control", "private, no-store, max-age=0")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
