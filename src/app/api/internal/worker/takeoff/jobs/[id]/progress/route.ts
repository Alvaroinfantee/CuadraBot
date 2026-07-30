import { NextResponse } from "next/server"
import { getClaimedTakeoff } from "@/lib/internal-worker"
import { takeoffProgressSchema } from "@/lib/takeoff-schemas"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const contextResult = await getClaimedTakeoff(request, id)
  if (contextResult instanceof Response) return contextResult
  const { job, supabase } = contextResult

  const body = await request.json().catch(() => null)
  const parsed = takeoffProgressSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid progress payload.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { data: updated, error } = await supabase
    .from("takeoff_jobs")
    .update({
      progress: Math.min(parsed.data.progress, 89),
      stage: parsed.data.stage,
      processor_job_id:
        parsed.data.microserviceJobId ?? job.processor_job_id ?? null,
    })
    .eq("id", job.id)
    .eq("claimed_by", contextResult.worker.workerId)
    .eq("claim_token", contextResult.worker.claimToken)
    .eq("status", "processing")
    .select("id")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json(
      { error: "The takeoff is no longer processing." },
      { status: 409 }
    )
  }

  if (parsed.data.message) {
    await supabase.from("takeoff_job_events").insert({
      job_id: job.id,
      user_id: job.user_id,
      event_type: "processing_progress",
      from_status: "processing",
      to_status: "processing",
      actor_type: "service",
      message: parsed.data.message,
      metadata: {
        stage: parsed.data.stage,
        progress: parsed.data.progress,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
