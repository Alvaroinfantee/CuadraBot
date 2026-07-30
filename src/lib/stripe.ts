import "server-only"

import Stripe from "stripe"
import { getOptionalEnv } from "@/lib/config"

export const STRIPE_API_VERSION = "2026-04-22.dahlia" as const

let stripeClient: Stripe | null = null

export class StripeConfigurationError extends Error {
  readonly code = "stripe_not_configured"
  readonly envName: string

  constructor(envName: string) {
    super(`Missing required Stripe environment variable: ${envName}`)
    this.name = "StripeConfigurationError"
    this.envName = envName
  }
}

export function getStripe() {
  if (stripeClient) return stripeClient

  stripeClient = new Stripe(getStripeEnv("STRIPE_SECRET_KEY"), {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 20_000,
    typescript: true,
  })

  return stripeClient
}

export function getStripeWebhookSecret() {
  return getStripeEnv("STRIPE_WEBHOOK_SECRET")
}

function getStripeEnv(name: string) {
  const value = getOptionalEnv(name)?.trim()

  if (!value) {
    throw new StripeConfigurationError(name)
  }

  return value
}
