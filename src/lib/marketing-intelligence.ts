import "server-only"

import { cache } from "react"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type CampaignRow = {
  source: string
  medium: string
  campaign: string
  visitors: number
  sessions: number
  pageViews: number
}

type DeviceRow = {
  device: string
  browser: string
  os: string
  visitors: number
}

type LocationRow = {
  country: string
  region: string
  visitors: number
}

type LanguageRow = {
  language: string
  timezone: string
  visitors: number
}

type PageRow = {
  path: string
  pageViews: number
  visitors: number
}

export type MarketingSnapshot = {
  asOf: string
  windowDays: number
  retentionPolicy: string
  retentionDays: number | null
  metrics: {
    pageViews: number
    visitors: number
    sessions: number
    identifiedEvents: number
    locatedEvents: number
  }
  campaigns: CampaignRow[]
  devices: DeviceRow[]
  locations: LocationRow[]
  languages: LanguageRow[]
  pages: PageRow[]
}

export const getAdminMarketingSnapshot = cache(async () => {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc("get_admin_marketing_snapshot", {
    p_as_of: new Date().toISOString(),
  })
  if (error) {
    throw new Error(`Could not load marketing intelligence: ${error.message}`)
  }
  return parseMarketingSnapshot(data)
})

export function parseMarketingSnapshot(value: unknown): MarketingSnapshot {
  const root = record(value)
  const metrics = record(root.metrics)
  return {
    asOf: text(root.as_of, new Date(0).toISOString()),
    windowDays: count(root.window_days),
    retentionPolicy: text(root.retention_policy, "board_pending"),
    retentionDays:
      root.retention_days === null || root.retention_days === undefined
        ? null
        : count(root.retention_days),
    metrics: {
      pageViews: count(metrics.page_views),
      visitors: count(metrics.visitors),
      sessions: count(metrics.sessions),
      identifiedEvents: count(metrics.identified_events),
      locatedEvents: count(metrics.located_events),
    },
    campaigns: rows(root.campaigns).map((row) => ({
      source: text(row.source),
      medium: text(row.medium),
      campaign: text(row.campaign),
      visitors: count(row.visitors),
      sessions: count(row.sessions),
      pageViews: count(row.page_views),
    })),
    devices: rows(root.devices).map((row) => ({
      device: text(row.device),
      browser: text(row.browser),
      os: text(row.os),
      visitors: count(row.visitors),
    })),
    locations: rows(root.locations).map((row) => ({
      country: text(row.country),
      region: text(row.region),
      visitors: count(row.visitors),
    })),
    languages: rows(root.languages).map((row) => ({
      language: text(row.language),
      timezone: text(row.timezone),
      visitors: count(row.visitors),
    })),
    pages: rows(root.pages).map((row) => ({
      path: text(row.path),
      pageViews: count(row.page_views),
      visitors: count(row.visitors),
    })),
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function rows(value: unknown) {
  return Array.isArray(value) ? value.map(record) : []
}

function text(value: unknown, fallback = "(not set)") {
  return typeof value === "string" && value ? value : fallback
}

function count(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0
}
