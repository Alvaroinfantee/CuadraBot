"use client"

import { useEffect } from "react"
import { googleAdsPurchaseDestination } from "@/lib/google-ads"

export function GoogleAdsPurchaseConversion({
  currency,
  transactionId,
  valueCents,
}: {
  currency: string | null
  transactionId: string | null
  valueCents: number | null
}) {
  useEffect(() => {
    if (
      !googleAdsPurchaseDestination ||
      !transactionId ||
      !Number.isSafeInteger(valueCents) ||
      !valueCents ||
      valueCents < 1 ||
      !currency ||
      !/^[a-z]{3}$/i.test(currency)
    ) {
      return
    }

    const storageKey = `cuadrabot:google-ads:purchase:${transactionId}`
    try {
      if (window.sessionStorage.getItem(storageKey)) return
    } catch {
      // Storage can be unavailable in hardened browsers. Google still
      // deduplicates repeated events with the server-generated transaction ID.
    }

    window.dataLayer = window.dataLayer || []
    window.gtag =
      window.gtag ||
      ((...args: unknown[]) => {
        window.dataLayer?.push(args)
      })
    window.gtag("event", "conversion", {
      send_to: googleAdsPurchaseDestination,
      value: Number((valueCents / 100).toFixed(2)),
      currency: currency.toUpperCase(),
      transaction_id: transactionId,
    })
    try {
      window.sessionStorage.setItem(storageKey, "sent")
    } catch {
      // The conversion was queued successfully even if storage is unavailable.
    }
  }, [currency, transactionId, valueCents])

  return null
}
