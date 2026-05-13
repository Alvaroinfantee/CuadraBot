import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { jsonError } from "@/lib/http"
import { requireWorker } from "@/lib/worker-auth"
import { workerStatusSchema } from "@/lib/schemas"

type Context = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export async function POST(request: Request, context: Context) {
  const worker = requireWorker(request)

  if (!worker) {
    return jsonError("Unauthorized worker request.", 401)
  }

  const body = await request.json().catch(() => null)
  const parsed = workerStatusSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid worker status payload.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  if (!["processing", "needs_review", "completed", "failed"].includes(parsed.data.status)) {
    return jsonError("Worker cannot set that order status.", 403)
  }

  const { id } = await context.params
  const supabase = createSupabaseAdminClient()
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,assigned_worker_id")
    .eq("id", id)
    .maybeSingle()

  if (orderError) {
    return jsonError(orderError.message, 500)
  }

  if (!order || order.assigned_worker_id !== worker.workerId) {
    return jsonError("Worker has not claimed this job.", 403)
  }

  const completedAt =
    parsed.data.status === "completed" || parsed.data.status === "failed"
      ? new Date().toISOString()
      : null

  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({
      status: parsed.data.status,
      completed_at: parsed.data.status === "completed" ? completedAt : undefined,
    })
    .eq("id", id)
    .select("*")
    .single()

  if (updateError) {
    return jsonError(updateError.message, 500)
  }

  await supabase.from("worker_runs").insert({
    worker_id: worker.workerId,
    order_id: id,
    status: parsed.data.status,
    completed_at: completedAt,
    error_message: parsed.data.error_message ?? null,
    logs: parsed.data.logs ?? null,
  })

  return NextResponse.json({ job: updatedOrder })
}
