import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  buildStripeTestPromotionCode,
  stripeTestCheckoutSubtotalCents,
  stripeTestDiscountAmount,
  stripeTestPromotionExpiry,
  stripeTestPromotionTtlSeconds,
} from "../src/lib/stripe-test-promotion-policy"

const route = readFileSync(
  new URL(
    "../src/app/api/admin/billing/stripe-test-promotion/route.ts",
    import.meta.url
  ),
  "utf8"
)

test("the owner test leaves exactly a $2 subtotal for the Starter pack", () => {
  assert.equal(stripeTestCheckoutSubtotalCents, 200)
  assert.equal(stripeTestDiscountAmount(50_000), 49_800)
  assert.throws(() => stripeTestDiscountAmount(200))
})

test("test codes are high-entropy and expire after 30 minutes", () => {
  assert.equal(stripeTestPromotionTtlSeconds, 1_800)
  assert.equal(stripeTestPromotionExpiry(1_000), 2_800)
  assert.equal(
    buildStripeTestPromotionCode("12345678-1234-1234-1234-123456789abc"),
    "CUADRA2-123456781234123412341234"
  )
  assert.throws(() => buildStripeTestPromotionCode("too-short"))
})

test("the generator is admin-only and every discount escape hatch is fixed server-side", () => {
  const authCheck = route.indexOf('profile.role !== "admin"')
  const stripeAccess = route.indexOf("const stripe = getStripe()")

  assert.ok(authCheck >= 0)
  assert.ok(stripeAccess > authCheck)
  assert.match(route, /x-cuadrabot-confirm/)
  assert.match(route, /applies_to: \{ products: \[productId\] \}/)
  assert.match(route, /customer: customerId/)
  assert.match(route, /max_redemptions: 1/g)
  assert.match(route, /expires_at: expiresAt/)
  assert.match(route, /redeem_by: expiresAt/)
  assert.match(route, /stripeTestDiscountAmount\(item\.priceCents\)/)
  assert.match(route, /buildStripeTestPromotionCode\(profile\.id\)/)
  assert.doesNotMatch(route, /buildStripeTestPromotionCode\(attemptId\)/)
  assert.match(route, /stripe_test_promotion\.created/)
  assert.match(route, /promotionCodes\.update\(promotionCodeId, \{ active: false \}\)/)
})
