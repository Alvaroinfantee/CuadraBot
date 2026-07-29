import { NextResponse } from "next/server"
import { getClaimedTakeoff } from "@/lib/internal-worker"
import { jsonError } from "@/lib/http"
import {
  requestedScopesForTrades,
  takeoffWorkflowKind,
} from "@/lib/takeoff-workflow"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const { id } = await context.params
  const contextResult = await getClaimedTakeoff(request, id)
  if (contextResult instanceof Response) return contextResult
  const { job, supabase } = contextResult

  const { data: source, error } = await supabase
    .from("takeoff_files")
    .select("*")
    .eq("job_id", job.id)
    .eq("user_id", job.user_id)
    .eq("file_role", "input")
    .not("verified_at", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!source?.sha256) return jsonError("Verified source plan is missing.", 409)

  const { data: signed, error: signError } = await supabase.storage
    .from(source.bucket)
    .createSignedUrl(source.storage_path, 15 * 60)
  if (signError || !signed) {
    return jsonError(signError?.message ?? "Could not sign the source plan.", 500)
  }

  let requestedScopes
  try {
    requestedScopes = requestedScopesForTrades(job.trades)
  } catch {
    return jsonError("The takeoff has an unsupported trusted scope.", 409)
  }

  return NextResponse.json({
    job: {
      id: job.id,
      source_sha256: source.sha256,
      original_filename: source.original_filename,
      workflow_kind: takeoffWorkflowKind,
      requested_scopes: requestedScopes,
      customer_instructions: job.customer_notes ?? "",
      page_count: job.input_page_count,
      free_sample: job.free_sample,
    },
    signedUrl: signed.signedUrl,
  })
}
