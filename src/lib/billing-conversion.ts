import "server-only"

import { BILLING_CATALOG_VERSION } from "@/lib/billing-catalog"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"

type BillingOrderForConversion = {
  id: string
  user_id: string
  sku: string
  kind: "credit_pack" | "subscription"
  catalog_version: number
  currency: string
  stripe_checkout_session_id: string | null
}

export type VerifiedBillingConversion = {
  currency: string
  transactionId: string
  valueCents: number
}

const checkoutSessionIdPattern = /^cs_(?:live|test)_[A-Za-z0-9]+$/

export async function verifyBillingConversion(
  userId: string,
  checkoutSessionId: string
): Promise<VerifiedBillingConversion | null> {
  if (!checkoutSessionIdPattern.test(checkoutSessionId)) return null

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("billing_orders")
    .select(
      "id,user_id,sku,kind,catalog_version,currency,stripe_checkout_session_id"
    )
    .eq("user_id", userId)
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not verify the billing order: ${error.message}`)
  }

  const order = data as BillingOrderForConversion | null
  if (!order) return null

  const session = await getStripe().checkout.sessions.retrieve(
    checkoutSessionId
  )
  const amountTotal = session.amount_total
  const currency = session.currency?.toLowerCase() ?? null
  const expectedMode = order.kind === "subscription" ? "subscription" : "payment"

  const verified =
    session.id === order.stripe_checkout_session_id &&
    session.status === "complete" &&
    session.payment_status === "paid" &&
    session.mode === expectedMode &&
    session.client_reference_id === order.id &&
    session.metadata?.billing_order_id === order.id &&
    session.metadata?.cuadrabot_user_id === userId &&
    session.metadata?.billing_sku === order.sku &&
    session.metadata?.billing_kind === order.kind &&
    session.metadata?.catalog_version === String(BILLING_CATALOG_VERSION) &&
    order.catalog_version === BILLING_CATALOG_VERSION &&
    currency === order.currency &&
    Number.isSafeInteger(amountTotal) &&
    typeof amountTotal === "number" &&
    amountTotal > 0

  if (!verified || !currency || amountTotal === null) return null

  return {
    currency,
    transactionId: session.id,
    valueCents: amountTotal,
  }
}
