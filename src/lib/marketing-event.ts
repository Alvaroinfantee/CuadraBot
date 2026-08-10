import { z } from "zod"

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable()

export const marketingEventSchema = z
  .object({
    eventName: z.enum([
      "page_view",
      "sign_up_started",
      "sign_up_completed",
      "checkout_started",
      "purchase_completed",
      "takeoff_started",
    ]),
    pagePath: z.string().max(300).regex(/^\/[^\r\n?#]*$/),
    landingPath: z.string().max(300).regex(/^\/[^\r\n?#]*$/),
    referrerHost: z
      .string()
      .trim()
      .min(1)
      .max(253)
      .regex(/^[a-z0-9.-]+$/i)
      .nullable(),
    source: optionalText(120),
    medium: optionalText(120),
    campaign: optionalText(200),
    term: optionalText(200),
    content: optionalText(200),
    firstSource: optionalText(120),
    firstMedium: optionalText(120),
    firstCampaign: optionalText(200),
    clickIdType: z.enum(["gclid", "gbraid", "wbraid"]).nullable(),
    language: optionalText(35),
    timezone: optionalText(80),
    screenBucket: z
      .enum([
        "under_640",
        "640_1023",
        "1024_1439",
        "1440_1919",
        "1920_plus",
      ])
      .nullable(),
    consentVersion: z.literal(2),
  })
  .strict()

export type MarketingEventPayload = z.infer<typeof marketingEventSchema>

export function browserDimensions(userAgent: string | null) {
  const ua = userAgent ?? ""
  const bot = /bot|crawler|spider|slurp|headless/i.test(ua)
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua))
  const mobile = /Mobile|iPhone|iPod|Android/i.test(ua)

  const deviceType = bot
    ? "bot"
    : tablet
      ? "tablet"
      : mobile
        ? "mobile"
        : ua
          ? "desktop"
          : "unknown"

  const browserName = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /SamsungBrowser\//i.test(ua)
        ? "Samsung Internet"
        : /Chrome\//i.test(ua)
          ? "Chrome"
          : /Firefox\//i.test(ua)
            ? "Firefox"
            : /Safari\//i.test(ua)
              ? "Safari"
              : "Unknown"

  const osName = /Windows NT/i.test(ua)
    ? "Windows"
    : /CrOS/i.test(ua)
      ? "ChromeOS"
      : /iPhone|iPad|iPod/i.test(ua)
        ? "iOS"
        : /Android/i.test(ua)
          ? "Android"
          : /Mac OS X|Macintosh/i.test(ua)
            ? "macOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Unknown"

  return { deviceType, browserName, osName }
}

export function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")
  if (!origin) return fetchSite === "same-origin"

  const allowedOrigins = new Set([new URL(request.url).origin])
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL
  if (configuredSite) {
    try {
      allowedOrigins.add(new URL(configuredSite).origin)
    } catch {
      // Invalid deployment configuration must not broaden allowed origins.
    }
  }
  return allowedOrigins.has(origin) && fetchSite !== "cross-site"
}

export function isUuid(value: string | null | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  )
}
