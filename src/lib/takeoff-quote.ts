import { formatQuoteMoney, type QuoteCurrency } from "@/lib/project-quote"

export const takeoffInternalPackageSlug = "basic-render"
export const takeoffPageRateCents = 3000
export const takeoffDeliveryDaysMax = 7

export type TakeoffQuoteFile = {
  name: string
  pageCount: number
  sizeBytes: number
}

export type TakeoffQuoteInput = {
  currency: QuoteCurrency
  pageCount: number
  files: TakeoffQuoteFile[]
}

export type TakeoffQuote = TakeoffQuoteInput & {
  rateCentsPerPage: number
  totalCents: number
  deliveryDaysMax: number
}

export function calculateTakeoffQuote(input: TakeoffQuoteInput): TakeoffQuote {
  return {
    ...input,
    rateCentsPerPage: takeoffPageRateCents,
    totalCents: input.pageCount * takeoffPageRateCents,
    deliveryDaysMax: takeoffDeliveryDaysMax,
  }
}

export function formatTakeoffMoney(cents: number, currency: QuoteCurrency) {
  return formatQuoteMoney(cents, {
    currency,
    baseFeeCents: 0,
    minimumTotalCents: 0,
    includedViews: 0,
    includedRevisions: 0,
    additionalViewCents: 0,
    revisionCents: 0,
    tiers: [],
    manualReviewSquareMeters: 0,
  })
}

export function formatTakeoffQuoteForNotes(quote: TakeoffQuote) {
  const fileLines = quote.files.map(
    (file) => `- ${file.name}: ${file.pageCount} pages`
  )
  const lines = [
    "Service: takeoff",
    `Currency: ${quote.currency.toUpperCase()}`,
    `PDF pages: ${quote.pageCount}`,
    `Rate: ${formatTakeoffMoney(quote.rateCentsPerPage, quote.currency)} per page`,
    `Total: ${formatTakeoffMoney(quote.totalCents, quote.currency)}`,
    `Delivery: within ${quote.deliveryDaysMax} days`,
    "Client reminder: PDF must include a scale.",
    "Uploaded PDFs:",
    ...fileLines,
  ]

  return lines.join("\n")
}

export function isTakeoffOrderNotes(notes: string | null | undefined) {
  return Boolean(notes?.includes("Service: takeoff"))
}
