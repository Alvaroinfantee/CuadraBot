import type { OrderStatus } from "@/lib/types"

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export function formatDeliveryRange(min: number, max: number, locale: "en" | "es" = "en") {
  return `${min}-${max} ${locale === "es" ? "días hábiles" : "business days"}`
}

export function humanizeStatus(status: OrderStatus | string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    awaiting_payment: "Awaiting payment",
    paid_pending_processing: "Paid, pending processing",
    processing: "Processing",
    needs_review: "Needs review",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
    failed: "Failed",
  }

  return labels[status] ?? status
}

export function statusTone(status: OrderStatus | string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (status === "failed" || status === "cancelled" || status === "refunded") {
    return "border-red-200 bg-red-50 text-red-800"
  }
  if (status === "processing" || status === "needs_review") {
    return "border-blue-200 bg-blue-50 text-blue-800"
  }
  return "border-neutral-200 bg-neutral-50 text-neutral-700"
}
