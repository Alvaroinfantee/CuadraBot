import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260729153834_takeoff_self_serve_saas.sql",
    import.meta.url
  ),
  "utf8"
)
const webhook = readFileSync(
  new URL("../src/app/api/stripe/webhook/route.ts", import.meta.url),
  "utf8"
)

test("Stripe grants and full refunds share a source-level database control", () => {
  assert.match(migration, /create table if not exists public\.stripe_credit_fulfillments/)
  assert.match(migration, /create or replace function public\.fulfill_stripe_credit_grant/)
  assert.match(migration, /create or replace function public\.record_stripe_credit_refund/)
  assert.match(
    webhook,
    /stripe:refund:\$\{source\.sourceType\}:\$\{source\.sourceId\}:credit-reversal/
  )
  assert.doesNotMatch(webhook, /\.rpc\("grant_credits"/)
})

test("refund reconciliation covers renewals and cumulative succeeded refunds", () => {
  assert.match(webhook, /stripe\.invoicePayments\.list/)
  assert.match(webhook, /payment_intent: paymentIntent\.id/)
  assert.match(webhook, /getSucceededRefundTotal/)
  assert.match(webhook, /invoice\.amount_paid !== paymentIntent\.amount_received/)
  assert.match(migration, /observed_refund_ids/)
})

test("billing orders snapshot the configured Stripe Price", () => {
  assert.match(
    migration,
    /stripe_price_id text not null check \(stripe_price_id ~ '\^price_'\)/
  )
  assert.match(migration, /create or replace function public\.admin_sync_billing_catalog/)
})
