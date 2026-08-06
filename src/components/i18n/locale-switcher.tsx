"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LanguagesIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  commonCopy,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n"

export function LocaleSwitcher({
  locale,
  compact = false,
  inverse = false,
}: {
  locale: Locale
  compact?: boolean
  inverse?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const targetLocale: Locale = locale === "es" ? "en" : "es"
  const suffix = searchParams.size ? `?${searchParams.toString()}` : ""
  const label =
    targetLocale === "es"
      ? commonCopy[locale].switchToSpanish
      : commonCopy[locale].switchToEnglish

  useEffect(() => {
    const previousDocumentLocale = document.documentElement.lang
    document.documentElement.lang = locale
    void fetch("/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale }),
      keepalive: true,
    })

    return () => {
      if (document.documentElement.lang === locale) {
        document.documentElement.lang = previousDocumentLocale
      }
    }
  }, [locale])

  async function switchLocale() {
    setBusy(true)
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: targetLocale }),
      })
      if (!response.ok) throw new Error("locale")
      const targetPath = switchLocalePath(
        `${pathname}${suffix}${window.location.hash}`,
        targetLocale
      )
      router.push(targetPath)
      router.refresh()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      onClick={switchLocale}
      disabled={busy}
      aria-label={label}
      title={label}
      className={
        inverse
          ? "text-slate-300 hover:bg-white/10 hover:text-white"
          : undefined
      }
    >
      {busy ? <Loader2Icon className="animate-spin" /> : <LanguagesIcon />}
      {compact ? null : targetLocale.toUpperCase()}
    </Button>
  )
}
