import { NextResponse } from "next/server"
import type Stripe from "stripe"
import {
  BILLING_CATALOG_VERSION,
  findBillingCatalogItemByPriceId,
  type ConfiguredBillingCatalogItem,
} from "@/lib/billing-catalog"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getStripe,
  getStripeWebhookSecret,
  StripeConfigurationError,
} from "@/lib/stripe"
import {
  readRequestBytesWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>

type BillingOrderRow = {
  id: string
  user_id: string
  billing_plan_id: string | null
  sku: string
  kind: "credit_pack" | "subscription"
  status: string
  catalog_version: number
  credits: number
  amount: number
  currency: string
  stripe_price_id: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_subscription_id: string | null
  stripe_invoice_id: string | null
  metadata: Record<string, unknown> | null
}

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

type StripeEventRow = {
  id: string
  status: "received" | "processing" | "processed" | "failed" | "ignored"
  attempt_count: number
}

type AdminAlertInput = {
  dedupeKey: string
  severity: "info" | "warning" | "critical"
  title: string
  message: string
  entityType: string
  entityId: string
  userId?: string | null
  billingOrderId?: string | null
  metadata?: Record<string, unknown>
}

type BillingContext = {
  billingOrder: BillingOrderRow | null
  userId: string | null
}

type StripeCreditFulfillmentOutcome = {
  status:
    | "fulfilled"
    | "refund_suppressed"
    | "inactive_workspace"
    | "blocked"
  granted: boolean
  requires_follow_up: boolean
  idempotent?: boolean
}

type RefundCreditSource = {
  userId: string
  billingOrder: BillingOrderRow | null
  sourceType: "stripe_checkout_session" | "stripe_invoice"
  sourceId: string
  expectedAmount: number
  currency: string
}

type StripeCreditRefundOutcome = {
  eligible: boolean
  reversed: boolean
  refundBeforeGrant: boolean
  requiresFollowUp: boolean
  error: string | null
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    )
  }

  const rawBodyResult = await readRequestBytesWithLimit(
    request,
    requestBodyLimits.stripeWebhook
  )
  if (!rawBodyResult.ok) {
    return NextResponse.json(
      {
        error:
          rawBodyResult.reason === "too_large"
            ? "Stripe webhook payload is too large."
            : "Invalid Stripe webhook payload.",
      },
      { status: rawBodyResult.reason === "too_large" ? 413 : 400 }
    )
  }
  const rawBody = rawBodyResult.value
  let stripe: Stripe
  let event: Stripe.Event

  try {
    stripe = getStripe()
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret()
    )
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      console.error("Stripe webhook is not configured.", error)

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          missing: [error.envName],
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: "Invalid Stripe webhook signature." },
      { status: 400 }
    )
  }

  let supabase: SupabaseAdmin

  try {
    supabase = createSupabaseAdminClient()
  } catch (error) {
    console.error("Stripe webhook storage is not configured.", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook storage is not configured.",
        code: "deployment_not_configured",
      },
      { status: 503 }
    )
  }

  try {
    const shouldProcess = await claimStripeEvent(supabase, event)

    if (!shouldProcess) {
      return NextResponse.json({ received: true, duplicate: true })
    }

    const handled = await processStripeEvent(supabase, stripe, event)
    await finishStripeEvent(supabase, event.id, handled ? "processed" : "ignored")

    return NextResponse.json({ received: true, handled })
  } catch (error) {
    const message = safeErrorMessage(error)

    console.error("Stripe webhook processing failed.", {
      eventId: event.id,
      eventType: event.type,
      error: message,
    })

    await Promise.allSettled([
      failStripeEvent(supabase, event.id, message),
      createOrTouchAdminAlert(supabase, {
        dedupeKey: `billing:stripe-event:${event.id}`,
        severity: "critical",
        title: "Stripe webhook processing failed",
        message:
          "A verified Stripe event could not be applied. Review the failed event before retrying or changing billing state.",
        entityType: "stripe_event",
        entityId: event.id,
        metadata: {
          stripe_event_type: event.type,
          processing_error: message,
        },
      }),
    ])

    return NextResponse.json(
      { error: "Stripe webhook processing failed." },
      { status: 500 }
    )
  }
}

async function processStripeEvent(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event
) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return handleCheckoutSession(
        supabase,
        stripe,
        event.data.object,
        event.id
      )

    case "checkout.session.async_payment_failed":
      return handleCheckoutFailure(
        supabase,
        stripe,
        event.data.object,
        event.id,
        "failed"
      )

    case "checkout.session.expired":
      return handleCheckoutFailure(
        supabase,
        stripe,
        event.data.object,
        event.id,
        "expired"
      )

    case "invoice.paid":
      await handleInvoicePaid(supabase, stripe, event.data.object, event.id)
      return true

    case "invoice.payment_failed":
    case "invoice.payment_action_required":
      await handleInvoiceProblem(
        supabase,
        stripe,
        event.data.object,
        event.id,
        event.type,
        "warning"
      )
      return true

    case "invoice.finalization_failed":
      await handleInvoiceProblem(
        supabase,
        stripe,
        event.data.object,
        event.id,
        event.type,
        "critical"
      )
      return true

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncLatestSubscription(
        supabase,
        stripe,
        event.data.object.id,
        event.id
      )
      return true

    case "payment_intent.payment_failed":
      await handlePaymentIntentFailure(
        supabase,
        stripe,
        event.data.object,
        event.id
      )
      return true

    case "refund.created":
    case "refund.updated":
    case "refund.failed":
      await handleLatestRefund(
        supabase,
        stripe,
        event.data.object.id,
        event.id
      )
      return true

    case "charge.refunded":
      await handleChargeRefunded(
        supabase,
        stripe,
        event.data.object,
        event.id
      )
      return true

    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
    case "charge.dispute.funds_withdrawn":
    case "charge.dispute.funds_reinstated":
      await handleLatestDispute(
        supabase,
        stripe,
        event.data.object.id,
        event.id
      )
      return true

    case "customer.updated":
      await handleLatestCustomerUpdated(
        supabase,
        stripe,
        event.data.object.id
      )
      return true

    default:
      return false
  }
}

async function handleCheckoutSession(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  eventId: string
) {
  const billingOrderId = session.metadata?.billing_order_id

  if (!billingOrderId) return false

  const billingOrder = await getBillingOrderById(supabase, billingOrderId)

  if (!billingOrder) {
    throw new Error(
      `Checkout Session ${session.id} references a missing billing order.`
    )
  }

  if (
    billingOrder.stripe_checkout_session_id &&
    billingOrder.stripe_checkout_session_id !== session.id
  ) {
    throw new Error(
      `Checkout Session ${session.id} does not match its billing order.`
    )
  }

  if (
    session.client_reference_id &&
    session.client_reference_id !== billingOrder.id
  ) {
    throw new Error(
      `Checkout Session ${session.id} has an invalid client reference.`
    )
  }

  const { catalogItem } = await validateCheckoutSession(
    supabase,
    stripe,
    session,
    billingOrder
  )

  await updateBillingLocation(
    supabase,
    billingOrder.user_id,
    session.customer_details?.address ?? null
  )

  if (catalogItem.kind === "subscription") {
    const subscriptionId = getStripeId(session.subscription)

    if (!subscriptionId) {
      throw new Error(
        `Subscription Checkout Session ${session.id} has no subscription.`
      )
    }

    await updateBillingOrder(supabase, billingOrder.id, {
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: subscriptionId,
      metadata: mergeMetadata(billingOrder.metadata, {
        last_stripe_event_id: eventId,
        checkout_payment_status: session.payment_status,
      }),
    })

    return true
  }

  if (session.payment_status !== "paid") {
    return true
  }

  const stripeCustomerId = getStripeId(session.customer)
  await assertBillingCustomer(
    supabase,
    billingOrder.user_id,
    stripeCustomerId
  )

  const fulfillment = await fulfillStripeCredits(supabase, {
    userId: billingOrder.user_id,
    amount: catalogItem.credits,
    entryType: "purchase_grant",
    sourceType: "stripe_checkout_session",
    sourceId: session.id,
    idempotencyKey: `stripe:checkout:${session.id}`,
    billingOrderId: billingOrder.id,
    stripePriceId: catalogItem.priceId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: getStripeId(session.payment_intent),
    stripeSubscriptionId: null,
    stripeInvoiceId: getStripeId(session.invoice),
    paidAt: new Date().toISOString(),
    metadata: {
      billing_order_id: billingOrder.id,
      billing_sku: catalogItem.sku,
      stripe_event_id: eventId,
      stripe_price_id: catalogItem.priceId,
      checkout_payment_status: session.payment_status,
      checkout_amount_total: session.amount_total,
      checkout_currency: session.currency,
    },
  })

  if (!fulfillment.granted) {
    await createOrTouchAdminAlert(supabase, {
      dedupeKey: `billing:checkout-fulfillment:${session.id}`,
      severity: fulfillment.requires_follow_up ? "critical" : "info",
      title:
        fulfillment.status === "refund_suppressed"
          ? "Refunded checkout grant suppressed"
          : "Paid checkout requires billing follow-up",
      message:
        fulfillment.status === "refund_suppressed"
          ? "No credits were granted because a full refund was already recorded for this checkout."
          : "No credits were granted. Review the paid checkout and customer workspace state.",
      entityType: "checkout_session",
      entityId: session.id,
      userId: billingOrder.user_id,
      billingOrderId: billingOrder.id,
      metadata: {
        stripe_event_id: eventId,
        fulfillment_status: fulfillment.status,
        amount_paid: session.amount_total,
        currency: session.currency,
        credits_automatically_changed: false,
      },
    })
  }

  return true
}

async function validateCheckoutSession(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  billingOrder: BillingOrderRow
) {
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
  })

  if (lineItems.has_more || lineItems.data.length !== 1) {
    throw new Error(
      `Checkout Session ${session.id} must contain exactly one line item.`
    )
  }

  const lineItem = lineItems.data[0]
  const priceId = getStripeId(lineItem.price)
  const catalogItem = priceId
    ? findBillingCatalogItemByPriceId(priceId)
    : null

  if (!catalogItem) {
    throw new Error(
      `Checkout Session ${session.id} uses an unknown Stripe Price.`
    )
  }

  if (lineItem.quantity !== 1) {
    throw new Error(
      `Checkout Session ${session.id} has an invalid line-item quantity.`
    )
  }

  validateBillingOrderAgainstCatalog(billingOrder, catalogItem)
  await loadAndValidateBillingPlan(supabase, catalogItem)

  const expectedMode =
    catalogItem.kind === "subscription" ? "subscription" : "payment"

  if (session.mode !== expectedMode) {
    throw new Error(
      `Checkout Session ${session.id} has an invalid billing mode.`
    )
  }

  if (
    session.metadata?.cuadrabot_user_id !== billingOrder.user_id ||
    session.metadata?.billing_sku !== catalogItem.sku ||
    session.metadata?.billing_kind !== catalogItem.kind ||
    session.metadata?.catalog_version !== String(BILLING_CATALOG_VERSION)
  ) {
    throw new Error(
      `Checkout Session ${session.id} has invalid billing metadata.`
    )
  }

  return { catalogItem }
}

async function handleCheckoutFailure(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  eventSession: Stripe.Checkout.Session,
  eventId: string,
  status: "failed" | "expired"
) {
  const session = await stripe.checkout.sessions.retrieve(eventSession.id)

  if (session.payment_status === "paid") {
    return handleCheckoutSession(supabase, stripe, session, eventId)
  }

  const billingOrderId = session.metadata?.billing_order_id

  if (!billingOrderId) return false

  const billingOrder = await getBillingOrderById(supabase, billingOrderId)

  if (!billingOrder) {
    throw new Error(
      `Checkout Session ${session.id} references a missing billing order.`
    )
  }

  const timestamp = new Date().toISOString()

  await updateBillingOrder(supabase, billingOrder.id, {
    status,
    failure_code:
      status === "expired" ? "checkout_session_expired" : "async_payment_failed",
    failure_message:
      status === "expired"
        ? "The Stripe Checkout Session expired before payment."
        : "Stripe reported that the asynchronous payment failed.",
    ...(status === "failed"
      ? { failed_at: timestamp }
      : { canceled_at: timestamp }),
    metadata: mergeMetadata(billingOrder.metadata, {
      last_stripe_event_id: eventId,
    }),
  })

  if (status === "failed") {
    await createOrTouchAdminAlert(supabase, {
      dedupeKey: `billing:checkout-failed:${session.id}`,
      severity: "warning",
      title: "Checkout payment failed",
      message:
        "Stripe reported a failed asynchronous Checkout payment. No credits were granted.",
      entityType: "checkout_session",
      entityId: session.id,
      userId: billingOrder.user_id,
      billingOrderId: billingOrder.id,
      metadata: {
        stripe_event_id: eventId,
      },
    })
  }

  return true
}

async function handleInvoicePaid(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventId: string
) {
  if (invoice.status !== "paid") {
    throw new Error(`Invoice ${invoice.id} is not marked paid.`)
  }

  if (
    invoice.billing_reason !== "subscription_create" &&
    invoice.billing_reason !== "subscription_cycle"
  ) {
    return
  }

  if (
    invoice.parent?.type !== "subscription_details" ||
    !invoice.parent.subscription_details
  ) {
    throw new Error(
      `Paid subscription Invoice ${invoice.id} has no subscription parent.`
    )
  }

  const subscriptionId = getStripeId(
    invoice.parent.subscription_details.subscription
  )

  if (!subscriptionId) {
    throw new Error(`Invoice ${invoice.id} has no subscription ID.`)
  }

  const lines = await getAllInvoiceLines(stripe, invoice)
  const subscriptionLines = lines.filter(
    (line) =>
      line.parent?.type === "subscription_item_details" &&
      line.parent.subscription_item_details?.proration === false &&
      line.parent.subscription_item_details.subscription === subscriptionId
  )

  if (subscriptionLines.length !== 1) {
    throw new Error(
      `Invoice ${invoice.id} must contain exactly one non-proration subscription line.`
    )
  }

  const invoiceLine = subscriptionLines[0]
  const priceId = getStripeId(invoiceLine.pricing?.price_details?.price)
  const catalogItem = priceId
    ? findBillingCatalogItemByPriceId(priceId)
    : null

  if (!catalogItem || catalogItem.kind !== "subscription") {
    throw new Error(`Invoice ${invoice.id} uses an unknown subscription Price.`)
  }

  if (invoiceLine.quantity !== 1) {
    throw new Error(`Invoice ${invoice.id} has an invalid subscription quantity.`)
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const syncedSubscription = await syncSubscription(
    supabase,
    subscription,
    eventId
  )

  if (
    syncedSubscription.catalogItem.sku !== catalogItem.sku ||
    syncedSubscription.userId === null
  ) {
    throw new Error(`Invoice ${invoice.id} does not match its subscription.`)
  }

  const invoiceCustomerId = getStripeId(invoice.customer)

  await assertBillingCustomer(
    supabase,
    syncedSubscription.userId,
    invoiceCustomerId
  )

  let billingOrder: BillingOrderRow | null = null
  if (invoice.billing_reason === "subscription_create") {
    const billingOrderId =
      invoice.parent.subscription_details.metadata?.billing_order_id ??
      subscription.metadata.billing_order_id

    if (!billingOrderId) {
      throw new Error(
        `Initial subscription Invoice ${invoice.id} has no billing order.`
      )
    }

    billingOrder = await getBillingOrderById(supabase, billingOrderId)

    if (!billingOrder) {
      throw new Error(
        `Initial subscription Invoice ${invoice.id} references a missing billing order.`
      )
    }

    validateBillingOrderAgainstCatalog(billingOrder, catalogItem)

    if (billingOrder.user_id !== syncedSubscription.userId) {
      throw new Error(
        `Initial subscription Invoice ${invoice.id} has the wrong owner.`
      )
    }

  }

  const fulfillment = await fulfillStripeCredits(supabase, {
    userId: syncedSubscription.userId,
    amount: catalogItem.credits,
    entryType: "subscription_grant",
    sourceType: "stripe_invoice",
    sourceId: invoice.id,
    idempotencyKey: `stripe:invoice:${invoice.id}`,
    billingOrderId: billingOrder?.id ?? null,
    stripePriceId: catalogItem.priceId,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId: invoice.id,
    paidAt: invoice.status_transitions.paid_at
      ? toIsoTime(invoice.status_transitions.paid_at)
      : new Date().toISOString(),
    metadata: {
      billing_order_id: billingOrder?.id ?? null,
      billing_sku: catalogItem.sku,
      billing_reason: invoice.billing_reason,
      stripe_event_id: eventId,
      stripe_price_id: catalogItem.priceId,
      stripe_subscription_id: subscriptionId,
      invoice_amount_paid: invoice.amount_paid,
      invoice_currency: invoice.currency,
    },
  })

  if (!fulfillment.granted) {
    if (
      ["inactive_workspace", "blocked"].includes(fulfillment.status) &&
      !subscription.cancel_at_period_end
    ) {
      const cancelingSubscription = await stripe.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: true }
      )
      await syncSubscription(supabase, cancelingSubscription, eventId)
    }

    await createOrTouchAdminAlert(supabase, {
      dedupeKey: `billing:invoice-fulfillment:${invoice.id}`,
      severity: fulfillment.requires_follow_up ? "critical" : "info",
      title:
        fulfillment.status === "refund_suppressed"
          ? "Refunded invoice grant suppressed"
          : "Paid invoice requires billing follow-up",
      message:
        fulfillment.status === "refund_suppressed"
          ? "No credits were granted because a full refund was already recorded for this invoice."
          : "No credits were granted. Renewal was stopped when appropriate; review the payment and workspace state.",
      entityType: "stripe_invoice",
      entityId: invoice.id,
      userId: syncedSubscription.userId,
      billingOrderId: billingOrder?.id,
      metadata: {
        stripe_event_id: eventId,
        stripe_subscription_id: subscriptionId,
        fulfillment_status: fulfillment.status,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        credits_automatically_changed: false,
      },
    })
  }
}

async function syncSubscription(
  supabase: SupabaseAdmin,
  subscription: Stripe.Subscription,
  eventId: string
) {
  if (subscription.items.has_more || subscription.items.data.length !== 1) {
    throw new Error(
      `Subscription ${subscription.id} must contain exactly one item.`
    )
  }

  const subscriptionItem = subscription.items.data[0]
  const catalogItem = findBillingCatalogItemByPriceId(
    subscriptionItem.price.id
  )

  if (!catalogItem || catalogItem.kind !== "subscription") {
    throw new Error(
      `Subscription ${subscription.id} uses an unknown recurring Price.`
    )
  }

  if (subscriptionItem.quantity !== 1) {
    throw new Error(
      `Subscription ${subscription.id} has an invalid item quantity.`
    )
  }

  if (
    subscription.metadata.billing_sku &&
    subscription.metadata.billing_sku !== catalogItem.sku
  ) {
    throw new Error(
      `Subscription ${subscription.id} has inconsistent billing metadata.`
    )
  }

  const customerId = getStripeId(subscription.customer)
  const userId = await resolveUserId(
    supabase,
    subscription.metadata,
    customerId
  )

  if (!userId) {
    throw new Error(
      `Subscription ${subscription.id} is not linked to a Cuadrabot user.`
    )
  }

  const plan = await loadAndValidateBillingPlan(supabase, catalogItem)
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      billing_plan_id: plan.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: catalogItem.priceId,
      status: subscription.status,
      current_period_start: toIsoTime(subscriptionItem.current_period_start),
      current_period_end: toIsoTime(subscriptionItem.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: nullableIsoTime(subscription.canceled_at),
      trial_end: nullableIsoTime(subscription.trial_end),
      metadata: {
        billing_sku: catalogItem.sku,
        catalog_version: BILLING_CATALOG_VERSION,
        last_stripe_event_id: eventId,
        stripe_metadata: subscription.metadata,
      },
    },
    {
      onConflict: "stripe_subscription_id",
    }
  )

  if (error) {
    throw new Error(`Could not sync subscription: ${error.message}`)
  }

  const billingOrderId = subscription.metadata.billing_order_id

  if (billingOrderId) {
    const billingOrder = await getBillingOrderById(supabase, billingOrderId)

    if (!billingOrder) {
      throw new Error(
        `Subscription ${subscription.id} references a missing billing order.`
      )
    }

    validateBillingOrderAgainstCatalog(billingOrder, catalogItem)

    if (billingOrder.user_id !== userId) {
      throw new Error(
        `Subscription ${subscription.id} has the wrong billing-order owner.`
      )
    }

    const billingOrderUpdate: Record<string, unknown> = {
      stripe_subscription_id: subscription.id,
      metadata: mergeMetadata(billingOrder.metadata, {
        last_stripe_event_id: eventId,
        subscription_status: subscription.status,
      }),
    }

    if (
      ["pending", "checkout_created", "paid"].includes(billingOrder.status) &&
      subscription.status === "incomplete_expired"
    ) {
      Object.assign(billingOrderUpdate, {
        status: "expired",
        canceled_at: new Date().toISOString(),
        failure_code: "subscription_incomplete_expired",
        failure_message:
          "The Stripe subscription expired before its first payment completed.",
      })
    }

    if (
      ["pending", "checkout_created", "paid"].includes(billingOrder.status) &&
      subscription.status === "canceled"
    ) {
      Object.assign(billingOrderUpdate, {
        status: "canceled",
        canceled_at:
          nullableIsoTime(subscription.canceled_at) ??
          new Date().toISOString(),
        failure_code: "subscription_canceled_before_fulfillment",
        failure_message:
          "The Stripe subscription was canceled before credits were granted.",
      })
    }

    await updateBillingOrder(
      supabase,
      billingOrder.id,
      billingOrderUpdate
    )
  }

  return { userId, catalogItem, plan }
}

async function syncLatestSubscription(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  subscriptionId: string,
  eventId: string
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  return syncSubscription(supabase, subscription, eventId)
}

async function handleInvoiceProblem(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  eventInvoice: Stripe.Invoice,
  eventId: string,
  eventType: string,
  severity: "warning" | "critical"
) {
  const invoice = await stripe.invoices.retrieve(eventInvoice.id)

  if (invoice.status === "paid") return

  const metadata =
    invoice.parent?.type === "subscription_details"
      ? invoice.parent.subscription_details?.metadata
      : null
  const customerId = getStripeId(invoice.customer)
  const userId = await resolveUserId(supabase, metadata, customerId)
  const billingOrderId = metadata?.billing_order_id ?? null
  const subscriptionId =
    invoice.parent?.type === "subscription_details"
      ? getStripeId(invoice.parent.subscription_details?.subscription)
      : null

  if (billingOrderId && invoice.billing_reason === "subscription_create") {
    const billingOrder = await getBillingOrderById(supabase, billingOrderId)

    if (billingOrder) {
      await updateBillingOrder(supabase, billingOrder.id, {
        status: "failed",
        failure_code: eventType.replaceAll(".", "_"),
        failure_message: "Stripe could not complete the subscription invoice.",
        failed_at: new Date().toISOString(),
        metadata: mergeMetadata(billingOrder.metadata, {
          last_stripe_event_id: eventId,
          stripe_invoice_id: invoice.id,
        }),
      })
    }
  }

  await createOrTouchAdminAlert(supabase, {
    dedupeKey: `billing:invoice-problem:${invoice.id}`,
    severity,
    title:
      severity === "critical"
        ? "Subscription invoice could not be finalized"
        : "Subscription payment needs attention",
    message:
      "Stripe reported a subscription invoice problem. No credits were granted for this invoice.",
    entityType: "stripe_invoice",
    entityId: invoice.id,
    userId,
    billingOrderId,
    metadata: {
      stripe_event_id: eventId,
      stripe_event_type: eventType,
      billing_reason: invoice.billing_reason,
      stripe_subscription_id: subscriptionId,
    },
  })
}

async function handlePaymentIntentFailure(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  eventPaymentIntent: Stripe.PaymentIntent,
  eventId: string
) {
  const paymentIntent = await stripe.paymentIntents.retrieve(
    eventPaymentIntent.id
  )

  if (paymentIntent.status === "succeeded") return

  const context = await getBillingContextForPaymentIntent(
    supabase,
    stripe,
    paymentIntent.id,
    paymentIntent
  )

  if (context.billingOrder) {
    await updateBillingOrder(supabase, context.billingOrder.id, {
      status: "failed",
      stripe_payment_intent_id: paymentIntent.id,
      failure_code:
        paymentIntent.last_payment_error?.code ?? "payment_intent_failed",
      failure_message:
        paymentIntent.last_payment_error?.message ??
        "Stripe could not complete this payment.",
      failed_at: new Date().toISOString(),
      metadata: mergeMetadata(context.billingOrder.metadata, {
        last_stripe_event_id: eventId,
      }),
    })
  }

  await createOrTouchAdminAlert(supabase, {
    dedupeKey: `billing:payment-failed:${paymentIntent.id}`,
    severity: "warning",
    title: "Customer payment failed",
    message:
      "Stripe could not complete a customer payment. No credits were granted.",
    entityType: "payment_intent",
    entityId: paymentIntent.id,
    userId: context.userId,
    billingOrderId: context.billingOrder?.id,
    metadata: {
      stripe_event_id: eventId,
      failure_code: paymentIntent.last_payment_error?.code ?? null,
    },
  })
}

async function handleRefund(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  refund: Stripe.Refund,
  eventId: string
) {
  const paymentIntentId = getStripeId(refund.payment_intent)
  const paymentIntent = paymentIntentId
    ? refund.payment_intent &&
      typeof refund.payment_intent === "object"
      ? refund.payment_intent
      : await stripe.paymentIntents.retrieve(paymentIntentId)
    : null
  const context =
    paymentIntentId && paymentIntent
      ? await getBillingContextForPaymentIntent(
          supabase,
          stripe,
          paymentIntentId,
          paymentIntent
        )
      : { billingOrder: null, userId: null }
  const source = paymentIntent
    ? await resolveRefundCreditSource(
        supabase,
        stripe,
        paymentIntent,
        context
      )
    : null
  const succeededRefundTotal =
    refund.status === "succeeded" && paymentIntent
      ? await getSucceededRefundTotal(stripe, paymentIntent.id, refund)
      : 0
  const fullRefund =
    Boolean(source) &&
    refund.status === "succeeded" &&
    paymentIntent?.status === "succeeded" &&
    source?.expectedAmount === succeededRefundTotal &&
    source.currency === refund.currency

  const creditOutcome: StripeCreditRefundOutcome =
    fullRefund && source
      ? await recordFullStripeRefund(
          supabase,
          source,
          refund,
          eventId,
          succeededRefundTotal
        )
      : {
          eligible: false,
          reversed: false,
          refundBeforeGrant: false,
          requiresFollowUp: refund.status === "succeeded",
          error:
            refund.status !== "succeeded"
              ? `Refund status is ${refund.status ?? "unknown"}.`
              : !source
                ? "No Cuadrabot Stripe credit source matched this refund."
                : source.currency !== refund.currency
                  ? "Refund currency does not match the paid credit source."
                  : "The payment is not fully refunded; use an audited proportional credit adjustment.",
        }

  if (source?.billingOrder && !creditOutcome.eligible) {
    await recordBillingRisk(
      supabase,
      source.billingOrder,
      "stripe_refund_review",
      {
        refund_id: refund.id,
        refund_status: refund.status,
        refund_amount: refund.amount,
        succeeded_refund_total: succeededRefundTotal,
        refund_currency: refund.currency,
        stripe_event_id: eventId,
        credits_automatically_changed: creditOutcome.reversed,
        automatic_reversal_eligible: creditOutcome.eligible,
        refund_before_grant: creditOutcome.refundBeforeGrant,
        automatic_reversal_error: creditOutcome.error,
      }
    )
  }

  await createOrTouchAdminAlert(supabase, {
    dedupeKey: `billing:refund:${refund.id}`,
    severity:
      refund.status === "failed" || creditOutcome.requiresFollowUp
        ? "critical"
        : creditOutcome.reversed || creditOutcome.refundBeforeGrant
          ? "info"
          : "warning",
    title:
      refund.status === "failed"
        ? "Stripe refund failed"
        : creditOutcome.reversed
          ? "Refund credits reversed"
          : creditOutcome.refundBeforeGrant
            ? "Refunded grant suppressed"
          : "Refund requires credit follow-up",
    message:
      creditOutcome.reversed
        ? "Stripe reported a full refund and the matching unspent credit grant was reversed atomically."
        : creditOutcome.refundBeforeGrant
          ? "Stripe reported the full refund before fulfillment. A terminal tombstone now prevents any later webhook from granting those credits."
          : "Stripe reported a refund that could not be reversed automatically. Use the audited credit adjustment in Admin → Billing.",
    entityType: "stripe_refund",
    entityId: refund.id,
    userId: source?.userId ?? context.userId,
    billingOrderId: source?.billingOrder?.id ?? context.billingOrder?.id,
    metadata: {
      stripe_event_id: eventId,
      refund_status: refund.status,
      amount: refund.amount,
      succeeded_refund_total: succeededRefundTotal,
      currency: refund.currency,
      payment_intent_id: paymentIntentId,
      credit_source_type: source?.sourceType ?? null,
      credit_source_id: source?.sourceId ?? null,
      credits_automatically_changed: creditOutcome.reversed,
      automatic_reversal_eligible: creditOutcome.eligible,
      refund_before_grant: creditOutcome.refundBeforeGrant,
      automatic_reversal_error: creditOutcome.error,
    },
  })
}

async function recordFullStripeRefund(
  supabase: SupabaseAdmin,
  source: RefundCreditSource,
  refund: Stripe.Refund,
  eventId: string,
  succeededRefundTotal: number
): Promise<StripeCreditRefundOutcome> {
  const { data, error } = await supabase.rpc("record_stripe_credit_refund", {
    p_user_id: source.userId,
    p_source_type: source.sourceType,
    p_source_id: source.sourceId,
    p_refund_id: refund.id,
    p_billing_order_id: source.billingOrder?.id ?? null,
    p_idempotency_key:
      `stripe:refund:${source.sourceType}:${source.sourceId}:credit-reversal`,
    p_actor_email: "stripe-webhook",
    p_reason: `Full Stripe refund ${refund.id}`,
    p_metadata: {
      stripe_refund_id: refund.id,
      stripe_event_id: eventId,
      billing_order_id: source.billingOrder?.id ?? null,
      refund_amount: refund.amount,
      succeeded_refund_total: succeededRefundTotal,
      refund_currency: refund.currency,
      credit_source_type: source.sourceType,
      credit_source_id: source.sourceId,
    },
  })

  if (error || !data) {
    return {
      eligible: true,
      reversed: false,
      refundBeforeGrant: false,
      requiresFollowUp: true,
      error: error?.message ?? "The refund control returned no outcome.",
    }
  }

  const outcome = data as {
    reversed?: boolean
    refund_before_grant?: boolean
    requires_follow_up?: boolean
    error?: string | null
  }

  return {
    eligible: true,
    reversed: outcome.reversed === true,
    refundBeforeGrant: outcome.refund_before_grant === true,
    requiresFollowUp: outcome.requires_follow_up === true,
    error: outcome.error ?? null,
  }
}

async function resolveRefundCreditSource(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent,
  context: BillingContext
): Promise<RefundCreditSource | null> {
  if (paymentIntent.status !== "succeeded" || paymentIntent.amount_received <= 0) {
    return null
  }

  if (context.billingOrder?.kind === "credit_pack") {
    const checkoutSessionId =
      context.billingOrder.stripe_checkout_session_id

    if (!checkoutSessionId) return null
    if (
      context.billingOrder.stripe_payment_intent_id &&
      context.billingOrder.stripe_payment_intent_id !== paymentIntent.id
    ) {
      throw new Error(
        `PaymentIntent ${paymentIntent.id} does not match its credit-pack order.`
      )
    }

    return {
      userId: context.billingOrder.user_id,
      billingOrder: context.billingOrder,
      sourceType: "stripe_checkout_session",
      sourceId: checkoutSessionId,
      expectedAmount: paymentIntent.amount_received,
      currency: paymentIntent.currency,
    }
  }

  const invoicePayments = await stripe.invoicePayments.list({
    payment: {
      type: "payment_intent",
      payment_intent: paymentIntent.id,
    },
    limit: 100,
  })
  if (invoicePayments.has_more) {
    throw new Error(
      `PaymentIntent ${paymentIntent.id} has too many invoice payments to reconcile safely.`
    )
  }

  const matchingPayments = invoicePayments.data.filter(
    (payment) =>
      payment.status === "paid" &&
      getStripeId(payment.payment.payment_intent) === paymentIntent.id
  )
  if (matchingPayments.length !== 1) return null

  const invoiceId = getStripeId(matchingPayments[0].invoice)
  if (!invoiceId) return null

  const invoice = await stripe.invoices.retrieve(invoiceId)
  const invoicePaymentAmount = matchingPayments[0].amount_paid
  if (
    invoicePaymentAmount !== paymentIntent.amount_received ||
    invoice.amount_paid !== paymentIntent.amount_received ||
    invoice.currency !== paymentIntent.currency
  ) {
    return null
  }
  const invoiceMetadata =
    invoice.parent?.type === "subscription_details"
      ? invoice.parent.subscription_details?.metadata
      : null
  const resolvedUserId = await resolveUserId(
    supabase,
    invoiceMetadata,
    getStripeId(invoice.customer)
  )
  const userId = context.userId ?? resolvedUserId
  if (!userId) return null
  if (context.userId && resolvedUserId && context.userId !== resolvedUserId) {
    throw new Error(
      `Invoice ${invoice.id} and PaymentIntent ${paymentIntent.id} have different owners.`
    )
  }

  let billingOrder = context.billingOrder
  if (!billingOrder) {
    const { data, error } = await supabase
      .from("billing_orders")
      .select("*")
      .eq("stripe_invoice_id", invoice.id)
      .maybeSingle()
    if (error) {
      throw new Error(`Could not resolve refunded invoice order: ${error.message}`)
    }
    billingOrder = (data as BillingOrderRow | null) ?? null
  }

  const metadataBillingOrderId = invoiceMetadata?.billing_order_id
  if (!billingOrder && metadataBillingOrderId) {
    billingOrder = await getBillingOrderById(
      supabase,
      metadataBillingOrderId
    )
  }
  if (
    billingOrder &&
    (billingOrder.user_id !== userId || billingOrder.kind !== "subscription")
  ) {
    throw new Error(
      `Invoice ${invoice.id} does not match its Cuadrabot billing order.`
    )
  }

  return {
    userId,
    billingOrder,
    sourceType: "stripe_invoice",
    sourceId: invoice.id,
    expectedAmount: paymentIntent.amount_received,
    currency: paymentIntent.currency,
  }
}

async function getSucceededRefundTotal(
  stripe: Stripe,
  paymentIntentId: string,
  currentRefund: Stripe.Refund
) {
  const refunds = await stripe.refunds.list({
    payment_intent: paymentIntentId,
    limit: 100,
  })
  if (refunds.has_more) {
    throw new Error(
      `PaymentIntent ${paymentIntentId} has too many refunds to reconcile safely.`
    )
  }

  const succeeded = new Map(
    refunds.data
      .filter((refund) => refund.status === "succeeded")
      .map((refund) => [refund.id, refund])
  )
  if (currentRefund.status === "succeeded") {
    succeeded.set(currentRefund.id, currentRefund)
  }

  return [...succeeded.values()].reduce(
    (total, succeededRefund) => total + succeededRefund.amount,
    0
  )
}

async function handleLatestRefund(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  refundId: string,
  eventId: string
) {
  const refund = await stripe.refunds.retrieve(refundId)

  await handleRefund(supabase, stripe, refund, eventId)
}

async function handleChargeRefunded(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  charge: Stripe.Charge,
  eventId: string
) {
  if (charge.refunds?.data.length) {
    for (const refund of charge.refunds.data) {
      await handleRefund(supabase, stripe, refund, eventId)
    }

    return
  }

  const paymentIntentId = getStripeId(charge.payment_intent)
  const context = paymentIntentId
    ? await getBillingContextForPaymentIntent(
        supabase,
        stripe,
        paymentIntentId,
        charge.payment_intent &&
        typeof charge.payment_intent === "object"
          ? charge.payment_intent
          : undefined
      )
    : { billingOrder: null, userId: null }

  await createOrTouchAdminAlert(supabase, {
    dedupeKey: `billing:charge-refund:${charge.id}`,
    severity: "warning",
    title: "Refunded charge needs credit follow-up",
    message:
      "Stripe reported a refunded charge without refund details. Use the audited adjustment in Admin → Billing after checking the payment and available balance.",
    entityType: "stripe_charge",
    entityId: charge.id,
    userId: context.userId,
    billingOrderId: context.billingOrder?.id,
    metadata: {
      stripe_event_id: eventId,
      amount_refunded: charge.amount_refunded,
      currency: charge.currency,
      payment_intent_id: paymentIntentId,
      credits_automatically_changed: false,
    },
  })
}

async function handleDispute(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  dispute: Stripe.Dispute,
  eventId: string
) {
  const paymentIntentId = getStripeId(dispute.payment_intent)
  const context = paymentIntentId
    ? await getBillingContextForPaymentIntent(
        supabase,
        stripe,
        paymentIntentId,
        dispute.payment_intent &&
        typeof dispute.payment_intent === "object"
          ? dispute.payment_intent
          : undefined
      )
    : { billingOrder: null, userId: null }

  if (context.billingOrder) {
    await recordBillingRisk(
      supabase,
      context.billingOrder,
      "stripe_dispute_review",
      {
        dispute_id: dispute.id,
        dispute_status: dispute.status,
        dispute_reason: dispute.reason,
        dispute_amount: dispute.amount,
        dispute_currency: dispute.currency,
        stripe_event_id: eventId,
        credits_automatically_changed: false,
      }
    )
  }

  await createOrTouchAdminAlert(supabase, {
    dedupeKey: `billing:dispute:${dispute.id}`,
    severity: dispute.status === "won" ? "info" : "critical",
    title:
      dispute.status === "won"
        ? "Payment dispute was won"
        : "Payment dispute requires attention",
    message:
      "Stripe reported a payment dispute. Check the delivery evidence and account usage, then use Admin → Billing if a credit adjustment is required.",
    entityType: "stripe_dispute",
    entityId: dispute.id,
    userId: context.userId,
    billingOrderId: context.billingOrder?.id,
    metadata: {
      stripe_event_id: eventId,
      dispute_status: dispute.status,
      dispute_reason: dispute.reason,
      amount: dispute.amount,
      currency: dispute.currency,
      payment_intent_id: paymentIntentId,
      credits_automatically_changed: false,
    },
  })
}

async function handleLatestDispute(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  disputeId: string,
  eventId: string
) {
  const dispute = await stripe.disputes.retrieve(disputeId)

  await handleDispute(supabase, stripe, dispute, eventId)
}

async function handleLatestCustomerUpdated(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  customerId: string
) {
  const customer = await stripe.customers.retrieve(customerId)

  if (customer.deleted) return

  const userId = await resolveUserId(
    supabase,
    customer.metadata,
    customer.id
  )

  if (!userId || !customer.address) return

  await updateBillingLocation(supabase, userId, customer.address)
}

async function getAllInvoiceLines(
  stripe: Stripe,
  invoice: Stripe.Invoice
): Promise<Stripe.InvoiceLineItem[]> {
  if (!invoice.lines.has_more) return invoice.lines.data

  const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 100 })

  if (lines.has_more) {
    throw new Error(
      `Invoice ${invoice.id} has too many lines for automatic credit fulfillment.`
    )
  }

  return lines.data
}

async function fulfillStripeCredits(
  supabase: SupabaseAdmin,
  input: {
    userId: string
    amount: number
    entryType: "purchase_grant" | "subscription_grant"
    sourceType: string
    sourceId: string
    idempotencyKey: string
    billingOrderId: string | null
    stripePriceId: string
    stripeCheckoutSessionId: string | null
    stripePaymentIntentId: string | null
    stripeSubscriptionId: string | null
    stripeInvoiceId: string | null
    paidAt: string
    metadata: Record<string, unknown>
  }
) : Promise<StripeCreditFulfillmentOutcome> {
  const { data, error } = await supabase.rpc("fulfill_stripe_credit_grant", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_entry_type: input.entryType,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_idempotency_key: input.idempotencyKey,
    p_billing_order_id: input.billingOrderId,
    p_stripe_price_id: input.stripePriceId,
    p_stripe_checkout_session_id: input.stripeCheckoutSessionId,
    p_stripe_payment_intent_id: input.stripePaymentIntentId,
    p_stripe_subscription_id: input.stripeSubscriptionId,
    p_stripe_invoice_id: input.stripeInvoiceId,
    p_paid_at: input.paidAt,
    p_metadata: input.metadata,
  })

  if (error || !data) {
    throw new Error(
      `Could not fulfill Stripe credits: ${error?.message ?? "No outcome was returned."}`
    )
  }

  return data as StripeCreditFulfillmentOutcome
}

async function loadAndValidateBillingPlan(
  supabase: SupabaseAdmin,
  item: ConfiguredBillingCatalogItem
): Promise<BillingPlanRow> {
  const { data, error } = await supabase
    .from("billing_plans")
    .select(
      "id,slug,plan_type,currency,price_cents,credits,billing_interval,stripe_price_id,active"
    )
    .eq("slug", item.sku)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not read billing plan: ${error.message}`)
  }

  const plan = data as BillingPlanRow | null

  if (
    !plan ||
    plan.plan_type !== item.kind ||
    plan.currency !== item.currency ||
    plan.price_cents !== item.priceCents ||
    plan.credits !== item.credits ||
    plan.billing_interval !== item.billingInterval ||
    plan.stripe_price_id !== item.priceId
  ) {
    throw new Error(
      `Billing plan ${item.sku} does not match the server catalog.`
    )
  }

  return plan
}

function validateBillingOrderAgainstCatalog(
  billingOrder: BillingOrderRow,
  item: ConfiguredBillingCatalogItem
) {
  if (
    billingOrder.sku !== item.sku ||
    billingOrder.kind !== item.kind ||
    billingOrder.credits !== item.credits ||
    billingOrder.currency !== item.currency ||
    billingOrder.amount !== item.priceCents ||
    billingOrder.stripe_price_id !== item.priceId ||
    billingOrder.catalog_version !== BILLING_CATALOG_VERSION
  ) {
    throw new Error(
      `Billing order ${billingOrder.id} does not match the server catalog.`
    )
  }
}

async function getBillingOrderById(
  supabase: SupabaseAdmin,
  billingOrderId: string
) {
  const { data, error } = await supabase
    .from("billing_orders")
    .select("*")
    .eq("id", billingOrderId)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not read billing order: ${error.message}`)
  }

  return (data as BillingOrderRow | null) ?? null
}

async function updateBillingOrder(
  supabase: SupabaseAdmin,
  billingOrderId: string,
  values: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("billing_orders")
    .update(values)
    .eq("id", billingOrderId)
    .select("id")
    .maybeSingle()

  if (error) {
    throw new Error(`Could not update billing order: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Billing order ${billingOrderId} no longer exists.`)
  }
}

async function assertBillingCustomer(
  supabase: SupabaseAdmin,
  userId: string,
  stripeCustomerId: string | null
) {
  if (!stripeCustomerId) {
    throw new Error("Stripe billing object has no Customer.")
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not verify Stripe Customer: ${error.message}`)
  }

  if (data?.stripe_customer_id !== stripeCustomerId) {
    throw new Error("Stripe Customer does not match the Cuadrabot user.")
  }
}

async function resolveUserId(
  supabase: SupabaseAdmin,
  metadata: Record<string, string> | null | undefined,
  stripeCustomerId: string | null
) {
  const metadataUserId = metadata?.cuadrabot_user_id

  if (metadataUserId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,stripe_customer_id")
      .eq("id", metadataUserId)
      .maybeSingle()

    if (error) {
      throw new Error(`Could not resolve billing user: ${error.message}`)
    }

    if (!data) return null

    if (
      stripeCustomerId &&
      data.stripe_customer_id &&
      data.stripe_customer_id !== stripeCustomerId
    ) {
      throw new Error("Stripe metadata and Customer ownership disagree.")
    }

    return data.id as string
  }

  if (!stripeCustomerId) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not resolve Stripe Customer: ${error.message}`)
  }

  return (data?.id as string | undefined) ?? null
}

async function getBillingContextForPaymentIntent(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  paymentIntentId: string,
  expandedPaymentIntent?: Stripe.PaymentIntent
): Promise<BillingContext> {
  const { data, error } = await supabase
    .from("billing_orders")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not resolve billing payment: ${error.message}`)
  }

  const billingOrder = (data as BillingOrderRow | null) ?? null

  if (billingOrder) {
    return { billingOrder, userId: billingOrder.user_id }
  }

  const paymentIntent =
    expandedPaymentIntent ??
    (await stripe.paymentIntents.retrieve(paymentIntentId))
  const userId = await resolveUserId(
    supabase,
    paymentIntent.metadata,
    getStripeId(paymentIntent.customer)
  )
  const metadataBillingOrderId = paymentIntent.metadata.billing_order_id

  if (metadataBillingOrderId) {
    const metadataBillingOrder = await getBillingOrderById(
      supabase,
      metadataBillingOrderId
    )

    if (!metadataBillingOrder) {
      throw new Error(
        `PaymentIntent ${paymentIntentId} references a missing billing order.`
      )
    }

    if (userId && metadataBillingOrder.user_id !== userId) {
      throw new Error(
        `PaymentIntent ${paymentIntentId} has inconsistent ownership metadata.`
      )
    }

    return {
      billingOrder: metadataBillingOrder,
      userId: metadataBillingOrder.user_id,
    }
  }

  return { billingOrder: null, userId }
}

async function recordBillingRisk(
  supabase: SupabaseAdmin,
  billingOrder: BillingOrderRow,
  metadataKey: string,
  riskMetadata: Record<string, unknown>
) {
  await updateBillingOrder(supabase, billingOrder.id, {
    metadata: mergeMetadata(billingOrder.metadata, {
      [metadataKey]: riskMetadata,
    }),
  })
}

async function updateBillingLocation(
  supabase: SupabaseAdmin,
  userId: string,
  address: Stripe.Address | null
) {
  if (!address) return

  const values: Record<string, string> = {
    location_source: "billing",
  }

  if (address.country?.length === 2) {
    values.country_code = address.country.toUpperCase()
  }

  if (address.state) values.region = address.state
  if (address.city) values.city = address.city

  if (Object.keys(values).length === 1) return

  const { error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", userId)

  if (error) {
    throw new Error(`Could not save billing location: ${error.message}`)
  }
}

async function createOrTouchAdminAlert(
  supabase: SupabaseAdmin,
  input: AdminAlertInput
) {
  const now = new Date().toISOString()
  const { data: existing, error: readError } = await supabase
    .from("admin_alerts")
    .select("id,occurrence_count")
    .eq("dedupe_key", input.dedupeKey)
    .in("status", ["open", "acknowledged"])
    .maybeSingle()

  if (readError) {
    throw new Error(`Could not read admin alert: ${readError.message}`)
  }

  if (existing) {
    const { error } = await supabase
      .from("admin_alerts")
      .update({
        severity: input.severity,
        title: input.title,
        message: input.message,
        occurrence_count: existing.occurrence_count + 1,
        last_seen_at: now,
        metadata: input.metadata ?? {},
      })
      .eq("id", existing.id)

    if (error) {
      throw new Error(`Could not update admin alert: ${error.message}`)
    }

    return
  }

  const { error } = await supabase.from("admin_alerts").insert({
    severity: input.severity,
    category: "billing",
    title: input.title,
    message: input.message,
    status: "open",
    dedupe_key: input.dedupeKey,
    entity_type: input.entityType,
    entity_id: input.entityId,
    user_id: input.userId ?? null,
    billing_order_id: input.billingOrderId ?? null,
    metadata: input.metadata ?? {},
    first_seen_at: now,
    last_seen_at: now,
  })

  if (error && error.code !== "23505") {
    throw new Error(`Could not create admin alert: ${error.message}`)
  }
}

async function claimStripeEvent(
  supabase: SupabaseAdmin,
  event: Stripe.Event
) {
  const now = new Date().toISOString()
  const { error: insertError } = await supabase.from("stripe_events").insert({
    id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    api_version: event.api_version,
    status: "processing",
    attempt_count: 1,
    payload: event as unknown as Record<string, unknown>,
    last_error: null,
    event_created_at: toIsoTime(event.created),
    processed_at: null,
    updated_at: now,
  })

  if (!insertError) return true

  if (insertError.code !== "23505") {
    throw new Error(`Could not record Stripe event: ${insertError.message}`)
  }

  const { data, error } = await supabase
    .from("stripe_events")
    .select("id,status,attempt_count")
    .eq("id", event.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not read Stripe event: ${error.message}`)
  }

  const existing = data as StripeEventRow | null

  if (!existing) {
    throw new Error(`Stripe event ${event.id} disappeared after a conflict.`)
  }

  if (existing.status === "processed" || existing.status === "ignored") {
    return false
  }

  const { error: retryError } = await supabase
    .from("stripe_events")
    .update({
      status: "processing",
      attempt_count: existing.attempt_count + 1,
      payload: event as unknown as Record<string, unknown>,
      last_error: null,
      processed_at: null,
      updated_at: now,
    })
    .eq("id", event.id)

  if (retryError) {
    throw new Error(`Could not retry Stripe event: ${retryError.message}`)
  }

  return true
}

async function finishStripeEvent(
  supabase: SupabaseAdmin,
  eventId: string,
  status: "processed" | "ignored"
) {
  const { error } = await supabase
    .from("stripe_events")
    .update({
      status,
      last_error: null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId)

  if (error) {
    throw new Error(`Could not finish Stripe event: ${error.message}`)
  }
}

async function failStripeEvent(
  supabase: SupabaseAdmin,
  eventId: string,
  errorMessage: string
) {
  const { error } = await supabase
    .from("stripe_events")
    .update({
      status: "failed",
      last_error: errorMessage.slice(0, 2_000),
      processed_at: null,
    })
    .eq("id", eventId)

  if (error) {
    console.error("Could not mark Stripe event failed.", {
      eventId,
      error: error.message,
    })
  }
}

function mergeMetadata(
  current: Record<string, unknown> | null,
  next: Record<string, unknown>
) {
  return {
    ...(current ?? {}),
    ...next,
  }
}

function getStripeId(value: unknown): string | null {
  if (typeof value === "string") return value

  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id
  }

  return null
}

function toIsoTime(epochSeconds: number) {
  return new Date(epochSeconds * 1_000).toISOString()
}

function nullableIsoTime(epochSeconds: number | null) {
  return epochSeconds ? toIsoTime(epochSeconds) : null
}

function safeErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Unknown webhook error").slice(
    0,
    2_000
  )
}
