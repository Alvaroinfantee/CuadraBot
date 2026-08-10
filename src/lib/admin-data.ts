import "server-only"

import { cache } from "react"
import {
  normalizeRequiredServiceHealth,
  parseAdminAnalyticsAggregate,
  summarizeServiceHealth,
  takeoffProcessorUsageHealthCheck,
  type AdminAnalyticsAggregate,
  type ServiceHealthRow,
} from "@/lib/admin-analytics"
import { parseAdminMarketingSnapshot } from "@/lib/marketing-analytics"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { TakeoffJob } from "@/lib/takeoff-types"

export type AdminProfile = {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  role: string
  status: "active" | "suspended" | "closed"
  country_code: string | null
  region: string | null
  city: string | null
  last_seen_at: string | null
  created_at: string
}

type AdminSubscription = {
  id: string
  user_id: string
  billing_plan_id: string | null
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  created_at: string
  updated_at: string
}

type BillingPlan = {
  id: string
  slug: string
  name: string
  plan_type: "credit_pack" | "subscription"
  price_cents: number
  credits: number
  stripe_price_id: string | null
  active: boolean
}

type BillingOrder = {
  id: string
  user_id: string
  sku: string
  kind: "credit_pack" | "subscription"
  status: string
  credits: number
  amount: number
  currency: string
  paid_at: string | null
  created_at: string
}

export type AdminAlert = {
  id: string
  severity: "info" | "warning" | "critical"
  category: string
  title: string
  message: string
  status: "open" | "acknowledged" | "resolved" | "dismissed"
  entity_type: string | null
  entity_id: string | null
  occurrence_count: number
  last_seen_at: string
}

export type ServiceHealth = ServiceHealthRow

export type AdminAudit = {
  id: string
  actor_email: string | null
  action: string
  target_type: string
  target_id: string | null
  reason: string | null
  created_at: string
}

export type AppSetting = {
  key: string
  value: unknown
  description: string
  public_readable: boolean
  updated_at: string
}

type CreditAccountRow = {
  user_id: string
  balance: number
  lifetime_granted: number
  lifetime_consumed: number
}

export type AdminSnapshot = ReturnType<typeof buildAdminSnapshot>

export const getAdminSnapshot = cache(async () => {
  const supabase = createSupabaseAdminClient()
  const asOf = new Date().toISOString()

  const [
    aggregate,
    profiles,
    jobs,
    subscriptions,
    plans,
    orders,
    alerts,
    healthRows,
    audit,
    settings,
    credits,
  ] = await Promise.all([
    readAdminAnalytics(
      supabase.rpc("get_admin_analytics_snapshot", { p_as_of: asOf })
    ),
    readRows<AdminProfile>(
      supabase
        .from("profiles")
        .select(
          "id,email,full_name,company_name,role,status,country_code,region,city,last_seen_at,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(5_000)
    ),
    readRows<TakeoffJob>(
      supabase
        .from("takeoff_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5_000)
    ),
    readRows<AdminSubscription>(
      supabase
        .from("subscriptions")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(5_000)
    ),
    readRows<BillingPlan>(
      supabase.from("billing_plans").select("*").order("sort_order")
    ),
    readRows<BillingOrder>(
      supabase
        .from("billing_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5_000)
    ),
    readRows<AdminAlert>(
      supabase
        .from("admin_alerts")
        .select(
          "id,severity,category,title,message,status,entity_type,entity_id,occurrence_count,last_seen_at"
        )
        .order("last_seen_at", { ascending: false })
        .limit(500)
    ),
    readRows<Omit<ServiceHealth, "missing">>(
      supabase.from("service_health").select("*").order("service_name")
    ),
    readRows<AdminAudit>(
      supabase
        .from("admin_audit_log")
        .select(
          "id,actor_email,action,target_type,target_id,reason,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1_000)
    ),
    readRows<AppSetting>(
      supabase.from("app_settings").select("*").order("key")
    ),
    readRows<CreditAccountRow>(
      supabase
        .from("credit_accounts")
        .select("user_id,balance,lifetime_granted,lifetime_consumed")
        .limit(5_000)
    ),
  ])
  const health = normalizeRequiredServiceHealth(healthRows, aggregate.asOf)

  return buildAdminSnapshot({
    aggregate,
    profiles,
    jobs,
    subscriptions,
    plans,
    orders,
    alerts,
    health,
    audit,
    settings,
    credits,
  })
})

export const getAdminMarketingSnapshot = cache(async () => {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc(
    "get_admin_marketing_snapshot",
    { p_as_of: new Date().toISOString() }
  )
  if (error) {
    throw new Error(`Could not load marketing analytics: ${error.message}`)
  }
  return parseAdminMarketingSnapshot(data)
})

async function readRows<Row>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>
) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

async function readAdminAnalytics(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>
) {
  const { data, error } = await query
  if (error) {
    throw new Error(`Could not load admin analytics: ${error.message}`)
  }
  return parseAdminAnalyticsAggregate(data)
}

function buildAdminSnapshot(input: {
  aggregate: AdminAnalyticsAggregate
  profiles: AdminProfile[]
  jobs: TakeoffJob[]
  subscriptions: AdminSubscription[]
  plans: BillingPlan[]
  orders: BillingOrder[]
  alerts: AdminAlert[]
  health: ServiceHealth[]
  audit: AdminAudit[]
  settings: AppSetting[]
  credits: CreditAccountRow[]
}) {
  const { aggregate, ...details } = input
  const { metrics } = aggregate
  const health = summarizeServiceHealth(input.health, aggregate.asOf)
  const healthIssues = health.missing + health.stale + health.unhealthy
  const processorUsageHealth = input.health.find(
    (row) =>
      row.service_name === takeoffProcessorUsageHealthCheck.serviceName &&
      row.check_name === takeoffProcessorUsageHealthCheck.checkName
  )
  const processorUsageHealthCurrent = Boolean(
    processorUsageHealth &&
      !processorUsageHealth.missing &&
      processorUsageHealth.expires_at &&
      new Date(processorUsageHealth.expires_at).getTime() >
        new Date(aggregate.asOf).getTime()
  )
  const processorUsageReady = Boolean(
    processorUsageHealthCurrent && processorUsageHealth?.status === "healthy"
  )

  const readiness = [
    {
      level: metrics.unpricedPlans ? "critical" : "ok",
      title: "Stripe catalog",
      detail: metrics.unpricedPlans
        ? `${metrics.unpricedPlans} active plans are missing a Stripe Price ID.`
        : "All active plans have Stripe Price IDs.",
    },
    {
      level: health.missing || health.unhealthy
        ? "critical"
        : health.stale
          ? "warning"
          : "ok",
      title: "Service health",
      detail: healthIssues
        ? `${health.missing} missing, ${health.stale} stale, and ${health.unhealthy} unhealthy required reports.`
        : "All required service checks are current and healthy.",
    },
    {
      level: metrics.staleProcessing ? "critical" : "ok",
      title: "Processing queue",
      detail: metrics.staleProcessing
        ? `${metrics.staleProcessing} jobs have not updated for 30 minutes.`
        : "No stale processing claims detected.",
    },
    {
      level: metrics.failedStripeEvents ? "critical" : "ok",
      title: "Stripe events",
      detail: metrics.failedStripeEvents
        ? `${metrics.failedStripeEvents} failed or stale events need processing or retry.`
        : "No failed or stale Stripe events.",
    },
    {
      level: processorUsageReady ? "ok" : "warning",
      title: "Unit economics",
      detail: processorUsageReady
        ? "Per-attempt OpenAI usage, reported-category cost estimates, and hypothetical all-input-uncached estimates are recorded for admin review."
        : processorUsageHealth?.missing
          ? "Processor usage accounting has not recorded a verified health result yet."
          : !processorUsageHealthCurrent
            ? "The processor usage accounting health result is missing or stale."
            : processorUsageHealth?.message ??
              "One or more processor attempts need API cost reconciliation.",
    },
    {
      level: metrics.missingCountry ? "warning" : "ok",
      title: "Geography coverage",
      detail: `${metrics.missingCountry} users have no country or billing-location signal.`,
    },
  ] as const

  return {
    ...details,
    asOf: aggregate.asOf,
    currency: aggregate.currency,
    metrics,
    geography: aggregate.geography,
    statusCounts: aggregate.statusCounts,
    funnel: aggregate.funnel,
    weeklyUsage: aggregate.weeklyUsage,
    healthSummary: health,
    readiness,
  }
}
