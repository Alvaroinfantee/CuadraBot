import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"

const checkoutSessionIdPattern = /^cs_(?:live|test)_[A-Za-z0-9]+$/

export type VerifiedDrywallConversion = {
  currency: string
  transactionId: string
  valueCents: number
  orderId: string
  orderNumber: string
}

export async function verifyDrywallConversion(
  projectId: string,
  checkoutSessionId: string
): Promise<VerifiedDrywallConversion | null> {
  if (!checkoutSessionIdPattern.test(checkoutSessionId)) return null

  const supabase = createSupabaseAdminClient()
  const { data: order, error } = await supabase
    .from("drywall_takeoff_orders")
    .select("id,project_id,order_number,stripe_checkout_session_id")
    .eq("project_id", projectId)
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle()
  if (error) throw new Error(`Could not verify the drywall order: ${error.message}`)
  if (!order) return null

  const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId)
  const amountTotal = session.amount_total
  const currency = session.currency?.toLowerCase() ?? null
  const verified =
    session.id === order.stripe_checkout_session_id &&
    session.status === "complete" &&
    session.payment_status === "paid" &&
    session.mode === "payment" &&
    session.client_reference_id === order.id &&
    session.metadata?.flow === "drywall_takeoff" &&
    session.metadata?.drywall_project_id === projectId &&
    session.metadata?.drywall_order_id === order.id &&
    session.amount_subtotal === 14900 &&
    currency === "eur" &&
    Number.isSafeInteger(amountTotal) &&
    typeof amountTotal === "number" &&
    amountTotal >= 14900

  if (!verified || !currency || amountTotal === null) return null
  return {
    currency,
    transactionId: session.id,
    valueCents: amountTotal,
    orderId: order.id,
    orderNumber: order.order_number,
  }
}
