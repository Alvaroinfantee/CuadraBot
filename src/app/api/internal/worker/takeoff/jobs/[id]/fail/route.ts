import { NextResponse } from "next/server"
import { getClaimedTakeoff } from "@/lib/internal-worker"
import { persistAndAuditTakeoffProcessorUsage } from "@/lib/internal-takeoff-processor-usage"
import { takeoffFailureSchema } from "@/lib/takeoff-schemas"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const contextResult = await getClaimedTakeoff(request, id)
  if (contextResult instanceof Response) return contextResult
  const { job, supabase } = contextResult
  const body = await request.json().catch(() => null)
  const parsed = takeoffFailureSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid failure payload.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  // Failure settlement must still release/reconcile credits if usage storage
  // is temporarily unavailable. Valid usage is recorded first when possible.
  await persistAndAuditTakeoffProcessorUsage({
    supabase,
    jobId: job.id,
    userId: job.user_id,
    claimToken: contextResult.worker.claimToken,
    workerId: contextResult.worker.workerId,
    processorJobId: job.processor_job_id,
    value:
      body && typeof body === "object" && "processorUsage" in body
        ? body.processorUsage
        : null,
    usageRequired: false,
    terminalAction: "fail",
  })

  const { data: updated, error } = await supabase
    .rpc("fail_takeoff_job", {
      p_job_id: job.id,
      p_worker_id: contextResult.worker.workerId,
      p_claim_token: contextResult.worker.claimToken,
      p_stage: parsed.data.stage,
      p_message: parsed.data.message,
      p_retryable: parsed.data.retryable,
      p_force_terminal: false,
      p_idempotency_key: `release:worker-failure:${job.id}`,
      p_stale_before: null,
    })

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Could not record the processing failure." },
      { status: 409 }
    )
  }

  return NextResponse.json({ job: updated })
}
