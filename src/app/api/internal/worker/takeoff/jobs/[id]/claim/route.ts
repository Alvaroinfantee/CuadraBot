import { NextResponse } from "next/server"
import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireWorker } from "@/lib/worker-auth"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const worker = requireWorker(request)
  if (!worker) return jsonError("Unauthorized worker request.", 401)

  const body = await request.json().catch(() => ({}))
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
  if (!data) return jsonError("Takeoff is no longer available.", 409)

  return NextResponse.json({ job: data })
}
