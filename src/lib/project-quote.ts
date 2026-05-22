export type QuoteMarket = "usa" | "spain" | "dominican"
export type QuoteComplexity = "simple" | "standard" | "detailed" | "premium"
export type QuoteDeliverySpeed = "standard" | "rush48" | "rush24"
export type QuoteProjectType =
  | "house"
  | "apartment"
  | "interior"
  | "renovation"
  | "commercial"
  | "development"

export type ProjectQuoteInput = {
  market: QuoteMarket
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

export type QuoteMarketConfig = {
  market: QuoteMarket
  currency: "usd" | "eur" | "dop"
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
  config: QuoteMarketConfig
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

export const quoteMarketConfigs: Record<QuoteMarket, QuoteMarketConfig> = {
  usa: {
    market: "usa",
    currency: "usd",
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
  },
  spain: {
    market: "spain",
    currency: "eur",
    baseFeeCents: 7900,
    minimumTotalCents: 12900,
    includedViews: 1,
    includedRevisions: 1,
    additionalViewCents: 9500,
    revisionCents: 4000,
    manualReviewSquareMeters: 500,
    tiers: [
      { upTo: 200, rateCentsPerSquareMeter: 48 },
      { upTo: 500, rateCentsPerSquareMeter: 32 },
      { upTo: Number.POSITIVE_INFINITY, rateCentsPerSquareMeter: 20 },
    ],
  },
  dominican: {
    market: "dominican",
    currency: "dop",
    baseFeeCents: 490000,
    minimumTotalCents: 690000,
    includedViews: 1,
    includedRevisions: 1,
    additionalViewCents: 650000,
    revisionCents: 275000,
    manualReviewSquareMeters: 500,
    tiers: [
      { upTo: 200, rateCentsPerSquareMeter: 3200 },
      { upTo: 500, rateCentsPerSquareMeter: 2200 },
      { upTo: Number.POSITIVE_INFINITY, rateCentsPerSquareMeter: 1400 },
    ],
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
  const config = quoteMarketConfigs[input.market]
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
  const totalCents = roundForMarket(multipliedCents + minimumAdjustmentCents, config.currency)
  const lowCents = roundForMarket(totalCents * 0.9, config.currency, "floor")
  const highCents = roundForMarket(totalCents * 1.15, config.currency)
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

export function formatQuoteMoney(cents: number, config: QuoteMarketConfig) {
  const locale =
    config.market === "usa" ? "en-US" : config.market === "spain" ? "es-ES" : "es-DO"

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: config.currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100)
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

function roundForMarket(
  cents: number,
  currency: QuoteMarketConfig["currency"],
  direction: "ceil" | "floor" = "ceil"
) {
  const step = currency === "dop" ? 10000 : 500
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
  config: QuoteMarketConfig
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
