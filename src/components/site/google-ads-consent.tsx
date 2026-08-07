"use client"

import Link from "next/link"
import { useCallback, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n"

type ConsentChoice = "granted" | "denied"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const consentChangedEvent = "cuadrabot:google-consent-changed"

const copy = {
  en: {
    label: "Advertising cookie choices",
    title: "Your privacy choices",
    body: "With your permission, Cuadrabot uses Google Ads measurement to understand whether an ad leads to a purchase. Necessary account and security cookies always remain available.",
    privacy: "Privacy policy",
    reject: "Reject advertising cookies",
    accept: "Allow advertising measurement",
    settings: "Cookie settings",
  },
  es: {
    label: "Opciones de cookies publicitarias",
    title: "Tus opciones de privacidad",
    body: "Con tu permiso, Cuadrabot utiliza la medición de Google Ads para saber si un anuncio termina en una compra. Las cookies necesarias de cuenta y seguridad siguen disponibles.",
    privacy: "Política de privacidad",
    reject: "Rechazar cookies publicitarias",
    accept: "Permitir medición publicitaria",
    settings: "Configurar cookies",
  },
} as const

export function GoogleAdsConsent({
  cookieName,
  locale,
}: {
  cookieName: string
  locale: Locale
}) {
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const content = copy[locale]
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener(consentChangedEvent, onStoreChange)
    return () => window.removeEventListener(consentChangedEvent, onStoreChange)
  }, [])
  const readChoice = useCallback(
    () => readConsentCookie(cookieName),
    [cookieName]
  )
  const choice = useSyncExternalStore(subscribe, readChoice, () => undefined)

  function choose(nextChoice: ConsentChoice) {
    writeConsentCookie(cookieName, nextChoice)
    updateGoogleConsent(nextChoice)
    window.dispatchEvent(new Event(consentChangedEvent))
    setPreferencesOpen(false)
  }

  if (choice === undefined) return null

  if (choice !== null && !preferencesOpen) {
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
            {content.body}{" "}
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
          <Button type="button" variant="outline" onClick={() => choose("denied")}>
            {content.reject}
          </Button>
          <Button type="button" onClick={() => choose("granted")}>
            {content.accept}
          </Button>
        </div>
      </div>
    </div>
  )
}

function readConsentCookie(cookieName: string): ConsentChoice | null {
  const prefix = `${cookieName}=`
  const entry = document.cookie
    .split("; ")
    .find((candidate) => candidate.startsWith(prefix))
  const value = entry ? decodeURIComponent(entry.slice(prefix.length)) : null

  return value === "granted" || value === "denied" ? value : null
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
