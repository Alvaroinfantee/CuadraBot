import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"
import { getRequiredEnv } from "@/lib/config"
import { sendAndRecordOrderConfirmation } from "@/lib/orders"
import type { Order, PackagePlan } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 })
  }

  const body = await request.text()
  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      getRequiredEnv("STRIPE_WEBHOOK_SECRET")
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook." },
      { status: 400 }
    )
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event)
  }

  if (event.type === "payment_intent.payment_failed") {
    await handlePaymentFailed(event)
  }

  if (event.type === "charge.refunded") {
    await handleChargeRefunded(event)
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session

  if (session.payment_status !== "paid") {
    return
  }

  const supabase = createSupabaseAdminClient()
  const orderId = session.metadata?.order_id

  const query = supabase
    .from("orders")
    .select("*, packages(*)")
    .limit(1)

  const { data: orders, error } = orderId
    ? await query.eq("id", orderId)
    : await query.eq("stripe_checkout_session_id", session.id)

  if (error) {
    throw new Error(error.message)
  }

  const order = orders?.[0] as (Order & { packages: PackagePlan | null }) | undefined
  if (!order) return

  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from("payments")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle()

  if (existingPaymentError) {
    throw new Error(existingPaymentError.message)
  }

  if (!existingPayment) {
    await supabase.from("payments").insert({
      order_id: order.id,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      status: "paid",
      amount_cents: session.amount_total,
      currency: session.currency,
      raw_event: event as unknown as Record<string, unknown>,
    })
  }

  const nextStatus = ["draft", "awaiting_payment"].includes(order.status)
    ? "paid_pending_processing"
    : order.status

  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({
      status: nextStatus,
      paid_at: order.paid_at ?? new Date().toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      amount_cents: session.amount_total,
      currency: session.currency,
    })
    .eq("id", order.id)
    .select("*")
    .single()

  if (updateError) {
    throw new Error(updateError.message)
  }

  const packagePlan = Array.isArray(order.packages)
    ? order.packages[0]
    : order.packages

  if (!order.paid_at && packagePlan) {
    await sendAndRecordOrderConfirmation({
      order: updatedOrder as Order,
      packagePlan: packagePlan as PackagePlan,
    })
  }
}

async function handlePaymentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const supabase = createSupabaseAdminClient()

  await supabase
    .from("payments")
    .update({ status: "failed", raw_event: event as unknown as Record<string, unknown> })
    .eq("stripe_payment_intent_id", paymentIntent.id)

  await supabase
    .from("orders")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .in("status", ["awaiting_payment"])
}

async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null

  if (!paymentIntentId) return

  const supabase = createSupabaseAdminClient()
  await supabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntentId)
}
