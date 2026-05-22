export const quoteCurrencies = ["usd", "eur"] as const
export const quoteComplexities = ["simple", "standard", "detailed", "premium"] as const
export const quoteDeliverySpeeds = ["standard", "rush48", "rush24"] as const
export const quoteProjectTypes = [
  "house",
  "apartment",
  "interior",
  "renovation",
  "commercial",
  "development",
] as const

export type QuoteCurrency = (typeof quoteCurrencies)[number]
export type QuoteComplexity = (typeof quoteComplexities)[number]
export type QuoteDeliverySpeed = (typeof quoteDeliverySpeeds)[number]
export type QuoteProjectType = (typeof quoteProjectTypes)[number]

export type ProjectQuoteInput = {
  currency: QuoteCurrency
  squareMeters: number
  views: number
  revisions: number
  floors: number
  complexity: QuoteComplexity
  deliverySpeed: QuoteDeliverySpeed
  projectType: QuoteProjectType
  sparsePlans: boolean
  advancedSiteContext: boolean
}

type AreaTier = {
  upTo: number
  rateCentsPerSquareMeter: number
}

export type QuoteCurrencyConfig = {
  currency: QuoteCurrency
  baseFeeCents: number
  minimumTotalCents: number
  includedViews: number
  includedRevisions: number
  additionalViewCents: number
  revisionCents: number
  tiers: AreaTier[]
  manualReviewSquareMeters: number
}

export type QuoteBreakdownLine = {
  key:
    | "base"
    | "area"
    | "views"
    | "revisions"
    | "scopeMultiplier"
    | "minimumAdjustment"
  amountCents: number
}

export type ProjectQuote = {
  input: ProjectQuoteInput
  config: QuoteCurrencyConfig
  directSubtotalCents: number
  multiplier: number
  minimumAdjustmentCents: number
  totalCents: number
  lowCents: number
  highCents: number
  averagePerViewCents: number
  breakdown: QuoteBreakdownLine[]
  requiresManualReview: boolean
  manualReviewReasons: string[]
  recommendedPackageSlug: "basic-render" | "pro-render" | "premium-render-pack"
}

export const defaultProjectQuoteInput: ProjectQuoteInput = {
  currency: "usd",
  squareMeters: 150,
  views: 2,
  revisions: 2,
  floors: 1,
  complexity: "standard",
  deliverySpeed: "standard",
  projectType: "house",
  sparsePlans: false,
  advancedSiteContext: false,
}

const globalQuoteConfig = {
  baseFeeCents: 9900,
  minimumTotalCents: 14900,
  includedViews: 1,
  includedRevisions: 1,
  additionalViewCents: 11000,
  revisionCents: 4500,
  manualReviewSquareMeters: 500,
  tiers: [
    { upTo: 200, rateCentsPerSquareMeter: 55 },
    { upTo: 500, rateCentsPerSquareMeter: 35 },
    { upTo: Number.POSITIVE_INFINITY, rateCentsPerSquareMeter: 22 },
  ],
} satisfies Omit<QuoteCurrencyConfig, "currency">

export const quoteCurrencyConfigs: Record<QuoteCurrency, QuoteCurrencyConfig> = {
  usd: {
    ...globalQuoteConfig,
    currency: "usd",
  },
  eur: {
    ...globalQuoteConfig,
    currency: "eur",
  },
}

const complexityMultipliers: Record<QuoteComplexity, number> = {
  simple: 0.85,
  standard: 1,
  detailed: 1.25,
  premium: 1.5,
}

const deliveryMultipliers: Record<QuoteDeliverySpeed, number> = {
  standard: 1,
  rush48: 1.3,
  rush24: 1.45,
}

const projectTypeMultipliers: Record<QuoteProjectType, number> = {
  house: 1,
  apartment: 0.95,
  interior: 0.95,
  renovation: 1.1,
  commercial: 1.2,
  development: 1.35,
}

export function calculateProjectQuote(input: ProjectQuoteInput): ProjectQuote {
  const config = quoteCurrencyConfigs[input.currency]
  const areaChargeCents = calculateTieredAreaCharge(input.squareMeters, config.tiers)
  const viewChargeCents =
    Math.max(0, input.views - config.includedViews) * config.additionalViewCents
  const revisionChargeCents =
    Math.max(0, input.revisions - config.includedRevisions) * config.revisionCents
  const directSubtotalCents =
    config.baseFeeCents + areaChargeCents + viewChargeCents + revisionChargeCents
  const floorMultiplier = 1 + Math.min(Math.max(0, input.floors - 2) * 0.05, 0.25)
  const planMultiplier = input.sparsePlans ? 1.18 : 1
  const siteMultiplier = input.advancedSiteContext ? 1.12 : 1
  const multiplier =
    complexityMultipliers[input.complexity] *
    deliveryMultipliers[input.deliverySpeed] *
    projectTypeMultipliers[input.projectType] *
    floorMultiplier *
    planMultiplier *
    siteMultiplier
  const multipliedCents = directSubtotalCents * multiplier
  const minimumAdjustmentCents = Math.max(0, config.minimumTotalCents - multipliedCents)
  const totalCents = roundQuoteCents(multipliedCents + minimumAdjustmentCents)
  const lowCents = roundQuoteCents(totalCents * 0.9, "floor")
  const highCents = roundQuoteCents(totalCents * 1.15)
  const manualReviewReasons = getManualReviewReasons(input, config)
  const scopeMultiplierCents = totalCents - directSubtotalCents - minimumAdjustmentCents
  const breakdown: QuoteBreakdownLine[] = [
    { key: "base", amountCents: config.baseFeeCents },
    { key: "area", amountCents: areaChargeCents },
    { key: "views", amountCents: viewChargeCents },
    { key: "revisions", amountCents: revisionChargeCents },
    { key: "scopeMultiplier", amountCents: scopeMultiplierCents },
    { key: "minimumAdjustment", amountCents: minimumAdjustmentCents },
  ]

  return {
    input,
    config,
    directSubtotalCents,
    multiplier,
    minimumAdjustmentCents,
    totalCents,
    lowCents,
    highCents,
    averagePerViewCents: Math.round(totalCents / Math.max(1, input.views)),
    requiresManualReview: manualReviewReasons.length > 0,
    manualReviewReasons,
    recommendedPackageSlug: getRecommendedPackageSlug(input.views),
    breakdown: breakdown.filter((line) => line.amountCents !== 0),
  }
}

export function projectQuoteInputToSearchParams(input: ProjectQuoteInput) {
  const params = new URLSearchParams()

  params.set("quote", "1")
  params.set("currency", input.currency)
  params.set("sqm", String(input.squareMeters))
  params.set("views", String(input.views))
  params.set("revisions", String(input.revisions))
  params.set("floors", String(input.floors))
  params.set("complexity", input.complexity)
  params.set("delivery", input.deliverySpeed)
  params.set("project", input.projectType)
  params.set("sparse", input.sparsePlans ? "1" : "0")
  params.set("site", input.advancedSiteContext ? "1" : "0")

  return params
}

export function parseProjectQuoteInput(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): ProjectQuoteInput | null {
  if (getParam(params, "quote") !== "1") return null

  const currency =
    getEnumParam(params, "currency", quoteCurrencies) ?? getCurrencyFromLegacyParams(params)
  const complexity = getEnumParam(params, "complexity", quoteComplexities)
  const deliverySpeed = getEnumParam(params, "delivery", quoteDeliverySpeeds)
  const projectType = getEnumParam(params, "project", quoteProjectTypes)

  if (!currency || !complexity || !deliverySpeed || !projectType) {
    return null
  }

  return {
    currency,
    squareMeters: getNumberParam(params, "sqm", 1, 5000),
    views: Math.round(getNumberParam(params, "views", 1, 12)),
    revisions: Math.round(getNumberParam(params, "revisions", 0, 8)),
    floors: Math.round(getNumberParam(params, "floors", 1, 20)),
    complexity,
    deliverySpeed,
    projectType,
    sparsePlans: getBooleanParam(params, "sparse"),
    advancedSiteContext: getBooleanParam(params, "site"),
  }
}

export function projectTypeToOrderProjectType(projectType: QuoteProjectType) {
  const labels: Record<QuoteProjectType, string> = {
    house: "House",
    apartment: "Apartment",
    interior: "Apartment",
    renovation: "Renovation",
    commercial: "Commercial",
    development: "Real estate development",
  }

  return labels[projectType]
}

export function formatProjectQuoteForNotes(quote: ProjectQuote) {
  const lines = [
    "Project quote",
    `Currency: ${quote.input.currency.toUpperCase()}`,
    `Area: ${quote.input.squareMeters} m2`,
    `Views: ${quote.input.views}`,
    `Revisions: ${quote.input.revisions}`,
    `Floors: ${quote.input.floors}`,
    `Project type: ${quote.input.projectType}`,
    `Complexity: ${quote.input.complexity}`,
    `Delivery: ${quote.input.deliverySpeed}`,
    `Sparse plans: ${quote.input.sparsePlans ? "yes" : "no"}`,
    `Complex site context: ${quote.input.advancedSiteContext ? "yes" : "no"}`,
    `Total: ${formatQuoteMoney(quote.totalCents, quote.config)}`,
  ]

  if (quote.requiresManualReview) {
    lines.push(`Manual review: ${quote.manualReviewReasons.join(", ")}`)
  }

  return lines.join("\n")
}

export function formatQuoteMoney(cents: number, config: QuoteCurrencyConfig) {
  const locale = config.currency === "eur" ? "es-ES" : "en-US"

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: config.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function getParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
) {
  if (params instanceof URLSearchParams) {
    return params.get(key)
  }

  const value = params[key]

  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function getEnumParam<const Values extends readonly string[]>(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
  values: Values
): Values[number] | null {
  const value = getParam(params, key)

  return values.includes(value ?? "") ? (value as Values[number]) : null
}

function getNumberParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
  min: number,
  max: number
) {
  const value = Number(getParam(params, key))

  if (!Number.isFinite(value)) return min

  return Math.min(Math.max(value, min), max)
}

function getBooleanParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
) {
  const value = getParam(params, key)

  return value === "1" || value === "true"
}

function getCurrencyFromLegacyParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): QuoteCurrency | null {
  const legacyValue = getParam(params, "market")

  if (legacyValue === "spain") return "eur"
  if (legacyValue === "usa" || legacyValue === "dominican") return "usd"

  return null
}

function calculateTieredAreaCharge(squareMeters: number, tiers: AreaTier[]) {
  let remainingSquareMeters = Math.max(0, squareMeters)
  let previousLimit = 0
  let chargeCents = 0

  for (const tier of tiers) {
    if (remainingSquareMeters <= 0) break

    const tierSize = Math.min(remainingSquareMeters, tier.upTo - previousLimit)
    chargeCents += tierSize * tier.rateCentsPerSquareMeter
    remainingSquareMeters -= tierSize
    previousLimit = tier.upTo
  }

  return Math.round(chargeCents)
}

function roundQuoteCents(
  cents: number,
  direction: "ceil" | "floor" = "ceil"
) {
  const step = 500
  const rounded = cents / step

  return (direction === "floor" ? Math.floor(rounded) : Math.ceil(rounded)) * step
}

function getRecommendedPackageSlug(views: number): ProjectQuote["recommendedPackageSlug"] {
  if (views <= 1) return "basic-render"
  if (views <= 2) return "pro-render"
  return "premium-render-pack"
}

function getManualReviewReasons(
  input: ProjectQuoteInput,
  config: QuoteCurrencyConfig
) {
  const reasons: string[] = []

  if (input.squareMeters > config.manualReviewSquareMeters) {
    reasons.push("large_project")
  }

  if (input.views > 6) {
    reasons.push("many_views")
  }

  if (input.projectType === "development" && input.squareMeters > 300) {
    reasons.push("development_scope")
  }

  if (input.deliverySpeed === "rush24" && input.views > 3) {
    reasons.push("rush_scope")
  }

  if (input.sparsePlans && input.complexity === "premium") {
    reasons.push("premium_sparse_plans")
  }

  return reasons
}
