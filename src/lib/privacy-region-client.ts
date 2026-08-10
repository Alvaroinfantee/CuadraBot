"use client"

import type { MarketingPrivacyRegion } from "@/lib/marketing-analytics"

let privacyRegionRequest: Promise<MarketingPrivacyRegion> | null = null

export function getBrowserPrivacyRegion() {
  privacyRegionRequest ??= fetch("/api/privacy/region", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return "unknown" as const
      const payload = (await response.json()) as { region?: unknown }
      return isPrivacyRegion(payload.region) ? payload.region : "unknown"
    })
    .catch(() => "unknown" as const)
  return privacyRegionRequest
}

function isPrivacyRegion(value: unknown): value is MarketingPrivacyRegion {
  return value === "regulated" || value === "standard" || value === "unknown"
}
