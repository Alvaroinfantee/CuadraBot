import { NextResponse } from "next/server"
import { jsonError } from "@/lib/http"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { normalizeTakeoffJobClaimResult } from "@/lib/takeoff-job-claim"
import { requireWorker } from "@/lib/worker-auth"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const worker = requireWorker(request)
  if (!worker) return jsonError("Unauthorized worker request.", 401)

  const bodyResult = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.workerClaimJson
  )
  if (!bodyResult.ok && bodyResult.reason === "too_large") {
    return jsonError("Worker claim payload is too large.", 413)
  }
  const body =
    bodyResult.ok &&
    bodyResult.value &&
    typeof bodyResult.value === "object" &&
    !Array.isArray(bodyResult.value)
      ? (bodyResult.value as Record<string, unknown>)
      : {}
  if (typeof body.workerId === "string" && body.workerId !== worker.workerId) {
    return jsonError("Worker identity does not match the signed request.", 403)
  }

  const { id } = await context.params
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc("claim_takeoff_job", {
    p_job_id: id,
    p_worker_id: worker.workerId,
  })

  if (error) return jsonError(error.message, 500)
  const job = normalizeTakeoffJobClaimResult(data)
  if (!job) return jsonError("Takeoff is no longer available.", 409)

  return NextResponse.json({ job })
}
