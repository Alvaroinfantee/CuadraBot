"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth"
import {
  assertStripePriceMatchesCatalog,
  BILLING_CATALOG,
  getConfiguredBillingCatalogItem,
  getStripePriceProductId,
} from "@/lib/billing-catalog"
import { getStripe } from "@/lib/stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

function field(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

export async function updateUserStatus(formData: FormData) {
  const admin = await requireAdmin()
  const userId = field(formData, "userId")
  const status = field(formData, "status")
  const reason = field(formData, "reason")
  if (!userId || !["active", "suspended"].includes(status)) {
    throw new Error("Invalid account update.")
  }
  if (userId === admin.id && status !== "active") {
    throw new Error("You cannot suspend your own admin account.")
  }

  const supabase = createSupabaseAdminClient()
  const billingControlErrors: string[] = []
  const canceledSubscriptionIds: string[] = []
  const expiredCheckoutOrderIds: string[] = []

  if (status === "suspended") {
    const { data: renewableSubscriptions, error: subscriptionReadError } =
      await supabase
        .from("subscriptions")
        .select("id,stripe_subscription_id,status")
        .eq("user_id", userId)
        .in("status", [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "incomplete",
        ])

    if (subscriptionReadError) {
      billingControlErrors.push(subscriptionReadError.message)
    } else if (renewableSubscriptions?.length) {
      try {
        const stripe = getStripe()
        const results = await Promise.allSettled(
          renewableSubscriptions.map(async (subscription) => {
            await stripe.subscriptions.update(
              subscription.stripe_subscription_id,
              { cancel_at_period_end: true }
            )
            canceledSubscriptionIds.push(subscription.id)
          })
        )
        for (const result of results) {
          if (result.status === "rejected") {
            billingControlErrors.push(
              result.reason instanceof Error
                ? result.reason.message
                : "Stripe subscription update failed."
            )
          }
        }
      } catch (error) {
        billingControlErrors.push(
          error instanceof Error
            ? error.message
            : "Stripe subscription cancellation is unavailable."
        )
      }

      if (canceledSubscriptionIds.length) {
        const { error: localSubscriptionError } = await supabase
          .from("subscriptions")
          .update({ cancel_at_period_end: true })
          .in("id", canceledSubscriptionIds)
        if (localSubscriptionError) {
          billingControlErrors.push(localSubscriptionError.message)
        }
      }
    }

    const { data: openCheckouts, error: checkoutReadError } = await supabase
      .from("billing_orders")
      .select("id,stripe_checkout_session_id")
      .eq("user_id", userId)
      .eq("status", "checkout_created")
      .not("stripe_checkout_session_id", "is", null)

    if (checkoutReadError) {
      billingControlErrors.push(checkoutReadError.message)
    } else if (openCheckouts?.length) {
      try {
        const stripe = getStripe()
        const results = await Promise.allSettled(
          openCheckouts.map(async (order) => {
            await stripe.checkout.sessions.expire(
              order.stripe_checkout_session_id
            )
            expiredCheckoutOrderIds.push(order.id)
          })
        )
        for (const result of results) {
          if (result.status === "rejected") {
            billingControlErrors.push(
              result.reason instanceof Error
                ? result.reason.message
                : "Stripe Checkout expiration failed."
            )
          }
        }
      } catch (error) {
        billingControlErrors.push(
          error instanceof Error
            ? error.message
            : "Stripe Checkout expiration is unavailable."
        )
      }

      if (expiredCheckoutOrderIds.length) {
        const { error: localCheckoutError } = await supabase
          .from("billing_orders")
          .update({
            status: "expired",
            canceled_at: new Date().toISOString(),
            failure_code: "workspace_suspended",
            failure_message:
              "Checkout expired because the workspace was suspended.",
          })
          .in("id", expiredCheckoutOrderIds)
          .eq("status", "checkout_created")
        if (localCheckoutError) {
          billingControlErrors.push(localCheckoutError.message)
        }
      }
    }
  }

  if (status === "active") {
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { ban_duration: "none" }
    )
    if (authError) throw new Error(`Could not restore sign-in: ${authError.message}`)
  }

  const { error: statusError } = await supabase.rpc(
    "admin_set_profile_status",
    {
      p_user_id: userId,
      p_status: status,
      p_actor_user_id: admin.id,
      p_actor_email: admin.email,
      p_reason: reason,
      p_metadata: {
        stripe_cancel_at_period_end_requested:
          status === "suspended" ? canceledSubscriptionIds : [],
        stripe_checkout_sessions_expired: expiredCheckoutOrderIds,
        stripe_errors: billingControlErrors,
      },
    }
  )
  if (statusError) throw new Error(statusError.message)

  const { error: authError } =
    status === "suspended"
      ? await supabase.auth.admin.updateUserById(userId, {
          ban_duration: "876000h",
        })
      : { error: null }

  if (authError || billingControlErrors.length) {
    const messages = [
      authError ? `Auth revocation: ${authError.message}` : null,
      ...billingControlErrors.map(
        (message) => `Billing control: ${message}`
      ),
    ].filter(Boolean)
    const { error: alertError } = await supabase.from("admin_alerts").insert({
      severity: "critical",
      category: authError ? "security" : "billing",
      title: "Account suspension needs follow-up",
      message:
        "Workspace data access is blocked, but one or more external account controls need operator follow-up.",
      status: "open",
      dedupe_key: `account-suspension-follow-up:${userId}`,
      entity_type: "profile",
      entity_id: userId,
      user_id: userId,
      metadata: { errors: messages },
    })
    if (alertError && !alertError.message.includes("duplicate")) {
      throw new Error(
        `Account access changed, but the follow-up alert failed: ${alertError.message}`
      )
    }
  }

  revalidatePath("/admin")
  revalidatePath("/admin/users")
  revalidatePath("/admin/billing")
  revalidatePath("/admin/health")
}

export async function adjustCredits(formData: FormData) {
  const admin = await requireAdmin()
  const userId = field(formData, "userId")
  const amount = Number(field(formData, "amount"))
  const reason = field(formData, "reason")
  const idempotencyKey = field(formData, "idempotencyKey")

  if (
    !userId ||
    !Number.isSafeInteger(amount) ||
    amount === 0 ||
    Math.abs(amount) > 100_000 ||
    reason.length < 8 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idempotencyKey
    )
  ) {
    throw new Error(
      "Choose a customer, enter a nonzero whole-credit adjustment, and provide a clear reason."
    )
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc("admin_adjust_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_actor_user_id: admin.id,
    p_actor_email: admin.email,
    p_reason: reason,
  })

  if (error) throw new Error(error.message)

  revalidatePath("/admin")
  revalidatePath("/admin/billing")
  revalidatePath("/admin/users")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/billing")
}

export async function scheduleSubscriptionCancellation(formData: FormData) {
  const admin = await requireAdmin()
  const subscriptionId = field(formData, "subscriptionId")
  const reason = field(formData, "reason")
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      subscriptionId
    ) ||
    reason.length < 8
  ) {
    throw new Error("Choose a subscription and provide a clear reason.")
  }

  const supabase = createSupabaseAdminClient()
  const { data: subscription, error: readError } = await supabase
    .from("subscriptions")
    .select("id,stripe_subscription_id,cancel_at_period_end,status")
    .eq("id", subscriptionId)
    .maybeSingle()
  if (readError || !subscription) {
    throw new Error(readError?.message ?? "Subscription not found.")
  }

  if (!subscription.cancel_at_period_end) {
    await getStripe().subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true }
    )
  }

  const { error } = await supabase.rpc(
    "admin_schedule_subscription_cancel",
    {
      p_subscription_id: subscription.id,
      p_actor_user_id: admin.id,
      p_actor_email: admin.email,
      p_reason: reason,
    }
  )
  if (error) throw new Error(error.message)

  revalidatePath("/admin")
  revalidatePath("/admin/billing")
}

export async function syncStripeCatalog() {
  const admin = await requireAdmin()
  const stripe = getStripe()
  const configuredCatalog = BILLING_CATALOG.map((definition) =>
    getConfiguredBillingCatalogItem(definition.sku)
  )
  const prices = await Promise.all(
    configuredCatalog.map((item) => stripe.prices.retrieve(item.priceId))
  )
  const catalog = configuredCatalog.map((item, index) => {
    const price = prices[index]
    assertStripePriceMatchesCatalog(price, item)

    return {
      slug: item.sku,
      name: item.name,
      description: item.description,
      plan_type: item.kind,
      currency: item.currency,
      price_cents: item.priceCents,
      credits: item.credits,
      billing_interval: item.billingInterval,
      stripe_price_id: price.id,
      stripe_product_id: getStripePriceProductId(price),
    }
  })

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc("admin_sync_billing_catalog", {
    p_catalog: catalog,
    p_actor_user_id: admin.id,
    p_actor_email: admin.email,
  })
  if (error) throw new Error(error.message)

  revalidatePath("/admin")
  revalidatePath("/admin/billing")
  revalidatePath("/dashboard/billing")
  redirect("/admin/billing?catalog=synced")
}

export async function reviewTakeoff(formData: FormData) {
  const admin = await requireAdmin()
  const jobId = field(formData, "jobId")
  const decision = field(formData, "decision")
  const notes = field(formData, "notes")
  if (!jobId || !["approve", "requeue", "cancel"].includes(decision)) {
    throw new Error("Invalid correction or exception decision.")
  }

  const supabase = createSupabaseAdminClient()
  const { data: job, error } = await supabase.rpc(
    "admin_resolve_takeoff",
    {
      p_job_id: jobId,
      p_decision: decision,
      p_notes: notes,
      p_actor_user_id: admin.id,
      p_actor_email: admin.email,
    }
  )
  if (error || !job) {
    throw new Error(error?.message ?? "Could not apply the takeoff decision.")
  }

  revalidatePath("/admin")
  revalidatePath("/admin/jobs")
  revalidatePath(`/admin/jobs/${jobId}`)
  revalidatePath(`/dashboard/jobs/${jobId}`)
  if (decision === "approve") redirect(`/admin/jobs/${jobId}?approved=1`)
}

export async function resolveAlert(formData: FormData) {
  const admin = await requireAdmin()
  const alertId = field(formData, "alertId")
  const status = field(formData, "status")
  if (!alertId || !["acknowledged", "resolved", "dismissed"].includes(status)) {
    throw new Error("Invalid alert update.")
  }

  const supabase = createSupabaseAdminClient()
  const timestamp =
    status === "acknowledged"
      ? { acknowledged_at: new Date().toISOString() }
      : status === "resolved"
        ? { resolved_at: new Date().toISOString() }
        : {}
  const { error } = await supabase
    .from("admin_alerts")
    .update({ status, ...timestamp })
    .eq("id", alertId)
  if (error) throw new Error(error.message)

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_user_id: admin.id,
    actor_email: admin.email,
    action: `alert.${status}`,
    target_type: "admin_alert",
    target_id: alertId,
  })
  if (auditError) {
    throw new Error(`Alert changed but audit logging failed: ${auditError.message}`)
  }
  revalidatePath("/admin")
  revalidatePath("/admin/health")
}

export async function updateSetting(formData: FormData) {
  const admin = await requireAdmin()
  const key = field(formData, "key")
  const rawValue = field(formData, "value")
  const reason = field(formData, "reason")
  const allowedKeys = new Set([
    "features.free_sample",
    "features.subscriptions",
    "features.maintenance",
  ])
  if (!allowedKeys.has(key)) throw new Error("This setting is not editable here.")

  let value: unknown
  try {
    value = JSON.parse(rawValue)
  } catch {
    throw new Error("Setting value must be valid JSON.")
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("enabled" in value) ||
    typeof value.enabled !== "boolean"
  ) {
    throw new Error('Setting value must contain an "enabled" boolean.')
  }
  if (
    key === "features.maintenance" &&
    "message" in value &&
    typeof value.message !== "string"
  ) {
    throw new Error("The maintenance message must be text.")
  }

  const supabase = createSupabaseAdminClient()
  const { data: before } = await supabase
    .from("app_settings")
    .select("*")
    .eq("key", key)
    .maybeSingle()
  const { error } = await supabase
    .from("app_settings")
    .update({ value, updated_by: admin.id })
    .eq("key", key)
  if (error) throw new Error(error.message)

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    actor_user_id: admin.id,
    actor_email: admin.email,
    action: "app_setting.updated",
    target_type: "app_setting",
    target_id: key,
    reason: reason || null,
    before_state: before,
    after_state: { value },
  })
  if (auditError) {
    throw new Error(`Setting changed but audit logging failed: ${auditError.message}`)
  }
  revalidatePath("/admin/settings")
}
