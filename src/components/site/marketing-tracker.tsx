"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  marketingAccountCreatedCookieName,
  marketingAttributionStorageKey,
  marketingConsentChangedEvent,
  marketingConsentCookieName,
  marketingSessionStorageKey,
  marketingVisitorCookieName,
} from "@/lib/marketing-consent"
import type { MarketingEventName } from "@/lib/marketing-event"
import {
  googleAdsAccountCreatedDestination,
  googleAdsBlueprintUploadStartedDestination,
  googleAdsCheckoutStartedDestination,
} from "@/lib/google-ads"

type Attribution = {
  source: string | null
  medium: string | null
  campaign: string | null
  term: string | null
  content: string | null
  clickIdKind: string | null
  clickId: string | null
  referrerHost: string | null
  tags: Record<string, string>
}

export function MarketingTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const record = () => {
      void trackMarketingEvent("page_view")
      if (pathname === "/signup" || pathname === "/es/signup") {
        void trackMarketingEvent("signup_started")
      }
      void recordPendingAccountCreated()
    }
    record()
    window.addEventListener(marketingConsentChangedEvent, record)
    return () => window.removeEventListener(marketingConsentChangedEvent, record)
  }, [pathname])

  return null
}

export async function trackMarketingEvent(
  eventName: MarketingEventName,
  metadata: Record<string, string | number | boolean | null> = {}
) {
  if (!marketingConsentGranted()) return false

  const anonymousId = ensureVisitorId()
  const sessionId = ensureSessionId()
  if (!anonymousId || !sessionId) return false
  const attribution = readAttribution()

  sendGoogleAdsFunnelConversion(eventName)

  try {
    const response = await fetch("/api/marketing/events", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventName,
        anonymousId,
        sessionId,
        landingPath: window.location.pathname,
        ...attribution,
        metadata: {
          ...metadata,
          language: navigator.language.slice(0, 20),
          viewport_band: viewportBand(),
        },
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function trackMarketingEventOnce(
  eventName: MarketingEventName,
  dedupeKey: string,
  metadata: Record<string, string | number | boolean | null> = {}
) {
  if (!marketingConsentGranted()) return false
  const storageKey = `cuadrabot:marketing-event:${eventName}:${dedupeKey}`
  try {
    if (window.sessionStorage.getItem(storageKey)) return true
  } catch {
    // A hardened browser can still record the event without local deduplication.
  }

  const recorded = await trackMarketingEvent(eventName, metadata)
  if (!recorded) return false
  try {
    window.sessionStorage.setItem(storageKey, "sent")
  } catch {
    // The server accepted the event even if session storage is unavailable.
  }
  return true
}

let pendingAccountEventInFlight = false

async function recordPendingAccountCreated() {
  if (
    pendingAccountEventInFlight ||
    readCookie(marketingAccountCreatedCookieName) !== "1"
  ) {
    return
  }

  pendingAccountEventInFlight = true
  try {
    const recorded = await trackMarketingEventOnce(
      "account_created",
      "current-account"
    )
    if (recorded) deleteCookie(marketingAccountCreatedCookieName)
  } finally {
    pendingAccountEventInFlight = false
  }
}

function sendGoogleAdsFunnelConversion(eventName: MarketingEventName) {
  const destinations: Partial<Record<MarketingEventName, string | null>> = {
    account_created: googleAdsAccountCreatedDestination,
    blueprint_upload_started: googleAdsBlueprintUploadStartedDestination,
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
}

function marketingConsentGranted() {
  if (globalPrivacyControlEnabled()) return false
  return readCookie(marketingConsentCookieName) === "granted"
}

function ensureVisitorId() {
  const existing = readCookie(marketingVisitorCookieName)
  if (existing) return existing
  const identifier = randomUuid()
  if (!identifier) return null
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${marketingVisitorCookieName}=${identifier}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`
  return identifier
}

function ensureSessionId() {
  try {
    const existing = window.sessionStorage.getItem(marketingSessionStorageKey)
    if (existing) return existing
    const identifier = randomUuid()
    if (!identifier) return null
    window.sessionStorage.setItem(marketingSessionStorageKey, identifier)
    return identifier
  } catch {
    return randomUuid()
  }
}

function readAttribution(): Attribution {
  const current = attributionFromUrl()
  const hasCampaignSignal = Boolean(
    current.source || current.campaign || current.clickId
  )
  if (hasCampaignSignal) {
    try {
      window.localStorage.setItem(
        marketingAttributionStorageKey,
        JSON.stringify(current)
      )
    } catch {
      // The current event can still carry attribution in hardened browsers.
    }
    return current
  }

  try {
    const stored = window.localStorage.getItem(marketingAttributionStorageKey)
    if (stored) return { ...emptyAttribution(), ...JSON.parse(stored) }
  } catch {
    // Invalid or unavailable storage falls back to direct attribution.
  }
  return current
}

function attributionFromUrl(): Attribution {
  const params = new URLSearchParams(window.location.search)
  const clickIdKind = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid"].find(
    (key) => params.get(key)
  )
  const tagKeys = ["utm_id", "campaign_id", "adgroup_id", "creative_id"]
  const tags = Object.fromEntries(
    tagKeys
      .map((key) => [key, params.get(key)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  )

  return {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    term: params.get("utm_term"),
    content: params.get("utm_content"),
    clickIdKind: clickIdKind ?? null,
    clickId: clickIdKind ? params.get(clickIdKind) : null,
    referrerHost: externalReferrerHost(),
    tags,
  }
}

function emptyAttribution(): Attribution {
  return {
    source: null,
    medium: null,
    campaign: null,
    term: null,
    content: null,
    clickIdKind: null,
    clickId: null,
    referrerHost: null,
    tags: {},
  }
}

function externalReferrerHost() {
  if (!document.referrer) return null
  try {
    const referrer = new URL(document.referrer)
    return referrer.host === window.location.host ? null : referrer.host
  } catch {
    return null
  }
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

function deleteCookie(name: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

function randomUuid() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : null
}

function globalPrivacyControlEnabled() {
  return Boolean(
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl
  )
}

function viewportBand() {
  if (window.innerWidth < 640) return "small"
  if (window.innerWidth < 1024) return "medium"
  return "large"
}
