import { NextResponse } from "next/server"
import { getClaimedTakeoff } from "@/lib/internal-worker"
import { jsonError } from "@/lib/http"
import { persistAndAuditTakeoffProcessorUsage } from "@/lib/internal-takeoff-processor-usage"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const contextResult = await getClaimedTakeoff(request, id, [
    "processing",
    "completed",
  ])
  if (contextResult instanceof Response) return contextResult
  const { job, supabase } = contextResult
  const body = await request.json().catch(() => null)

  if (
    !body ||
    !body.metrics ||
    typeof body.metrics !== "object" ||
    Array.isArray(body.metrics) ||
    !Array.isArray(body.artifacts)
  ) {
    return jsonError("Invalid completion payload.", 422)
  }

  // Usage is internal operational telemetry. A storage/schema failure must
  // never turn already-verified customer artifacts into another paid model
  // run; completion remains authoritative and usage can be reconciled later.
  await persistAndAuditTakeoffProcessorUsage({
    supabase,
    jobId: job.id,
    userId: job.user_id,
    claimToken: contextResult.worker.claimToken,
    workerId: contextResult.worker.workerId,
    processorJobId: job.processor_job_id,
    value: body.processorUsage,
    usageRequired: true,
    terminalAction: "complete",
  })

  if (job.status === "completed") {
    return NextResponse.json({ job })
  }
  if (job.status !== "processing") {
    return jsonError("Only a processing takeoff can be completed.", 409)
  }

  const { data: updated, error } = await supabase.rpc(
    "complete_takeoff_job",
    {
      p_job_id: job.id,
      p_worker_id: contextResult.worker.workerId,
      p_claim_token: contextResult.worker.claimToken,
      p_idempotency_key: `settle:automation:${job.id}`,
      p_result_summary: {
        metrics: body.metrics,
        artifact_count: body.artifacts.length,
      },
    }
  )

  if (error || !updated) {
    return jsonError(error?.message ?? "Could not complete the takeoff.", 409)
  }

  return NextResponse.json({ job: updated })
}
