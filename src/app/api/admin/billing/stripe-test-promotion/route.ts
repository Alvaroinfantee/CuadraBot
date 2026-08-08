import { NextResponse } from "next/server"
import type Stripe from "stripe"
import {
  assertStripePriceMatchesCatalog,
  BillingCatalogConfigurationError,
  getConfiguredBillingCatalogItem,
  getStripePriceProductId,
} from "@/lib/billing-catalog"
import { getCurrentProfile } from "@/lib/auth"
import { stripeAutomaticTaxEnabled } from "@/lib/config"
import {
  buildStripeTestPromotionCode,
  stripeTestCheckoutSubtotalCents,
  stripeTestDiscountAmount,
  stripeTestPromotionExpiry,
  stripeTestPromotionSku,
} from "@/lib/stripe-test-promotion-policy"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getStripe,
  StripeConfigurationError,
} from "@/lib/stripe"
import { getOrCreateStripeCustomer } from "@/lib/stripe-customer"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const confirmationHeader = "live-owner-stripe-test"
const stripeTestCouponName = "Cuadrabot $2 live test"

class StripeTestPromotionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "StripeTestPromotionError"
  }
}

export async function POST(request: Request) {
  let stripe: Stripe | null = null
  let couponId: string | null = null
  let promotionCodeId: string | null = null

  try {
    const profile = await getCurrentProfile()

    if (!profile) {
      return jsonError("Authentication is required.", 401)
    }

    if (profile.role !== "admin" || profile.status !== "active") {
      return jsonError("Active administrator access is required.", 403)
    }

    if (request.headers.get("x-cuadrabot-confirm") !== confirmationHeader) {
      return jsonError("Explicit live-test confirmation is required.", 400)
    }

    stripe = getStripe()
    const supabase = createSupabaseAdminClient()
    const attemptId = crypto.randomUUID()
    const item = getConfiguredBillingCatalogItem(stripeTestPromotionSku)
    const [price, customerId] = await Promise.all([
      stripe.prices.retrieve(item.priceId, { expand: ["product"] }),
      getOrCreateStripeCustomer(stripe, {
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        stripeCustomerId: profile.stripe_customer_id,
        createdFor: "owner_live_checkout_test",
      }),
    ])
    assertStripePriceMatchesCatalog(price, item)

    const productId = getStripePriceProductId(price)
    const nowSeconds = Math.floor(Date.now() / 1_000)
    const expiresAt = stripeTestPromotionExpiry(nowSeconds)
    const existingPromotion = await findExistingTestPromotion({
      adminUserId: profile.id,
      customerId,
      nowSeconds,
    })

    if (existingPromotion?.status === "redeemed") {
      throw new StripeTestPromotionError(
        "The owner live-checkout test has already been redeemed. Refund that charge instead of creating another discounted pack.",
        409
      )
    }

    if (existingPromotion?.status === "active") {
      return NextResponse.json(
        promotionResponse({
          code: existingPromotion.promotion.code,
          expiresAt: existingPromotion.promotion.expires_at ?? expiresAt,
          originalAmountCents: item.priceCents,
          automaticTaxEnabled: stripeAutomaticTaxEnabled,
        }),
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    // Stripe enforces promotion-code uniqueness atomically for each customer.
    // Keeping this code stable for the administrator/customer means concurrent
    // requests race for one active code instead of minting separate discounts.
    const code = buildStripeTestPromotionCode(profile.id)
    const discountAmount = stripeTestDiscountAmount(item.priceCents)
    const metadata = {
      cuadrabot_admin_user_id: profile.id,
      cuadrabot_test_attempt_id: attemptId,
      cuadrabot_test_sku: item.sku,
      cuadrabot_test_subtotal_cents: String(stripeTestCheckoutSubtotalCents),
    }

    const coupon = await stripe.coupons.create(
      {
        amount_off: discountAmount,
        currency: item.currency,
        duration: "once",
        max_redemptions: 1,
        redeem_by: expiresAt,
        applies_to: { products: [productId] },
        // Stripe limits coupon names to 40 characters.
        name: stripeTestCouponName,
        metadata,
      },
      { idempotencyKey: `stripe-owner-test-coupon:${attemptId}` }
    )
    couponId = coupon.id

    const promotionCode = await stripe.promotionCodes.create(
      {
        promotion: { type: "coupon", coupon: coupon.id },
        code,
        customer: customerId,
        max_redemptions: 1,
        expires_at: expiresAt,
        metadata,
      },
      { idempotencyKey: `stripe-owner-test-code:${attemptId}` }
    )
    promotionCodeId = promotionCode.id

    const { error: auditError } = await supabase
      .from("admin_audit_log")
      .insert({
        actor_user_id: profile.id,
        actor_email: profile.email,
        action: "stripe_test_promotion.created",
        target_type: "stripe_promotion_code",
        target_id: promotionCode.id,
        reason:
          "Created a customer-bound, one-redemption promotion for a $2 live Checkout test.",
        after_state: {
          sku: item.sku,
          original_amount_cents: item.priceCents,
          test_subtotal_cents: stripeTestCheckoutSubtotalCents,
          currency: item.currency,
          expires_at: expiresAt,
          max_redemptions: 1,
        },
        metadata: {
          stripe_coupon_id: coupon.id,
          stripe_product_id: productId,
          stripe_customer_id: customerId,
          test_attempt_id: attemptId,
        },
      })

    if (auditError) {
      throw new Error(`Could not audit the Stripe test code: ${auditError.message}`)
    }

    return NextResponse.json(
      promotionResponse({
        code,
        expiresAt,
        originalAmountCents: item.priceCents,
        automaticTaxEnabled: stripeAutomaticTaxEnabled,
      }),
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    )
  } catch (error) {
    console.error("Could not create the owner Stripe test promotion.", error)

    await Promise.allSettled([
      promotionCodeId && stripe
        ? stripe.promotionCodes.update(promotionCodeId, { active: false })
        : Promise.resolve(),
      couponId && stripe ? stripe.coupons.del(couponId) : Promise.resolve(),
    ])

    if (error instanceof StripeTestPromotionError) {
      return jsonError(error.message, error.status)
    }

    if (
      error instanceof StripeConfigurationError ||
      error instanceof BillingCatalogConfigurationError
    ) {
      return jsonError("Stripe billing is not fully configured.", 503)
    }

    if (isMissingStripePrice(error)) {
      return jsonError(
        "The configured Starter Stripe Price is unavailable in the active Stripe account.",
        503
      )
    }

    return jsonError("The Stripe test code could not be created.", 503)
  }
}

async function findExistingTestPromotion(input: {
  adminUserId: string
  customerId: string
  nowSeconds: number
}) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("target_id")
    .eq("actor_user_id", input.adminUserId)
    .eq("action", "stripe_test_promotion.created")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    throw new Error(`Could not inspect prior Stripe test codes: ${error.message}`)
  }

  const stripe = getStripe()
  let activePromotion: Stripe.PromotionCode | null = null

  // Old test-mode audit records can require several failed Stripe lookups after
  // production moves to live mode. Resolve them concurrently so the admin
  // request stays well inside the platform's HTTP timeout.
  const promotions = await Promise.all(
    (data ?? [])
      .map((audit) => audit.target_id)
      .filter((targetId): targetId is string =>
        Boolean(targetId?.startsWith("promo_"))
      )
      .map(async (targetId) => {
        try {
          return await stripe.promotionCodes.retrieve(targetId)
        } catch (error) {
          // Audit records can point to test-mode objects after production moves
          // to live mode. They are unavailable by design and must not block the
          // one live owner test.
          if (isMissingStripeResource(error)) return null
          throw error
        }
      })
  )

  for (const promotion of promotions) {
    if (!promotion) continue
    const promotionCustomerId =
      typeof promotion.customer === "string"
        ? promotion.customer
        : promotion.customer?.id ?? null

    if (
      promotionCustomerId !== input.customerId ||
      promotion.metadata?.cuadrabot_admin_user_id !== input.adminUserId ||
      promotion.metadata?.cuadrabot_test_sku !== stripeTestPromotionSku
    ) {
      throw new Error("A prior Stripe test promotion failed its ownership check.")
    }

    if (promotion.times_redeemed > 0) {
      return { status: "redeemed" as const, promotion }
    }

    if (
      promotion.active &&
      promotion.expires_at &&
      promotion.expires_at > input.nowSeconds
    ) {
      activePromotion = promotion
    }
  }

  return activePromotion
    ? { status: "active" as const, promotion: activePromotion }
    : null
}

function promotionResponse(input: {
  code: string
  expiresAt: number
  originalAmountCents: number
  automaticTaxEnabled: boolean
}) {
  return {
    code: input.code,
    expiresAt: input.expiresAt,
    sku: stripeTestPromotionSku,
    originalAmountCents: input.originalAmountCents,
    checkoutSubtotalCents: stripeTestCheckoutSubtotalCents,
    automaticTaxEnabled: input.automaticTaxEnabled,
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}

function isMissingStripePrice(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "resource_missing" &&
      "param" in error &&
      error.param === "price"
  )
}

function isMissingStripeResource(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "resource_missing"
  )
}
