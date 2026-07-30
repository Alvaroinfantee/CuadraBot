import { NextResponse } from "next/server"
import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireWorker } from "@/lib/worker-auth"

const healthStatuses = ["healthy", "degraded", "down"] as const
type HealthStatus = (typeof healthStatuses)[number]

export async function POST(request: Request) {
  const worker = requireWorker(request)
  if (!worker) return jsonError("Unauthorized worker request.", 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return jsonError("Invalid worker health report.", 422)
  }

  const workerStatus = parseStatus(body.workerStatus)
  const processorStatus = parseStatus(body.processorStatus)
  const ttlSeconds = body.ttlSeconds
  if (
    !workerStatus ||
    !processorStatus ||
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 60 ||
    ttlSeconds > 900
  ) {
    return jsonError("Invalid worker health report.", 422)
  }

  const checkedAt = new Date()
  const expiresAt = new Date(
    checkedAt.getTime() + ttlSeconds * 1_000
  ).toISOString()
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("service_health").upsert(
    [
      {
        service_name: "cuadrabot-worker",
        check_name: "poll-loop",
        status: workerStatus,
        message: optionalMessage(body.workerMessage),
        details: { worker_id: worker.workerId },
        checked_at: checkedAt.toISOString(),
        expires_at: expiresAt,
      },
      {
        service_name: "takeoff-processor",
        check_name: "readiness",
        status: processorStatus,
        message: optionalMessage(body.processorMessage),
        details: { reported_by_worker: worker.workerId },
        checked_at: checkedAt.toISOString(),
        expires_at: expiresAt,
      },
    ],
    { onConflict: "service_name,check_name" }
  )

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ reported: true, expiresAt })
}

function parseStatus(value: unknown): HealthStatus | null {
  return typeof value === "string" &&
    healthStatuses.includes(value as HealthStatus)
    ? (value as HealthStatus)
    : null
}

function optionalMessage(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 1_000)
    : null
}
