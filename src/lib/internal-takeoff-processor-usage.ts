import "server-only"

import { takeoffProcessorUsageHealthCheck } from "@/lib/admin-analytics"
import type { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { parseTakeoffProcessorUsage } from "@/lib/takeoff-processor-usage"

type AdminClient = ReturnType<typeof createSupabaseAdminClient>
type TerminalAction = "complete" | "fail"
type PersistenceStatus = "absent" | "invalid" | "error" | "recorded"

const usageAlertDedupePrefix = "takeoff-processor-usage:"
const usageHealthTtlMs = 30 * 24 * 60 * 60 * 1_000

export async function persistAndAuditTakeoffProcessorUsage({
  supabase,
  jobId,
  userId,
  claimToken,
  workerId,
  processorJobId,
  value,
  usageRequired,
  terminalAction,
}: {
  supabase: AdminClient
  jobId: string
  userId: string
  claimToken: string
  workerId: string
  processorJobId: string | null
  value: unknown
  usageRequired: boolean
  terminalAction: TerminalAction
}) {
  const outcome = await persistTakeoffProcessorUsage({
    supabase,
    jobId,
    claimToken,
    workerId,
    processorJobId,
    value,
  })

  const context = {
    supabase,
    jobId,
    userId,
    claimToken,
    workerId,
    processorJobId,
    terminalAction,
  }

  if (outcome.status === "recorded") {
    await reportRecordedUsage(context)
  } else if (outcome.status !== "absent" || usageRequired) {
    await reportUsageIssue({ ...context, status: outcome.status })
  }

  return outcome
}

export async function persistTakeoffProcessorUsage({
  supabase,
  jobId,
  claimToken,
  workerId,
  processorJobId,
  value,
}: {
  supabase: AdminClient
  jobId: string
  claimToken: string
  workerId: string
  processorJobId: string | null
  value: unknown
}) {
  if (value === null || value === undefined) {
    return { status: "absent" as const }
  }

  const parsed = parseTakeoffProcessorUsage(value)
  if (!parsed.success) return { status: "invalid" as const }

  try {
    const { error } = await supabase
      .from("takeoff_processor_usage")
      .upsert(
        {
          job_id: jobId,
          claim_token: claimToken,
          worker_id: workerId,
          processor_job_id: processorJobId,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "job_id,claim_token" }
      )

    return error
      ? { status: "error" as const }
      : { status: "recorded" as const }
  } catch {
    return { status: "error" as const }
  }
}

async function reportUsageIssue({
  supabase,
  jobId,
  userId,
  claimToken,
  workerId,
  processorJobId,
  terminalAction,
  status,
}: {
  supabase: AdminClient
  jobId: string
  userId: string
  claimToken: string
  workerId: string
  processorJobId: string | null
  terminalAction: TerminalAction
  status: Exclude<PersistenceStatus, "recorded">
}) {
  const metadata = {
    persistence_status: status,
    terminal_action: terminalAction,
    worker_id: workerId,
    processor_job_id: processorJobId,
  }

  try {
    await createOrTouchUsageAlert({
      supabase,
      jobId,
      userId,
      claimToken,
      metadata,
    })
  } catch (error) {
    console.error(
      `[${jobId}] processor usage alert could not be recorded`,
      safeErrorMessage(error)
    )
  }

  try {
    await writeUsageHealth({
      supabase,
      status: "degraded",
      message:
        "One or more takeoff attempts are missing validated OpenAI usage and cost telemetry.",
      details: { latest_job_id: jobId, ...metadata },
    })
  } catch (error) {
    console.error(
      `[${jobId}] processor usage health could not be degraded`,
      safeErrorMessage(error)
    )
  }
}

async function reportRecordedUsage({
  supabase,
  jobId,
  claimToken,
  workerId,
  processorJobId,
  terminalAction,
}: {
  supabase: AdminClient
  jobId: string
  userId: string
  claimToken: string
  workerId: string
  processorJobId: string | null
  terminalAction: TerminalAction
}) {
  const now = new Date().toISOString()
  let reconciliationError = false

  try {
    const { error } = await supabase
      .from("admin_alerts")
      .update({
        status: "resolved",
        resolved_at: now,
        last_seen_at: now,
      })
      .eq("dedupe_key", usageAlertDedupeKey(jobId, claimToken))
      .in("status", ["open", "acknowledged"])
    if (error) throw new Error(error.message)
  } catch (error) {
    reconciliationError = true
    console.error(
      `[${jobId}] processor usage alert could not be resolved`,
      safeErrorMessage(error)
    )
  }

  let unresolvedAlerts = 0
  try {
    const { count, error } = await supabase
      .from("admin_alerts")
      .select("id", { count: "exact", head: true })
      .like("dedupe_key", `${usageAlertDedupePrefix}%`)
      .in("status", ["open", "acknowledged"])
    if (error) throw new Error(error.message)
    unresolvedAlerts = count ?? 0
  } catch (error) {
    reconciliationError = true
    console.error(
      `[${jobId}] processor usage alerts could not be reconciled`,
      safeErrorMessage(error)
    )
  }

  const degraded = reconciliationError || unresolvedAlerts > 0
  try {
    await writeUsageHealth({
      supabase,
      status: degraded ? "degraded" : "healthy",
      message: degraded
        ? "OpenAI usage is being recorded, but one or more attempts still need cost reconciliation."
        : "OpenAI usage and estimated API cost were validated and persisted.",
      details: {
        latest_job_id: jobId,
        terminal_action: terminalAction,
        worker_id: workerId,
        processor_job_id: processorJobId,
        unresolved_alerts: unresolvedAlerts,
        reconciliation_error: reconciliationError,
      },
    })
  } catch (error) {
    console.error(
      `[${jobId}] processor usage health could not be recorded`,
      safeErrorMessage(error)
    )
  }
}

async function createOrTouchUsageAlert({
  supabase,
  jobId,
  userId,
  claimToken,
  metadata,
}: {
  supabase: AdminClient
  jobId: string
  userId: string
  claimToken: string
  metadata: Record<string, unknown>
}) {
  const now = new Date().toISOString()
  const dedupeKey = usageAlertDedupeKey(jobId, claimToken)
  const { data: existing, error: readError } = await supabase
    .from("admin_alerts")
    .select("id,occurrence_count")
    .eq("dedupe_key", dedupeKey)
    .in("status", ["open", "acknowledged"])
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  if (existing) {
    const { error } = await supabase
      .from("admin_alerts")
      .update({
        severity: "warning",
        title: "Takeoff API cost needs reconciliation",
        message:
          "Customer settlement continued, but validated OpenAI usage could not be saved for this processing attempt.",
        occurrence_count: existing.occurrence_count + 1,
        last_seen_at: now,
        metadata,
      })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from("admin_alerts").insert({
    severity: "warning",
    category: "worker",
    title: "Takeoff API cost needs reconciliation",
    message:
      "Customer settlement continued, but validated OpenAI usage could not be saved for this processing attempt.",
    status: "open",
    dedupe_key: dedupeKey,
    entity_type: "takeoff_job",
    entity_id: jobId,
    user_id: userId,
    job_id: jobId,
    metadata,
    first_seen_at: now,
    last_seen_at: now,
  })
  if (error && error.code !== "23505") throw new Error(error.message)
}

async function writeUsageHealth({
  supabase,
  status,
  message,
  details,
}: {
  supabase: AdminClient
  status: "healthy" | "degraded"
  message: string
  details: Record<string, unknown>
}) {
  const checkedAt = new Date()
  const { error } = await supabase.from("service_health").upsert(
    {
      service_name: takeoffProcessorUsageHealthCheck.serviceName,
      check_name: takeoffProcessorUsageHealthCheck.checkName,
      status,
      message,
      details,
      checked_at: checkedAt.toISOString(),
      expires_at: new Date(checkedAt.getTime() + usageHealthTtlMs).toISOString(),
    },
    { onConflict: "service_name,check_name" }
  )
  if (error) throw new Error(error.message)
}

function usageAlertDedupeKey(jobId: string, claimToken: string) {
  return `${usageAlertDedupePrefix}${jobId}:${claimToken}`
}

function safeErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500)
}
