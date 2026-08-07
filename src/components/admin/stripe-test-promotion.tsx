"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

type StripeTestPromotion = {
  code: string
  expiresAt: number
  sku: string
  originalAmountCents: number
  checkoutSubtotalCents: number
  automaticTaxEnabled: boolean
}

export function StripeTestPromotionCard() {
  const [promotion, setPromotion] = useState<StripeTestPromotion | null>(null)
  const [busy, setBusy] = useState<"create" | "checkout" | null>(null)
  const [copied, setCopied] = useState(false)

  async function createPromotion() {
    setBusy("create")
    setCopied(false)

    try {
      const response = await fetch(
        "/api/admin/billing/stripe-test-promotion",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-cuadrabot-confirm": "live-owner-stripe-test",
          },
          body: "{}",
        }
      )
      const payload = await response.json()

      if (!response.ok || !payload.code) {
        throw new Error(payload.error || "Could not create the Stripe test code.")
      }

      setPromotion(payload as StripeTestPromotion)
      toast.success("One-time Stripe test code created.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create the Stripe test code."
      )
    } finally {
      setBusy(null)
    }
  }

  async function copyCode() {
    if (!promotion) return
    await navigator.clipboard.writeText(promotion.code)
    setCopied(true)
    toast.success("Promotion code copied.")
  }

  async function openCheckout() {
    if (!promotion) return
    setBusy("checkout")

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: promotion.sku, locale: "en" }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Could not open Stripe Checkout.")
      }

      window.location.assign(payload.url)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open Stripe Checkout."
      )
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Creates a real, customer-bound promotion for the $500 Starter pack.
        It can be redeemed once, expires after 30 minutes, and leaves a $2 USD
        subtotal. The normal signed webhook still grants 550 credits.
      </p>

      {!promotion ? (
        <Button type="button" onClick={createPromotion} disabled={busy !== null}>
          {busy === "create" ? <Loader2Icon className="animate-spin" /> : null}
          Create one-time $2 test code
        </Button>
      ) : (
        <div className="space-y-4 border bg-slate-50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer-bound promotion code
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="border bg-white px-3 py-2 text-base font-semibold">
                {promotion.code}
              </code>
              <Button type="button" size="sm" variant="outline" onClick={copyCode}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Expires {new Date(promotion.expiresAt * 1_000).toLocaleString()}.
              {promotion.automaticTaxEnabled
                ? " Automatic tax is enabled, so tax may be added to the $2 subtotal."
                : " Checkout total before any card-provider effects is $2.00 USD."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={openCheckout} disabled={busy !== null}>
              {busy === "checkout" ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <ExternalLinkIcon />
              )}
              Open real Stripe Checkout
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={createPromotion}
              disabled={busy !== null}
            >
              Recover current code
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs leading-5 text-amber-800">
        Copy the code, open Checkout, expand “Add promotion code,” and paste it.
        After the test, refund the charge before spending credits so the refund
        webhook can reverse all 550 credits cleanly.
      </p>
    </div>
  )
}
