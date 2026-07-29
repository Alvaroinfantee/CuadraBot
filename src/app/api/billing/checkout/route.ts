import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { getAppFeatures } from "@/lib/app-settings"
import {
  assertStripePriceMatchesCatalog,
  BILLING_CATALOG_VERSION,
  BillingCatalogConfigurationError,
  getConfiguredBillingCatalogItem,
  isBillingSku,
  type ConfiguredBillingCatalogItem,
} from "@/lib/billing-catalog"
import {
  getSiteUrl,
  stripeAutomaticTaxEnabled,
} from "@/lib/config"
import { getActiveUser, type CurrentUser } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getStripe,
  StripeConfigurationError,
} from "@/lib/stripe"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const currentSubscriptionStatuses = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "paused",
] as const

type BillingPlanRow = {
  id: string
  slug: string
  plan_type: string
  currency: string
  price_cents: number
  credits: number
  billing_interval: string
  stripe_price_id: string | null
  active: boolean
}

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  status: string
  stripe_customer_id: string | null
}

class BillingCheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = "BillingCheckoutError"
  }
}

export async function POST(request: Request) {
  let user: CurrentUser | null

  try {
    user = await getActiveUser()
  } catch (error) {
    console.error("Billing authentication is not configured.", error)

    return NextResponse.json(
      {
        error: safeErrorMessage(error),
        code: "deployment_not_configured",
      },
      { status: 503 }
    )
  }

  if (!user) {
    return NextResponse.json(
      { error: "Authentication is required.", code: "authentication_required" },
      { status: 401 }
    )
  }

  const features = await getAppFeatures()
  if (features.configurationError) {
    return NextResponse.json(
      {
        error: "Billing settings are temporarily unavailable.",
        code: "billing_settings_unavailable",
      },
      { status: 503 }
    )
  }
  if (features.maintenance) {
    return NextResponse.json(
      { error: features.maintenanceMessage, code: "maintenance" },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const sku =
    body &&
    typeof body === "object" &&
    "sku" in body &&
    isBillingSku(body.sku)
      ? body.sku
      : null

  if (!sku) {
    return NextResponse.json(
      { error: "Select a valid billing plan.", code: "invalid_billing_sku" },
      { status: 422 }
    )
  }
  if (sku.endsWith("-monthly") && !features.subscriptions) {
    return NextResponse.json(
      {
        error: "New subscriptions are currently unavailable.",
        code: "subscriptions_disabled",
      },
      { status: 403 }
    )
  }

  try {
    const catalogItem = getConfiguredBillingCatalogItem(sku)
    const supabase = createSupabaseAdminClient()
    const stripe = getStripe()
    const [plan, profile] = await Promise.all([
      loadAndValidateBillingPlan(catalogItem),
      loadProfile(user),
      validateStripePrice(stripe, catalogItem),
    ])

    if (catalogItem.kind === "subscription") {
      await assertNoCurrentSubscription(user.id)
    }

    const stripeCustomerId = await getOrCreateStripeCustomer(
      stripe,
      profile,
      user
    )
    const billingOrderId = crypto.randomUUID()
    const { error: orderError } = await supabase.from("billing_orders").insert({
      id: billingOrderId,
      user_id: user.id,
      billing_plan_id: plan.id,
      sku: catalogItem.sku,
      kind: catalogItem.kind,
      credits: catalogItem.credits,
      catalog_version: BILLING_CATALOG_VERSION,
      status: "pending",
      stripe_price_id: catalogItem.priceId,
      amount: catalogItem.priceCents,
      currency: catalogItem.currency,
      metadata: {
        price_env_name: catalogItem.priceEnvName,
      },
    })

    if (orderError) {
      if (orderError.code === "23505" && catalogItem.kind === "subscription") {
        const existingCheckoutUrl = await getOpenSubscriptionCheckoutUrl(
          stripe,
          user.id
        )

        if (existingCheckoutUrl) {
          return NextResponse.json(
            { url: existingCheckoutUrl },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            }
          )
        }

        throw new BillingCheckoutError(
          "A subscription checkout is already in progress.",
          409,
          "subscription_checkout_in_progress"
        )
      }

      throw new Error(`Could not create billing order: ${orderError.message}`)
    }

    const metadata: Stripe.MetadataParam = {
      schema_version: "1",
      billing_order_id: billingOrderId,
      cuadrabot_user_id: user.id,
      billing_sku: catalogItem.sku,
      billing_kind: catalogItem.kind,
      catalog_version: String(BILLING_CATALOG_VERSION),
    }
    const successUrl = `${getSiteUrl()}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${getSiteUrl()}/dashboard/billing?checkout=cancelled`

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: catalogItem.checkoutMode,
          customer: stripeCustomerId,
          client_reference_id: billingOrderId,
          line_items: [{ price: catalogItem.priceId, quantity: 1 }],
          metadata,
          billing_address_collection: "required",
          customer_update: {
            address: "auto",
            name: "auto",
          },
          automatic_tax: {
            enabled: stripeAutomaticTaxEnabled,
          },
          tax_id_collection: {
            enabled: true,
          },
          allow_promotion_codes: true,
          success_url: successUrl,
          cancel_url: cancelUrl,
          ...(catalogItem.kind === "credit_pack"
            ? {
                invoice_creation: {
                  enabled: true,
                  invoice_data: { metadata },
                },
                payment_intent_data: { metadata },
              }
            : {
                subscription_data: { metadata },
              }),
        },
        {
          idempotencyKey: `billing-order:${billingOrderId}`,
        }
      )

      if (!session.url) {
        throw new Error("Stripe did not return a hosted Checkout URL.")
      }

      const { error: updateError } = await supabase
        .from("billing_orders")
        .update({
          status: "checkout_created",
          stripe_checkout_session_id: session.id,
          checkout_created_at: new Date().toISOString(),
        })
        .eq("id", billingOrderId)
        .eq("status", "pending")

      if (updateError) {
        throw new Error(
          `Could not attach Checkout to billing order: ${updateError.message}`
        )
      }

      return NextResponse.json(
        { url: session.url },
        {
          status: 201,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      )
    } catch (error) {
      await supabase
        .from("billing_orders")
        .update({
          status: "failed",
          failure_code: stripeErrorCode(error),
          failure_message: safeErrorMessage(error),
          failed_at: new Date().toISOString(),
        })
        .eq("id", billingOrderId)

      throw error
    }
  } catch (error) {
    console.error("Could not create Stripe Checkout Session.", error)

    if (error instanceof BillingCheckoutError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }

    if (error instanceof BillingCatalogConfigurationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          missing: error.envNames,
        },
        { status: 503 }
      )
    }

    if (error instanceof StripeConfigurationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          missing: [error.envName],
        },
        { status: 503 }
      )
    }

    if (isDeploymentConfigurationError(error)) {
      return NextResponse.json(
        {
          error: safeErrorMessage(error),
          code: "deployment_not_configured",
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: "Billing is temporarily unavailable.",
        code: "billing_unavailable",
      },
      { status: 500 }
    )
  }
}

async function loadAndValidateBillingPlan(
  item: ConfiguredBillingCatalogItem
): Promise<BillingPlanRow> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("billing_plans")
    .select(
      "id,slug,plan_type,currency,price_cents,credits,billing_interval,stripe_price_id,active"
    )
    .eq("slug", item.sku)
    .eq("active", true)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not read billing plan: ${error.message}`)
  }

  const plan = data as BillingPlanRow | null

  if (!plan) {
    throw new BillingCheckoutError(
      "This billing plan is not currently available.",
      409,
      "billing_plan_unavailable"
    )
  }

  const planMatchesCatalog =
    plan.plan_type === item.kind &&
    plan.currency === item.currency &&
    plan.price_cents === item.priceCents &&
    plan.credits === item.credits &&
    plan.billing_interval === item.billingInterval &&
    plan.stripe_price_id === item.priceId

  if (!planMatchesCatalog) {
    throw new BillingCatalogConfigurationError(
      `Billing plan ${item.sku} does not match the server catalog.`
    )
  }

  return plan
}

async function validateStripePrice(
  stripe: Stripe,
  item: ConfiguredBillingCatalogItem
) {
  const price = await stripe.prices.retrieve(item.priceId)
  assertStripePriceMatchesCatalog(price, item)
}

async function loadProfile(user: CurrentUser): Promise<ProfileRow> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,status,stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not read customer profile: ${error.message}`)
  }

  const profile = data as ProfileRow | null

  if (!profile) {
    throw new BillingCheckoutError(
      "Complete account setup before opening Checkout.",
      409,
      "profile_required"
    )
  }

  if (profile.status !== "active") {
    throw new BillingCheckoutError(
      "This account cannot start a new purchase.",
      403,
      "account_not_active"
    )
  }

  return profile
}

async function assertNoCurrentSubscription(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id,status")
    .eq("user_id", userId)
    .in("status", [...currentSubscriptionStatuses])
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not check subscription status: ${error.message}`)
  }

  if (data) {
    throw new BillingCheckoutError(
      "Manage the current subscription before selecting another plan.",
      409,
      "current_subscription_exists"
    )
  }
}

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  profile: ProfileRow,
  user: CurrentUser
) {
  if (profile.stripe_customer_id) {
    return profile.stripe_customer_id
  }

  const customer = await stripe.customers.create(
    {
      email: user.email ?? profile.email ?? undefined,
      name: profile.full_name ?? undefined,
      metadata: {
        cuadrabot_user_id: user.id,
      },
    },
    {
      idempotencyKey: `cuadrabot-customer:${user.id}:v1`,
    }
  )
  const supabase = createSupabaseAdminClient()
  const { data: claimedProfile, error: claimError } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", user.id)
    .is("stripe_customer_id", null)
    .select("stripe_customer_id")
    .maybeSingle()

  if (claimError) {
    throw new Error(
      `Could not save the Stripe Customer: ${claimError.message}`
    )
  }

  if (claimedProfile?.stripe_customer_id) {
    return claimedProfile.stripe_customer_id as string
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle()

  if (currentProfileError || !currentProfile?.stripe_customer_id) {
    throw new Error(
      currentProfileError?.message ??
        "Could not resolve the customer's Stripe account."
    )
  }

  return currentProfile.stripe_customer_id as string
}

async function getOpenSubscriptionCheckoutUrl(
  stripe: Stripe,
  userId: string
) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("billing_orders")
    .select("id,stripe_checkout_session_id")
    .eq("user_id", userId)
    .eq("kind", "subscription")
    .in("status", ["pending", "checkout_created"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Could not read the current subscription checkout: ${error.message}`
    )
  }

  if (!data?.stripe_checkout_session_id) return null

  const session = await stripe.checkout.sessions.retrieve(
    data.stripe_checkout_session_id
  )

  if (session.status === "open" && session.url) {
    return session.url
  }

  if (session.status === "expired") {
    const { error: updateError } = await supabase
      .from("billing_orders")
      .update({
        status: "expired",
        canceled_at: new Date().toISOString(),
        failure_code: "checkout_session_expired",
        failure_message: "The Stripe Checkout Session expired before payment.",
      })
      .eq("id", data.id)

    if (updateError) {
      throw new Error(
        `Could not close the expired subscription checkout: ${updateError.message}`
      )
    }
  }

  return null
}

function stripeErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.slice(0, 120)
  }

  return "checkout_session_creation_failed"
}

function safeErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Unknown billing error").slice(
    0,
    1_000
  )
}

function isDeploymentConfigurationError(error: unknown) {
  if (!(error instanceof Error)) return false

  return (
    error.message.startsWith("Missing required environment variable:") ||
    error.message.startsWith("Missing Supabase ")
  )
}
