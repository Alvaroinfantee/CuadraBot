import "server-only"

import { nanoid } from "nanoid"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { customerUploadBucket, getSiteUrl } from "@/lib/config"
import { orderConfirmationEmail, sendTransactionalEmail } from "@/lib/email"
import type { Order, PackagePlan } from "@/lib/types"

export function createPublicToken() {
  return nanoid(48)
}

export function createOrderNumber() {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")

  return `CB-${date}-${nanoid(6).toUpperCase()}`
}

export function orderStatusUrl(publicToken: string) {
  return `${getSiteUrl()}/orders/${publicToken}`
}

export async function getOrderByPublicToken(publicToken: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("orders")
    .select("*, packages(*), order_files(*)")
    .eq("public_token", publicToken)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function sendAndRecordOrderConfirmation(input: {
  order: Order
  packagePlan: PackagePlan
}) {
  const supabase = createSupabaseAdminClient()
  const email = orderConfirmationEmail({
    orderNumber: input.order.order_number,
    packageName: input.packagePlan.name,
    statusUrl: orderStatusUrl(input.order.public_token),
  })
  const result = await sendTransactionalEmail({
    to: input.order.customer_email,
    ...email,
  })

  await supabase.from("email_events").insert({
    order_id: input.order.id,
    email_type: "order_confirmation",
    recipient: input.order.customer_email,
    provider_message_id: result.providerMessageId,
    status: result.status,
  })
}

export async function createCustomerUploadSignedUrl(input: {
  orderNumber: string
  filename: string
  mimeType: string
}) {
  const supabase = createSupabaseAdminClient()
  const path = `orders/${input.orderNumber}/input/${crypto.randomUUID()}-${input.filename}`
  const { data, error } = await supabase.storage
    .from(customerUploadBucket)
    .createSignedUploadUrl(path)

  if (error) {
    throw new Error(error.message)
  }

  return { ...data, bucket: customerUploadBucket, path }
}
