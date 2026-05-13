import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { jsonError } from "@/lib/http"
import { requireWorker } from "@/lib/worker-auth"

type Context = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function POST(request: Request, context: Context) {
  const worker = requireWorker(request)

  if (!worker) {
    return jsonError("Unauthorized worker request.", 401)
  }

  const { id } = await context.params
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc("claim_order_for_worker", {
    order_id_input: id,
    worker_id_input: worker.workerId,
  })

  if (error) {
    return jsonError(error.message, 500)
  }

  if (!data) {
    return jsonError("Job is no longer available to claim.", 409)
  }

  return NextResponse.json({ job: data })
}
