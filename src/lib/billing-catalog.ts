import "server-only"

import type Stripe from "stripe"
import { getOptionalEnv } from "@/lib/config"

export const BILLING_CATALOG_VERSION = 1

export type BillingKind = "credit_pack" | "subscription"
export type BillingInterval = "one_time" | "month"
export type BillingCheckoutMode = "payment" | "subscription"

type BillingCatalogDefinition = {
  sku: string
  name: string
  description: string
  kind: BillingKind
  checkoutMode: BillingCheckoutMode
  billingInterval: BillingInterval
  credits: number
  priceCents: number
  currency: "usd"
  priceEnvName: string
}

export const BILLING_CATALOG = [
  {
    sku: "credits-550",
    name: "550 Credits",
    description: "One-time pack of 550 Cuadrabot takeoff credits.",
    kind: "credit_pack",
    checkoutMode: "payment",
    billingInterval: "one_time",
    credits: 550,
    priceCents: 50_000,
    currency: "usd",
    priceEnvName: "STRIPE_PRICE_CREDITS_550",
  },
  {
    sku: "credits-1800",
    name: "1,800 Credits",
    description: "One-time pack of 1,800 Cuadrabot takeoff credits.",
    kind: "credit_pack",
    checkoutMode: "payment",
    billingInterval: "one_time",
    credits: 1_800,
    priceCents: 150_000,
    currency: "usd",
    priceEnvName: "STRIPE_PRICE_CREDITS_1800",
  },
  {
    sku: "credits-5000",
    name: "5,000 Credits",
    description: "One-time pack of 5,000 Cuadrabot takeoff credits.",
    kind: "credit_pack",
    checkoutMode: "payment",
    billingInterval: "one_time",
    credits: 5_000,
    priceCents: 400_000,
    currency: "usd",
    priceEnvName: "STRIPE_PRICE_CREDITS_5000",
  },
  {
    sku: "solo-monthly",
    name: "Solo",
    description: "Monthly Solo subscription with 300 takeoff credits.",
    kind: "subscription",
    checkoutMode: "subscription",
    billingInterval: "month",
    credits: 300,
    priceCents: 24_900,
    currency: "usd",
    priceEnvName: "STRIPE_PRICE_SOLO_MONTHLY",
  },
  {
    sku: "team-monthly",
    name: "Team",
    description: "Monthly Team subscription with 780 takeoff credits.",
    kind: "subscription",
    checkoutMode: "subscription",
    billingInterval: "month",
    credits: 780,
    priceCents: 59_900,
    currency: "usd",
    priceEnvName: "STRIPE_PRICE_TEAM_MONTHLY",
  },
  {
    sku: "office-monthly",
    name: "Office",
    description: "Monthly Office subscription with 1,650 takeoff credits.",
    kind: "subscription",
    checkoutMode: "subscription",
    billingInterval: "month",
    credits: 1_650,
    priceCents: 119_900,
    currency: "usd",
    priceEnvName: "STRIPE_PRICE_OFFICE_MONTHLY",
  },
] as const satisfies readonly BillingCatalogDefinition[]

export type BillingSku = (typeof BILLING_CATALOG)[number]["sku"]
export type BillingCatalogItem = (typeof BILLING_CATALOG)[number]
export type ConfiguredBillingCatalogItem = BillingCatalogItem & {
  priceId: string
}

export type PublicBillingCatalogItem = Omit<
  BillingCatalogItem,
  "priceEnvName"
> & {
  available: boolean
}

export class BillingCatalogConfigurationError extends Error {
  readonly code = "billing_catalog_not_configured"
  readonly envNames: string[]

  constructor(message: string, envNames: string[] = []) {
    super(message)
    this.name = "BillingCatalogConfigurationError"
    this.envNames = envNames
  }
}

export function isBillingSku(value: unknown): value is BillingSku {
  return (
    typeof value === "string" &&
    BILLING_CATALOG.some((item) => item.sku === value)
  )
}

export function getBillingCatalogItem(sku: BillingSku): BillingCatalogItem {
  const item = BILLING_CATALOG.find((candidate) => candidate.sku === sku)

  if (!item) {
    throw new Error(`Unknown billing SKU: ${sku}`)
  }

  return item
}

export function getConfiguredBillingCatalogItem(
  sku: BillingSku
): ConfiguredBillingCatalogItem {
  const item = getBillingCatalogItem(sku)
  const priceId = readPriceId(item.priceEnvName)

  if (!priceId) {
    throw new BillingCatalogConfigurationError(
      `Billing SKU ${sku} is unavailable because ${item.priceEnvName} is missing or invalid.`,
      [item.priceEnvName]
    )
  }

  assertPriceIdIsUnique(priceId, item.priceEnvName)

  return { ...item, priceId }
}

export function findBillingCatalogItemByPriceId(
  priceId: string
): ConfiguredBillingCatalogItem | null {
  const matches = BILLING_CATALOG.flatMap((item) => {
    const configuredPriceId = readPriceId(item.priceEnvName)

    return configuredPriceId === priceId
      ? [{ ...item, priceId: configuredPriceId }]
      : []
  })

  if (matches.length > 1) {
    throw new BillingCatalogConfigurationError(
      `Stripe Price ${priceId} is assigned to more than one billing SKU.`,
      matches.map((item) => item.priceEnvName)
    )
  }

  return matches[0] ?? null
}

export function getPublicBillingCatalog(): PublicBillingCatalogItem[] {
  return BILLING_CATALOG.map(({ priceEnvName, ...item }) => ({
    ...item,
    available: Boolean(readPriceId(priceEnvName)),
  }))
}

export function getBillingCatalogConfigurationIssues() {
  const issues: Array<{
    code: "missing_or_invalid_price_id" | "duplicate_price_id"
    envNames: string[]
  }> = []
  const priceEnvNames = new Map<string, string[]>()

  for (const item of BILLING_CATALOG) {
    const priceId = readPriceId(item.priceEnvName)

    if (!priceId) {
      issues.push({
        code: "missing_or_invalid_price_id",
        envNames: [item.priceEnvName],
      })
      continue
    }

    priceEnvNames.set(priceId, [
      ...(priceEnvNames.get(priceId) ?? []),
      item.priceEnvName,
    ])
  }

  for (const envNames of priceEnvNames.values()) {
    if (envNames.length > 1) {
      issues.push({ code: "duplicate_price_id", envNames })
    }
  }

  return issues
}

export function assertStripePriceMatchesCatalog(
  price: Stripe.Price,
  item: ConfiguredBillingCatalogItem
) {
  const correctCommonFields =
    price.id === item.priceId &&
    price.active &&
    price.currency === item.currency &&
    price.unit_amount === item.priceCents &&
    price.billing_scheme === "per_unit"
  const correctBillingShape =
    item.kind === "credit_pack"
      ? price.type === "one_time" && price.recurring === null
      : price.type === "recurring" &&
        price.recurring?.interval === item.billingInterval &&
        price.recurring.interval_count === 1 &&
        price.recurring.usage_type === "licensed"

  if (!correctCommonFields || !correctBillingShape) {
    throw new BillingCatalogConfigurationError(
      `Stripe Price configured for ${item.sku} does not match the server catalog.`,
      [item.priceEnvName]
    )
  }
}

export function getStripePriceProductId(price: Stripe.Price) {
  const productId =
    typeof price.product === "string" ? price.product : price.product.id

  if (!productId.startsWith("prod_")) {
    throw new BillingCatalogConfigurationError(
      `Stripe Price ${price.id} is not linked to a valid Stripe Product.`
    )
  }

  return productId
}

function readPriceId(envName: string) {
  const value = getOptionalEnv(envName)?.trim()

  return value?.startsWith("price_") ? value : null
}

function assertPriceIdIsUnique(priceId: string, selectedEnvName: string) {
  const duplicateEnvNames = BILLING_CATALOG.filter(
    (item) => readPriceId(item.priceEnvName) === priceId
  ).map((item) => item.priceEnvName)

  if (duplicateEnvNames.length > 1) {
    throw new BillingCatalogConfigurationError(
      `${selectedEnvName} duplicates another Stripe Price configuration.`,
      duplicateEnvNames
    )
  }
}
