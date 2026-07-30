import "server-only"

import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireWorker } from "@/lib/worker-auth"
import type { TakeoffJob } from "@/lib/takeoff-types"

export async function getClaimedTakeoff(
  request: Request,
  jobId: string,
  allowedStatuses: string[] = ["processing"]
): Promise<
  | {
      worker: { workerId: string; claimToken: string }
      job: TakeoffJob & {
        instructions: string | null
        priority: "standard" | "rush"
      }
      supabase: ReturnType<typeof createSupabaseAdminClient>
    }
  | Response
> {
  const worker = requireWorker(request)
  if (!worker) return jsonError("Unauthorized worker request.", 401)
  const claimToken = request.headers.get("x-claim-token")
  if (!claimToken || !/^[0-9a-f-]{36}$/i.test(claimToken)) {
    return jsonError("A valid worker claim token is required.", 403)
  }

  const supabase = createSupabaseAdminClient()
  const { data: job, error } = await supabase
    .from("takeoff_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (
    !job ||
    job.claimed_by !== worker.workerId ||
    job.claim_token !== claimToken
  ) {
    return jsonError("This worker has not claimed the takeoff.", 403)
  }
  if (!allowedStatuses.includes(job.status)) {
    return jsonError(
      `Takeoff status ${job.status} does not allow this worker operation.`,
      409
    )
  }

  return {
    worker: { ...worker, claimToken },
    job: job as TakeoffJob & {
      instructions: string | null
      priority: "standard" | "rush"
    },
    supabase,
  }
}
