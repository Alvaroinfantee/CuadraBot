export const stripeTestPromotionSku = "credits-550" as const
export const stripeTestCheckoutSubtotalCents = 200
export const stripeTestPromotionTtlSeconds = 30 * 60

export function stripeTestDiscountAmount(priceCents: number) {
  if (
    !Number.isSafeInteger(priceCents) ||
    priceCents <= stripeTestCheckoutSubtotalCents
  ) {
    throw new Error("The Stripe test pack price must be greater than $2.")
  }

  return priceCents - stripeTestCheckoutSubtotalCents
}

export function stripeTestPromotionExpiry(nowSeconds: number) {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 1) {
    throw new Error("A valid current timestamp is required.")
  }

  return nowSeconds + stripeTestPromotionTtlSeconds
}

export function buildStripeTestPromotionCode(entropy: string) {
  const normalized = entropy.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()

  if (normalized.length < 24) {
    throw new Error("At least 24 characters of promotion-code entropy are required.")
  }

  return `CUADRA2-${normalized.slice(0, 24)}`
}
