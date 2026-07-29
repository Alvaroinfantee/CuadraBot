"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  dashboardCopy,
  localizeBillingError,
} from "@/lib/dashboard-i18n"
import type { Locale } from "@/lib/i18n"

export function CheckoutButton({
  sku,
  children,
  variant = "default",
  locale = "en",
}: {
  sku: string
  children: React.ReactNode
  variant?: "default" | "outline"
  locale?: Locale
}) {
  const [busy, setBusy] = useState(false)
  const copy = dashboardCopy[locale].billing

  async function checkout() {
    setBusy(true)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku, locale }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.url) {
        throw new Error(
          localizeBillingError(
            payload.code,
            payload.error,
            locale,
            copy.checkoutUnavailable
          )
        )
      }
      window.location.assign(payload.url)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.checkoutFailed
      )
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      className="w-full"
      disabled={busy}
      onClick={checkout}
    >
      {busy ? <Loader2Icon className="animate-spin" /> : null}
      {children}
    </Button>
  )
}

export function BillingPortalButton({
  locale = "en",
}: {
  locale?: Locale
}) {
  const [busy, setBusy] = useState(false)
  const copy = dashboardCopy[locale].billing

  async function openPortal() {
    setBusy(true)
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.url) {
        throw new Error(
          localizeBillingError(
            payload.code,
            payload.error,
            locale,
            copy.portalUnavailable
          )
        )
      }
      window.location.assign(payload.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.portalFailed)
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant="outline" disabled={busy} onClick={openPortal}>
      {busy ? <Loader2Icon className="animate-spin" /> : null}
      {copy.manageBilling}
    </Button>
  )
}
