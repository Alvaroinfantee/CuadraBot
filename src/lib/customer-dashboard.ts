import "server-only"

import { cache } from "react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { isCurrentCustomerFile } from "@/lib/takeoff-result-visibility"
import type {
  CreditAccount,
  TakeoffFile,
  TakeoffJob,
} from "@/lib/takeoff-types"

const emptyCredits: CreditAccount = {
  user_id: "",
  balance: 0,
  lifetime_granted: 0,
  lifetime_consumed: 0,
  updated_at: new Date(0).toISOString(),
}

export const getCustomerWorkspace = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient()
  const [creditResult, jobsResult, subscriptionResult] = await Promise.all([
    supabase
      .from("credit_accounts")
      .select(
        "user_id,balance,lifetime_granted,lifetime_consumed,updated_at"
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("takeoff_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("subscriptions")
      .select(
        "id,billing_plan_id,status,current_period_start,current_period_end,cancel_at_period_end"
      )
      .eq("user_id", userId)
      .in("status", ["trialing", "active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    credits: (creditResult.data as CreditAccount | null) ?? {
      ...emptyCredits,
      user_id: userId,
    },
    jobs: (jobsResult.data as TakeoffJob[] | null) ?? [],
    subscription: subscriptionResult.data,
  }
})

export async function getCustomerJob(userId: string, jobId: string) {
  const supabase = await createSupabaseServerClient()
  const [jobResult, filesResult, eventsResult] = await Promise.all([
    supabase
      .from("takeoff_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("takeoff_files")
      .select("*")
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("takeoff_job_events")
      .select("id,event_type,message,metadata,created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
  ])

  const job = jobResult.data as TakeoffJob | null
  const files = ((filesResult.data as TakeoffFile[] | null) ?? []).filter(
    (file) => isCurrentCustomerFile(job, file)
  )

  return {
    job,
    files,
    events: eventsResult.data ?? [],
  }
}
