export type AdminMarketingSnapshot = {
  asOf: string
  metrics: {
    events30: number
    visitors30: number
    sessions30: number
    pageViews30: number
    accountsCreated30: number
    blueprintUploadsStarted30: number
    checkoutsStarted30: number
    purchases30: number
  }
  devices: Array<{ label: string; events: number; visitors: number }>
  geography: Array<{ label: string; events: number; visitors: number }>
  ageBands: Array<{ label: string; visitors: number }>
  campaigns: Array<{
    source: string
    medium: string
    campaign: string
    events: number
    visitors: number
    accountsCreated: number
    blueprintUploadsStarted: number
    checkoutsStarted: number
    purchases: number
  }>
}

export function parseAdminMarketingSnapshot(
  value: unknown
): AdminMarketingSnapshot {
  const root = record(value, "marketing snapshot")
  if ("as_of" in root) return parseCurrentMarketingSnapshot(root)
  const metrics = record(root.metrics, "marketing metrics")
  return {
    asOf: isoString(root.asOf, "asOf"),
    metrics: {
      events30: count(metrics.events30, "metrics.events30"),
      visitors30: count(metrics.visitors30, "metrics.visitors30"),
      sessions30: count(metrics.sessions30, "metrics.sessions30"),
      pageViews30: count(metrics.pageViews30, "metrics.pageViews30"),
      accountsCreated30: count(
        metrics.accountsCreated30,
        "metrics.accountsCreated30"
      ),
      blueprintUploadsStarted30: count(
        metrics.blueprintUploadsStarted30,
        "metrics.blueprintUploadsStarted30"
      ),
      checkoutsStarted30: count(
        metrics.checkoutsStarted30,
        "metrics.checkoutsStarted30"
      ),
      purchases30: count(metrics.purchases30, "metrics.purchases30"),
    },
    devices: rows(root.devices, "devices", (item, label) => ({
      label: text(item.label, `${label}.label`),
      events: count(item.events, `${label}.events`),
      visitors: count(item.visitors, `${label}.visitors`),
    })),
    geography: rows(root.geography, "geography", (item, label) => ({
      label: text(item.label, `${label}.label`),
      events: count(item.events, `${label}.events`),
      visitors: count(item.visitors, `${label}.visitors`),
    })),
    ageBands: rows(root.ageBands, "ageBands", (item, label) => ({
      label: text(item.label, `${label}.label`),
      visitors: count(item.visitors, `${label}.visitors`),
    })),
    campaigns: rows(root.campaigns, "campaigns", (item, label) => ({
      source: text(item.source, `${label}.source`),
      medium: text(item.medium, `${label}.medium`),
      campaign: text(item.campaign, `${label}.campaign`),
      events: count(item.events, `${label}.events`),
      visitors: count(item.visitors, `${label}.visitors`),
      accountsCreated: count(
        item.accountsCreated,
        `${label}.accountsCreated`
      ),
      blueprintUploadsStarted: count(
        item.blueprintUploadsStarted,
        `${label}.blueprintUploadsStarted`
      ),
      checkoutsStarted: count(
        item.checkoutsStarted,
        `${label}.checkoutsStarted`
      ),
      purchases: count(item.purchases, `${label}.purchases`),
    })),
  }
}

function parseCurrentMarketingSnapshot(
  root: Record<string, unknown>
): AdminMarketingSnapshot {
  const metrics = record(root.metrics, "marketing metrics")
  const pageViews = count(metrics.page_views, "metrics.page_views")
  return {
    asOf: isoString(root.as_of, "as_of"),
    metrics: {
      events30: pageViews,
      visitors30: count(metrics.visitors, "metrics.visitors"),
      sessions30: count(metrics.sessions, "metrics.sessions"),
      pageViews30: pageViews,
      accountsCreated30: 0,
      blueprintUploadsStarted30: 0,
      checkoutsStarted30: 0,
      purchases30: 0,
    },
    devices: rows(root.devices, "devices", (item, label) => ({
      label: text(item.device, `${label}.device`),
      events: 0,
      visitors: count(item.visitors, `${label}.visitors`),
    })),
    geography: rows(root.locations, "locations", (item, label) => ({
      label: text(item.country, `${label}.country`),
      events: 0,
      visitors: count(item.visitors, `${label}.visitors`),
    })),
    ageBands: [],
    campaigns: rows(root.campaigns, "campaigns", (item, label) => ({
      source: text(item.source, `${label}.source`),
      medium: text(item.medium, `${label}.medium`),
      campaign: text(item.campaign, `${label}.campaign`),
      events: count(item.page_views, `${label}.page_views`),
      visitors: count(item.visitors, `${label}.visitors`),
      accountsCreated: 0,
      blueprintUploadsStarted: 0,
      checkoutsStarted: 0,
      purchases: 0,
    })),
  }
}

function rows<Row>(
  value: unknown,
  label: string,
  parse: (item: Record<string, unknown>, label: string) => Row
) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}.`)
  return value.map((item, index) =>
    parse(record(item, `${label}[${index}]`), `${label}[${index}]`)
  )
}

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}.`)
  }
  return value as Record<string, unknown>
}

function count(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}.`)
  }
  return value
}

function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${label}.`)
  }
  return value
}

function isoString(value: unknown, label: string) {
  const valueText = text(value, label)
  if (!Number.isFinite(new Date(valueText).getTime())) {
    throw new Error(`Invalid ${label}.`)
  }
  return valueText
}

export const marketingConsentCookieName = "cuadrabot_marketing_consent_v2"
export const legacyGoogleConsentCookieName = "cuadrabot_google_consent"
export const marketingAnonymousCookieName = "cuadrabot_mid"
export const marketingSessionCookieName = "cuadrabot_sid"
export const marketingAttributionCookieName = "cuadrabot_attribution"
export const marketingPrivacyRegionCookieName = "cuadrabot_privacy_region"
export const marketingConsentChangedEvent =
  "cuadrabot:marketing-consent-changed"
export const marketingTrackEvent = "cuadrabot:marketing-event"
export const marketingConsentVersion = 2

export const regulatedMarketingCountryCodes = [
  "AT",
  "AX",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GG",
  "GR",
  "HR",
  "HU",
  "IE",
  "IM",
  "IS",
  "IT",
  "JE",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
] as const

export type MarketingPrivacyRegion = "regulated" | "standard" | "unknown"

export function countryMarketingPrivacyRegion(
  countryCode: string | null | undefined
): MarketingPrivacyRegion {
  const normalized = countryCode?.trim().toUpperCase()
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return "unknown"
  return (regulatedMarketingCountryCodes as readonly string[]).includes(
    normalized
  )
    ? "regulated"
    : "standard"
}

export function browserGlobalPrivacyControlIsEnabled() {
  if (typeof navigator === "undefined") return false
  return (
    navigator as Navigator & { globalPrivacyControl?: boolean }
  ).globalPrivacyControl === true
}

export const marketingEventNames = [
  "page_view",
  "sign_up_started",
  "sign_up_completed",
  "checkout_started",
  "purchase_completed",
  "takeoff_started",
] as const

export type MarketingEventName = (typeof marketingEventNames)[number]

export function isMarketingEventName(
  value: unknown
): value is MarketingEventName {
  return (
    typeof value === "string" &&
    (marketingEventNames as readonly string[]).includes(value)
  )
}

export function emitMarketingEvent(eventName: MarketingEventName) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(marketingTrackEvent, { detail: { eventName } })
  )
}
