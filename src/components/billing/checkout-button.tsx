"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function CheckoutButton({
  sku,
  children,
  variant = "default",
}: {
  sku: string
  children: React.ReactNode
  variant?: "default" | "outline"
}) {
  const [busy, setBusy] = useState(false)

  async function checkout() {
    setBusy(true)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Checkout is not available.")
      }
      window.location.assign(payload.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed.")
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

export function BillingPortalButton() {
  const [busy, setBusy] = useState(false)

  async function openPortal() {
    setBusy(true)
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const payload = await response.json()
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Billing portal is not available.")
      }
      window.location.assign(payload.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open billing.")
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant="outline" disabled={busy} onClick={openPortal}>
      {busy ? <Loader2Icon className="animate-spin" /> : null}
      Manage billing
    </Button>
  )
}
