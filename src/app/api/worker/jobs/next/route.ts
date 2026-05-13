import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { jsonError } from "@/lib/http"
import { requireWorker } from "@/lib/worker-auth"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const worker = requireWorker(request)

  if (!worker) {
    return jsonError("Unauthorized worker request.", 401)
  }

  const key = `${worker.workerId}:next`
  if (!checkRateLimit(key, 120, 60_000)) {
    return jsonError("Worker poll rate limit exceeded.", 429)
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,public_token,order_number,customer_email,package_id,status,render_type,project_type,style_preference,number_of_floors,estimated_square_meters,customer_notes,deadline_preference,assigned_worker_id,created_at"
    )
    .eq("status", "paid_pending_processing")
    .is("assigned_worker_id", null)
    .order("paid_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ job: data ?? null })
}
