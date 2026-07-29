import "server-only"

import { hasSupabaseServerEnv } from "@/lib/config"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const featureKeys = [
  "features.free_sample",
  "features.subscriptions",
  "features.rush",
  "features.maintenance",
] as const

export type AppFeatures = {
  freeSample: boolean
  subscriptions: boolean
  rush: boolean
  maintenance: boolean
  maintenanceMessage: string
  configurationError: string | null
}

const failClosed: AppFeatures = {
  freeSample: false,
  subscriptions: false,
  rush: false,
  maintenance: true,
  maintenanceMessage:
    "New takeoff and billing actions are temporarily unavailable.",
  configurationError: "Application feature settings are unavailable.",
}

export async function getAppFeatures(): Promise<AppFeatures> {
  if (!hasSupabaseServerEnv()) return failClosed

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", [...featureKeys])

  if (error) {
    return { ...failClosed, configurationError: error.message }
  }

  const values = new Map(
    (data ?? []).map((row) => [
      row.key,
      row.value && typeof row.value === "object"
        ? (row.value as Record<string, unknown>)
        : {},
    ])
  )
  if (featureKeys.some((key) => !values.has(key))) return failClosed

  const maintenance = values.get("features.maintenance") ?? {}
  return {
    freeSample: values.get("features.free_sample")?.enabled === true,
    subscriptions: values.get("features.subscriptions")?.enabled === true,
    rush: values.get("features.rush")?.enabled === true,
    maintenance: maintenance.enabled === true,
    maintenanceMessage:
      typeof maintenance.message === "string" && maintenance.message.trim()
        ? maintenance.message.trim().slice(0, 240)
        : "New takeoff and billing actions are temporarily unavailable.",
    configurationError: null,
  }
}
