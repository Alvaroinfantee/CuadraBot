import { NextResponse } from "next/server"
import { getCurrentProfile } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string; fileId: string }> }
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: Context) {
  const admin = await getCurrentProfile()
  if (!admin || admin.role !== "admin" || admin.status !== "active") return jsonError("Admin access is required.", 403)
  const { id, fileId } = await context.params
  const supabase = createSupabaseAdminClient()
  const { data: file } = await supabase.from("drywall_takeoff_files").select("bucket,storage_path,original_filename").eq("id", fileId).eq("project_id", id).eq("upload_status", "verified").maybeSingle()
  if (!file) return jsonError("Source file not found.", 404)
  const { data: signed, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.storage_path, 5 * 60, { download: file.original_filename })
  if (error || !signed?.signedUrl) return jsonError("Could not prepare the source download.", 503)
  await supabase.from("drywall_takeoff_events").insert({ project_id: id, event_name: "source_downloaded", actor: admin.email ?? admin.id, metadata: { file_id: fileId } })
  return NextResponse.redirect(signed.signedUrl, 303)
}
