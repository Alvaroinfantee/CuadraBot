import type { TakeoffTrade } from "@/lib/takeoff-types"

export type TakeoffPricingTier =
  | "free_sample"
  | "first_verified"
  | "essential"
  | "professional"
  | "multi_trade"
  | "large_set"

export type TakeoffPrice = {
  tier: TakeoffPricingTier
  name: string
  credits: number
  priceCents: number
  turnaroundHours: number | null
  selfServe: boolean
  description: string
}

const prices: Record<TakeoffPricingTier, Omit<TakeoffPrice, "tier">> = {
  free_sample: {
    name: "One-sheet sample",
    credits: 0,
    priceCents: 0,
    turnaroundHours: 8,
    selfServe: true,
    description:
      "One real sheet with a readable legend, one scope, once per company.",
  },
  first_verified: {
    name: "First verified takeoff",
    credits: 49,
    priceCents: 4_900,
    turnaroundHours: 8,
    selfServe: true,
    description: "One legend-based scope and up to 5 plan pages.",
  },
  essential: {
    name: "Essential",
    credits: 99,
    priceCents: 9_900,
    turnaroundHours: 8,
    selfServe: true,
    description: "One legend-based scope and up to 10 plan pages.",
  },
  professional: {
    name: "Professional",
    credits: 179,
    priceCents: 17_900,
    turnaroundHours: 8,
    selfServe: true,
    description: "One legend-based scope and up to 25 plan pages.",
  },
  multi_trade: {
    name: "Multi-Scope",
    credits: 299,
    priceCents: 29_900,
    turnaroundHours: 8,
    selfServe: true,
    description:
      "Fixture/device counts plus cable/conduit runs, up to 25 plan pages.",
  },
  large_set: {
    name: "Large Set",
    credits: 499,
    priceCents: 49_900,
    turnaroundHours: 8,
    selfServe: true,
    description:
      "One or both legend-based outputs, up to 250 plan pages.",
  },
}

export function getTakeoffPrice(input: {
  mode: "sample" | "standard"
  pageCount: number
  trades: TakeoffTrade[]
  freeSampleAvailable: boolean
  firstPaidAvailable: boolean
}): TakeoffPrice {
  const { mode, pageCount, trades, freeSampleAvailable, firstPaidAvailable } =
    input
  const tradeCount = new Set(trades).size

  if (
    mode === "sample" &&
    freeSampleAvailable &&
    pageCount >= 1 &&
    tradeCount === 1
  ) {
    return withTier("free_sample")
  }

  if (tradeCount < 1 || pageCount < 1) return withTier("large_set")

  if (tradeCount === 1 && pageCount <= 5 && firstPaidAvailable) {
    return withTier("first_verified")
  }

  if (tradeCount === 1 && pageCount <= 10) return withTier("essential")
  if (tradeCount === 1 && pageCount <= 25) return withTier("professional")
  if (tradeCount <= 2 && pageCount <= 25) return withTier("multi_trade")

  return withTier("large_set")
}

export const servicePriceCards = [
  withTier("first_verified"),
  withTier("essential"),
  withTier("professional"),
  withTier("multi_trade"),
  withTier("large_set"),
] as const

export const creditPacks = [
  {
    sku: "credits-550",
    name: "Starter pack",
    credits: 550,
    priceCents: 50_000,
    bonus: 50,
  },
  {
    sku: "credits-1800",
    name: "Growth pack",
    credits: 1_800,
    priceCents: 150_000,
    bonus: 300,
  },
  {
    sku: "credits-5000",
    name: "Office pack",
    credits: 5_000,
    priceCents: 400_000,
    bonus: 1_000,
  },
] as const

export const subscriptionPlans = [
  {
    sku: "solo-monthly",
    name: "Solo",
    credits: 300,
    priceCents: 24_900,
  },
  {
    sku: "team-monthly",
    name: "Team",
    credits: 780,
    priceCents: 59_900,
  },
  {
    sku: "office-monthly",
    name: "Office",
    credits: 1_650,
    priceCents: 119_900,
  },
] as const

function withTier(tier: TakeoffPricingTier): TakeoffPrice {
  return { tier, ...prices[tier] }
}
