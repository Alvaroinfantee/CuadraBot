"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import {
  browserGlobalPrivacyControlIsEnabled,
  isMarketingEventName,
  legacyGoogleConsentCookieName,
  marketingAnonymousCookieName,
  marketingAttributionCookieName,
  marketingConsentChangedEvent,
  marketingConsentCookieName,
  marketingConsentVersion,
  marketingSessionCookieName,
  marketingTrackEvent,
  type MarketingEventName,
  type MarketingPrivacyRegion,
} from "@/lib/marketing-analytics"
import { marketingAccountCreatedCookieName } from "@/lib/marketing-consent"
import {
  googleAdsAccountCreatedDestination,
  googleAdsBlueprintUploadStartedDestination,
  googleAdsCheckoutStartedDestination,
} from "@/lib/google-ads"
import { getBrowserPrivacyRegion } from "@/lib/privacy-region-client"

type Touch = {
  source: string
  medium: string
  campaign: string | null
  term: string | null
  content: string | null
  clickIdType: "gclid" | "gbraid" | "wbraid" | null
}

type Attribution = {
  first: Touch
  last: Touch
  landingPath: string
}

const YEAR_SECONDS = 365 * 24 * 60 * 60
const ATTRIBUTION_SECONDS = 90 * 24 * 60 * 60
const SESSION_SECONDS = 30 * 60

export function MarketingAnalytics() {
  const pathname = usePathname()
  const lastPageView = useRef<string | null>(null)

  useEffect(() => {
    async function syncPageView() {
      const privacyRegion = await getBrowserPrivacyRegion()
      if (!marketingCollectionIsEnabled(privacyRegion)) {
        lastPageView.current = null
        return
      }

      const key = `${pathname}:${window.location.search}`
      if (lastPageView.current === key) return
      lastPageView.current = key
      await sendMarketingEvent("page_view", pathname, privacyRegion)
      if (pathname === "/signup" || pathname === "/es/signup") {
        await sendMarketingEvent("sign_up_started", pathname, privacyRegion)
      }
      if (readCookie(marketingAccountCreatedCookieName) === "1") {
        await sendMarketingEvent("sign_up_completed", pathname, privacyRegion)
        deleteCookie(marketingAccountCreatedCookieName)
      }
    }

    async function handleConsentChange() {
      const privacyRegion = await getBrowserPrivacyRegion()
      if (marketingCollectionIsEnabled(privacyRegion)) {
        await syncPageView()
        return
      }

      lastPageView.current = null
      await deleteMarketingIdentity()
    }

    function handleCustomEvent(event: Event) {
      const eventName = (event as CustomEvent<{ eventName?: unknown }>).detail
        ?.eventName
      if (isMarketingEventName(eventName) && eventName !== "page_view") {
        void sendMarketingEvent(eventName, pathname)
      }
    }

    void syncPageView()
    window.addEventListener(marketingConsentChangedEvent, handleConsentChange)
    window.addEventListener(marketingTrackEvent, handleCustomEvent)
    return () => {
      window.removeEventListener(
        marketingConsentChangedEvent,
        handleConsentChange
      )
      window.removeEventListener(marketingTrackEvent, handleCustomEvent)
    }
  }, [pathname])

  return null
}

async function sendMarketingEvent(
  eventName: MarketingEventName,
  pathname: string,
  resolvedPrivacyRegion?: MarketingPrivacyRegion
) {
  const privacyRegion =
    resolvedPrivacyRegion ?? (await getBrowserPrivacyRegion())
  if (!marketingCollectionIsEnabled(privacyRegion)) return

  sendGoogleAdsFunnelConversion(eventName)
  ensureIdentifier(marketingAnonymousCookieName, YEAR_SECONDS)
  ensureIdentifier(marketingSessionCookieName, SESSION_SECONDS, true)
  const attribution = updateAttribution(pathname)
  const payload = JSON.stringify({
    eventName,
    pagePath: sanitizedPath(pathname),
    landingPath: attribution.landingPath,
    referrerHost: externalReferrerHost(),
    source: attribution.last.source,
    medium: attribution.last.medium,
    campaign: attribution.last.campaign,
    term: attribution.last.term,
    content: attribution.last.content,
    firstSource: attribution.first.source,
    firstMedium: attribution.first.medium,
    firstCampaign: attribution.first.campaign,
    clickIdType: attribution.last.clickIdType,
    language: clipped(navigator.language, 35),
    timezone: clipped(
      Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      80
    ),
    screenBucket: screenBucket(window.innerWidth),
    consentVersion: marketingConsentVersion,
  })

  try {
    if (navigator.sendBeacon) {
      const accepted = navigator.sendBeacon(
        "/api/marketing/events",
        new Blob([payload], { type: "application/json" })
      )
      if (accepted) return
    }
    await fetch("/api/marketing/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      credentials: "same-origin",
      keepalive: true,
    })
  } catch {
    // Marketing telemetry must never interrupt the product workflow.
  }
}

function sendGoogleAdsFunnelConversion(eventName: MarketingEventName) {
  const destinations: Partial<Record<MarketingEventName, string | null>> = {
    sign_up_completed: googleAdsAccountCreatedDestination,
    takeoff_started: googleAdsBlueprintUploadStartedDestination,
    checkout_started: googleAdsCheckoutStartedDestination,
  }
  const destination = destinations[eventName]
  if (!destination) return

  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    ((...args: unknown[]) => {
      window.dataLayer?.push(args)
    })
  window.gtag("event", "conversion", { send_to: destination })
  document.documentElement.setAttribute(
    "data-google-ads-last-conversion",
    eventName
  )
}

async function deleteMarketingIdentity() {
  if (readCookie(marketingAnonymousCookieName)) {
    try {
      await fetch("/api/marketing/events", {
        method: "DELETE",
        credentials: "same-origin",
        keepalive: true,
      })
    } catch {
      // The user can still request deletion through the privacy contact.
    }
  }

  deleteCookie(marketingAnonymousCookieName)
  deleteCookie(marketingSessionCookieName)
  deleteCookie(marketingAttributionCookieName)
}

function marketingCollectionIsEnabled(region: MarketingPrivacyRegion) {
  if (browserGlobalPrivacyControlIsEnabled()) return false
  const choice = readCookie(marketingConsentCookieName)
  if (choice === "denied") return false
  if (choice === "granted") return true
  if (readCookie(legacyGoogleConsentCookieName) === "denied") return false
  return region === "standard"
}

function ensureIdentifier(name: string, maxAge: number, refresh = false) {
  const current = readCookie(name)
  if (
    current &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      current
    )
  ) {
    if (refresh) writeCookie(name, current, maxAge)
    return current
  }

  const next = crypto.randomUUID()
  writeCookie(name, next, maxAge)
  return next
}

function updateAttribution(pathname: string): Attribution {
  const stored = readAttribution()
  const current = currentTouch()
  const fallback = referralTouch()
  const attribution: Attribution = {
    first: current ?? stored?.first ?? fallback,
    last: current ?? stored?.last ?? fallback,
    landingPath: stored?.landingPath ?? sanitizedPath(pathname),
  }

  writeCookie(
    marketingAttributionCookieName,
    JSON.stringify(attribution),
    ATTRIBUTION_SECONDS
  )
  return attribution
}

function currentTouch(): Touch | null {
  const query = new URLSearchParams(window.location.search)
  const source = clipped(query.get("utm_source"), 120)
  const medium = clipped(query.get("utm_medium"), 120)
  const campaign = clipped(query.get("utm_campaign"), 200)
  const clickIdType = (["gclid", "gbraid", "wbraid"] as const).find((key) =>
    query.has(key)
  ) ?? null

  if (!source && !medium && !campaign && !clickIdType) return null
  return {
    source: source ?? (clickIdType ? "google" : "(not set)"),
    medium: medium ?? (clickIdType ? "cpc" : "(not set)"),
    campaign,
    term: clipped(query.get("utm_term"), 200),
    content: clipped(query.get("utm_content"), 200),
    clickIdType,
  }
}

function referralTouch(): Touch {
  const referrer = externalReferrerHost()
  return {
    source: referrer ?? "(direct)",
    medium: referrer ? "referral" : "(none)",
    campaign: null,
    term: null,
    content: null,
    clickIdType: null,
  }
}

function externalReferrerHost() {
  if (!document.referrer) return null
  try {
    const referrer = new URL(document.referrer)
    return referrer.origin === window.location.origin
      ? null
      : clipped(referrer.hostname.toLowerCase(), 253)
  } catch {
    return null
  }
}

function readAttribution(): Attribution | null {
  const raw = readCookie(marketingAttributionCookieName)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>
    if (!isTouch(parsed.first) || !isTouch(parsed.last)) return null
    return {
      first: parsed.first,
      last: parsed.last,
      landingPath: sanitizedPath(parsed.landingPath),
    }
  } catch {
    return null
  }
}

function isTouch(value: unknown): value is Touch {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<Touch>
  return (
    typeof candidate.source === "string" &&
    typeof candidate.medium === "string"
  )
}

function readCookie(name: string) {
  const prefix = `${name}=`
  const entry = document.cookie
    .split("; ")
    .find((candidate) => candidate.startsWith(prefix))
  if (!entry) return null
  try {
    return decodeURIComponent(entry.slice(prefix.length))
  } catch {
    return null
  }
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

function deleteCookie(name: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

function sanitizedPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/"
  return value.split(/[?#]/, 1)[0].slice(0, 300) || "/"
}

function clipped(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

function screenBucket(width: number) {
  if (width < 640) return "under_640"
  if (width < 1024) return "640_1023"
  if (width < 1440) return "1024_1439"
  if (width < 1920) return "1440_1919"
  return "1920_plus"
}
