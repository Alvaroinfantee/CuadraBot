import { NextResponse } from "next/server"
import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { normalizeTakeoffJobClaimResult } from "@/lib/takeoff-job-claim"
import { requireWorker } from "@/lib/worker-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const worker = requireWorker(request)
  if (!worker) return jsonError("Unauthorized worker request.", 401)

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc("claim_next_takeoff_job", {
    p_worker_id: worker.workerId,
  })

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ job: normalizeTakeoffJobClaimResult(data) })
}
