export const marketingEventNames = [
  "page_view",
  "signup_started",
  "account_created",
  "blueprint_upload_started",
  "checkout_started",
  "purchase",
] as const

export type MarketingEventName = (typeof marketingEventNames)[number]

export type MarketingEventInput = {
  eventName: MarketingEventName
  anonymousId: string
  sessionId: string
  landingPath: string
  referrerHost: string | null
  source: string | null
  medium: string | null
  campaign: string | null
  term: string | null
  content: string | null
  clickIdKind: string | null
  clickId: string | null
  tags: Record<string, string>
  metadata: Record<string, string | number | boolean | null>
}

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const clickIdKinds = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "fbclid",
])

export function parseMarketingEventInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  const input = value as Record<string, unknown>
  if (
    typeof input.eventName !== "string" ||
    !marketingEventNames.includes(input.eventName as MarketingEventName) ||
    typeof input.anonymousId !== "string" ||
    !uuidV4Pattern.test(input.anonymousId) ||
    typeof input.sessionId !== "string" ||
    !uuidV4Pattern.test(input.sessionId)
  ) {
    return null
  }

  const landingPath = boundedString(input.landingPath, 500)
  if (!landingPath?.startsWith("/") || landingPath.startsWith("//")) {
    return null
  }

  const clickIdKind = boundedString(input.clickIdKind, 16)?.toLowerCase() ?? null
  const clickId = boundedString(input.clickId, 500)
  if (
    (clickIdKind === null) !== (clickId === null) ||
    (clickIdKind !== null && !clickIdKinds.has(clickIdKind))
  ) {
    return null
  }

  return {
    eventName: input.eventName as MarketingEventName,
    anonymousId: input.anonymousId,
    sessionId: input.sessionId,
    landingPath,
    referrerHost: hostname(input.referrerHost),
    source: boundedString(input.source, 200),
    medium: boundedString(input.medium, 200),
    campaign: boundedString(input.campaign, 200),
    term: boundedString(input.term, 200),
    content: boundedString(input.content, 200),
    clickIdKind,
    clickId,
    tags: stringRecord(input.tags),
    metadata: scalarRecord(input.metadata),
  } satisfies MarketingEventInput
}

export function classifyUserAgent(userAgent: string | null) {
  const value = userAgent ?? ""
  const deviceType = /ipad|tablet|kindle|silk/i.test(value)
    ? "tablet"
    : /mobile|iphone|ipod|android/i.test(value)
      ? "mobile"
      : value
        ? "desktop"
        : "other"

  const browserFamily = /edg\//i.test(value)
    ? "Edge"
    : /samsungbrowser/i.test(value)
      ? "Samsung Internet"
      : /firefox|fxios/i.test(value)
        ? "Firefox"
        : /chrome|crios/i.test(value)
          ? "Chrome"
          : /safari/i.test(value)
            ? "Safari"
            : value
              ? "Other"
              : null

  const osFamily = /windows/i.test(value)
    ? "Windows"
    : /iphone|ipad|ipod/i.test(value)
      ? "iOS"
      : /android/i.test(value)
        ? "Android"
        : /macintosh|mac os x/i.test(value)
          ? "macOS"
          : /linux/i.test(value)
            ? "Linux"
            : value
              ? "Other"
              : null

  return { deviceType, browserFamily, osFamily }
}

export function coarseRequestGeo(headers: Headers) {
  const rawCountry =
    headers.get("cf-ipcountry") ??
    headers.get("x-vercel-ip-country") ??
    headers.get("x-country-code")
  const countryCode = rawCountry?.trim().toUpperCase()
  const region = boundedString(
    headers.get("x-vercel-ip-country-region") ??
      headers.get("cf-region-code"),
    100
  )

  return {
    countryCode:
      countryCode && /^[A-Z]{2}$/.test(countryCode)
        ? countryCode
        : null,
    region,
  }
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null
  const prefix = `${name}=`
  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (!entry) return null
  try {
    return decodeURIComponent(entry.slice(prefix.length))
  } catch {
    return null
  }
}

function hostname(value: unknown) {
  const text = boundedString(value, 253)
  if (!text) return null
  return /^[a-z0-9.-]+$/i.test(text) ? text.toLowerCase() : null
}

function boundedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const text = value.trim()
  return text ? text.slice(0, maxLength) : null
}

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) =>
      /^[a-z0-9_]{1,40}$/i.test(key) && typeof item === "string"
    )
    .slice(0, 20)
    .map(([key, item]) => [key, (item as string).slice(0, 200)])
  return Object.fromEntries(entries)
}

function scalarRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, item]) =>
      /^[a-z0-9_]{1,40}$/i.test(key) &&
      (item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean")
    )
    .slice(0, 20)
    .map(([key, item]) => [
      key,
      typeof item === "string" ? item.slice(0, 500) : item,
    ])
  return Object.fromEntries(entries) as Record<
    string,
    string | number | boolean | null
  >
}
