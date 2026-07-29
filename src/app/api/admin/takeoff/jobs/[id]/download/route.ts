import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  await requireAdmin()
  const { id } = await context.params
  const fileId = new URL(request.url).searchParams.get("file")
  if (!fileId) return jsonError("Choose a file.", 400)

  const supabase = createSupabaseAdminClient()
  const { data: file, error } = await supabase
    .from("takeoff_files")
    .select("bucket,storage_path,file_role")
    .eq("id", fileId)
    .eq("job_id", id)
    .maybeSingle()
  if (error) return jsonError(error.message, 500)
  if (!file || file.file_role === "input") {
    return jsonError("Use the audited source archive for original plans.", 404)
  }

  const { data, error: signError } = await supabase.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 5 * 60, { download: true })
  if (signError || !data) {
    return jsonError(signError?.message ?? "Could not sign the file.", 500)
  }
  return NextResponse.redirect(data.signedUrl)
}
