"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"
import {
  browserGlobalPrivacyControlIsEnabled,
  legacyGoogleConsentCookieName,
  marketingConsentChangedEvent,
  type MarketingPrivacyRegion,
} from "@/lib/marketing-analytics"
import { getBrowserPrivacyRegion } from "@/lib/privacy-region-client"

type ConsentChoice = "granted" | "denied"

declare global {
  interface Window {
    __cuadrabotGoogleAdsConfigured?: boolean
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const copy = {
  en: {
    label: "Analytics and advertising cookie choices",
    title: "Your privacy choices",
    body: "This region requires opt-in. With your permission, Cuadrabot saves first-party page, campaign, device, language, and available coarse-location analytics, and uses Google Ads measurement. We never save payment details, plans, raw IP addresses, or arbitrary browser cookies for marketing.",
    standardBody: "Optional analytics and Google Ads measurement are enabled by default in your region. You can turn them off here at any time. We never save payment details, plans, raw IP addresses, or arbitrary browser cookies for marketing.",
    gpcBody: "Your browser is sending a Global Privacy Control opt-out signal. Cuadrabot is honoring it, so optional analytics and advertising storage remain disabled.",
    privacy: "Privacy policy",
    reject: "Reject optional analytics",
    accept: "Allow analytics and measurement",
    settings: "Cookie settings",
  },
  es: {
    label: "Opciones de cookies analíticas y publicitarias",
    title: "Tus opciones de privacidad",
    body: "Esta región requiere consentimiento previo. Con tu permiso, Cuadrabot guarda analítica propia de páginas, campañas, dispositivo, idioma y ubicación aproximada disponible, y utiliza la medición de Google Ads. Nunca guardamos datos de pago, planos, direcciones IP sin tratar ni cookies arbitrarias del navegador para marketing.",
    standardBody: "La analítica opcional y la medición de Google Ads están activadas por defecto en tu región. Puedes desactivarlas aquí en cualquier momento. Nunca guardamos datos de pago, planos, direcciones IP sin tratar ni cookies arbitrarias del navegador para marketing.",
    gpcBody: "Tu navegador está enviando una señal de exclusión Global Privacy Control. Cuadrabot la respeta, por lo que la analítica opcional y el almacenamiento publicitario permanecen desactivados.",
    privacy: "Política de privacidad",
    reject: "Rechazar analítica opcional",
    accept: "Permitir analítica y medición",
    settings: "Configurar cookies",
  },
} as const

export function GoogleAdsConsent({
  cookieName,
  googleAdsEnabled,
  googleAdsId,
  locale,
}: {
  cookieName: string
  googleAdsEnabled: boolean
  googleAdsId: string
  locale: Locale
}) {
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [privacyRegion, setPrivacyRegion] =
    useState<MarketingPrivacyRegion | null>(null)
  const content = copy[locale]
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener(marketingConsentChangedEvent, onStoreChange)
    return () =>
      window.removeEventListener(marketingConsentChangedEvent, onStoreChange)
  }, [])
  const readChoice = useCallback(
    () => readConsentCookie(cookieName),
    [cookieName]
  )
  const subscribeToNoopStore = useCallback(() => () => undefined, [])
  const choice = useSyncExternalStore(subscribe, readChoice, () => undefined)
  const globalPrivacyControl = useSyncExternalStore(
    subscribeToNoopStore,
    browserGlobalPrivacyControlIsEnabled,
    () => false
  )
  useEffect(() => {
    let active = true
    void getBrowserPrivacyRegion().then((region) => {
      if (active) setPrivacyRegion(region)
    })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (!googleAdsEnabled || !privacyRegion) return
    ensureGoogleAdsRuntime({
      choice,
      globalPrivacyControl,
      googleAdsId,
      privacyRegion,
    })
  }, [
    choice,
    globalPrivacyControl,
    googleAdsEnabled,
    googleAdsId,
    privacyRegion,
  ])

  function choose(nextChoice: ConsentChoice) {
    const effectiveChoice =
      globalPrivacyControl && nextChoice === "granted" ? "denied" : nextChoice
    writeConsentCookie(cookieName, effectiveChoice)
    if (googleAdsEnabled) updateGoogleConsent(effectiveChoice)
    window.dispatchEvent(new Event(marketingConsentChangedEvent))
    setPreferencesOpen(false)
  }

  if (choice === undefined || privacyRegion === null) return null

  const requiresChoice =
    !globalPrivacyControl &&
    choice === null &&
    privacyRegion !== "standard"

  if (!requiresChoice && !preferencesOpen) {
    return (
      <button
        type="button"
        className="fixed bottom-3 left-3 z-[70] border bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-white"
        onClick={() => setPreferencesOpen(true)}
      >
        {content.settings}
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label={content.label}
      aria-modal="false"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl sm:p-6"
    >
      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="text-base font-semibold">{content.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {globalPrivacyControl
              ? content.gpcBody
              : privacyRegion === "standard"
                ? content.standardBody
                : content.body}{" "}
            <Link
              className="font-medium text-primary underline underline-offset-4"
              href={locale === "es" ? "/es/privacy" : "/privacy"}
            >
              {content.privacy}
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => choose("denied")}>
            {content.reject}
          </Button>
          <Button
            type="button"
            disabled={globalPrivacyControl}
            onClick={() => choose("granted")}
          >
            {content.accept}
          </Button>
        </div>
      </div>
    </div>
  )
}

function readConsentCookie(cookieName: string): ConsentChoice | null {
  const value = readCookie(cookieName)
  if (value === "granted" || value === "denied") return value

  // Keep a previous rejection. A previous grant covered only Google Ads, so it
  // cannot be silently expanded to first-party marketing analytics.
  return readCookie(legacyGoogleConsentCookieName) === "denied"
    ? "denied"
    : null
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

function writeConsentCookie(cookieName: string, choice: ConsentChoice) {
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${cookieName}=${encodeURIComponent(
    choice
  )}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

function updateGoogleConsent(choice: ConsentChoice) {
  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    ((...args: unknown[]) => {
      window.dataLayer?.push(args)
    })

  const state = choice === "granted" ? "granted" : "denied"
  window.gtag("consent", "update", {
    ad_storage: state,
    analytics_storage: state,
    ad_user_data: state,
    ad_personalization: state,
  })
}

function ensureGoogleAdsRuntime({
  choice,
  globalPrivacyControl,
  googleAdsId,
  privacyRegion,
}: {
  choice: ConsentChoice | null | undefined
  globalPrivacyControl: boolean
  googleAdsId: string
  privacyRegion: MarketingPrivacyRegion
}) {
  if (
    window.__cuadrabotGoogleAdsConfigured ||
    (Array.isArray(window.dataLayer) && typeof window.gtag === "function")
  ) {
    window.__cuadrabotGoogleAdsConfigured = true
    return
  }

  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    ((...args: unknown[]) => {
      window.dataLayer?.push(args)
    })

  const state = globalPrivacyControl
    ? "denied"
    : choice === "granted"
      ? "granted"
      : choice === "denied" || privacyRegion !== "standard"
        ? "denied"
        : "granted"

  window.gtag("consent", "update", {
    ad_storage: state,
    analytics_storage: state,
    ad_user_data: state,
    ad_personalization: state,
  })
  window.gtag("set", "ads_data_redaction", true)
  window.gtag("js", new Date())
  window.gtag("config", googleAdsId)
  window.__cuadrabotGoogleAdsConfigured = true
}
