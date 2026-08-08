import "server-only"

import type Stripe from "stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type StripeCustomerInput = {
  userId: string
  email: string | null
  fullName: string | null
  stripeCustomerId: string | null
  preferredLocales?: Stripe.CustomerCreateParams["preferred_locales"]
  createdFor?: string
}

export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  input: StripeCustomerInput
) {
  if (
    input.stripeCustomerId &&
    (await stripeCustomerIsUsable(
      stripe,
      input.stripeCustomerId,
      input.userId
    ))
  ) {
    return input.stripeCustomerId
  }

  const customer = await stripe.customers.create(
    {
      email: input.email ?? undefined,
      name: input.fullName ?? undefined,
      preferred_locales: input.preferredLocales,
      metadata: {
        cuadrabot_user_id: input.userId,
        ...(input.createdFor ? { created_for: input.createdFor } : {}),
      },
    },
    {
      // v2 intentionally replaces customer ids saved under the previous
      // Stripe account/mode while remaining idempotent for concurrent calls.
      idempotencyKey: `cuadrabot-customer:${input.userId}:v2`,
    }
  )
  const supabase = createSupabaseAdminClient()
  const update = supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", input.userId)
  const claim = input.stripeCustomerId
    ? update.eq("stripe_customer_id", input.stripeCustomerId)
    : update.is("stripe_customer_id", null)
  const { data: claimedProfile, error: claimError } = await claim
    .select("stripe_customer_id")
    .maybeSingle()

  if (claimError) {
    throw new Error(`Could not save the Stripe Customer: ${claimError.message}`)
  }

  if (claimedProfile?.stripe_customer_id) {
    return claimedProfile.stripe_customer_id as string
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", input.userId)
    .maybeSingle()

  if (currentProfileError || !currentProfile?.stripe_customer_id) {
    throw new Error(
      currentProfileError?.message ??
        "Could not resolve the customer's Stripe account."
    )
  }

  const currentCustomerId = currentProfile.stripe_customer_id as string
  if (
    await stripeCustomerIsUsable(stripe, currentCustomerId, input.userId)
  ) {
    return currentCustomerId
  }

  throw new Error("The saved Stripe Customer is unavailable in the active mode.")
}

async function stripeCustomerIsUsable(
  stripe: Stripe,
  customerId: string,
  userId: string
) {
  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) return false

    const ownerId = customer.metadata.cuadrabot_user_id
    if (ownerId && ownerId !== userId) {
      throw new Error("The saved Stripe Customer belongs to another user.")
    }

    return true
  } catch (error) {
    if (isMissingStripeResource(error)) return false
    throw error
  }
}

function isMissingStripeResource(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "resource_missing"
  )
}
