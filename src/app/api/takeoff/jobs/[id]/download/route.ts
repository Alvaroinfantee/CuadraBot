import { NextResponse } from "next/server"
import { getActiveUser } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const user = await getActiveUser()
  if (!user) return jsonError("Log in to download files.", 401)

  const { id } = await context.params
  const fileId = new URL(request.url).searchParams.get("file")
  if (!fileId) return jsonError("Choose a file.", 400)

  const supabase = createSupabaseAdminClient()
  const { data: job, error: jobError } = await supabase
    .from("takeoff_jobs")
    .select("id,status,claim_token")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (jobError) return jsonError(jobError.message, 500)
  if (!job) return jsonError("Deliverable not found.", 404)

  let deliverablesAvailable = job.status === "completed"
  if (job.status === "needs_review") {
    const { count, error: eventError } = await supabase
      .from("takeoff_job_events")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job.id)
      .eq("user_id", user.id)
      .eq("event_type", "correction_requested")
    if (eventError) return jsonError(eventError.message, 500)
    deliverablesAvailable = (count ?? 0) > 0
  }
  if (!deliverablesAvailable) {
    return jsonError("Deliverables are released after processing completes.", 409)
  }
  if (!job.claim_token) {
    return jsonError("Current deliverables are not available.", 409)
  }

  const { data: file, error } = await supabase
    .from("takeoff_files")
    .select("id,bucket,storage_path,file_role")
    .eq("id", fileId)
    .eq("job_id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!file || file.file_role === "input") {
    return jsonError("Deliverable not found.", 404)
  }
  const currentResultsPrefix =
    `${user.id}/${job.id}/results/${job.claim_token}/`
  if (!file.storage_path.startsWith(currentResultsPrefix)) {
    return jsonError("Deliverable not found.", 404)
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 5 * 60, { download: true })

  if (signError || !signed) {
    return jsonError(signError?.message ?? "Could not prepare the download.", 500)
  }

  return NextResponse.redirect(signed.signedUrl)
}
