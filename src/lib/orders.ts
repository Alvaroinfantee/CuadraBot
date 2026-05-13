import "server-only"

import { nanoid } from "nanoid"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  customerUploadBucket,
  getSiteUrl,
  jobReminderEmail,
  ownerRequestEmail,
} from "@/lib/config"
import { formatMoney } from "@/lib/format"
import {
  orderConfirmationEmail,
  ownerJobReminderEmail,
  ownerJobRequestEmail,
  sendTransactionalEmail,
} from "@/lib/email"
import type { Order, OrderFile, PackagePlan } from "@/lib/types"

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

export function adminOrderUrl(orderId: string) {
  return `${getSiteUrl()}/admin/orders/${orderId}`
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

export async function sendAndRecordOwnerJobNotifications(input: {
  order: Order
  packagePlan: PackagePlan
}) {
  const supabase = createSupabaseAdminClient()
  const existingTypes = new Set<string>()
  const { data: existingEmailEvents, error: existingError } = await supabase
    .from("email_events")
    .select("email_type")
    .eq("order_id", input.order.id)
    .in("email_type", ["owner_job_request", "owner_job_reminder"])

  if (existingError) {
    throw new Error(existingError.message)
  }

  for (const event of existingEmailEvents ?? []) {
    existingTypes.add(event.email_type)
  }

  const { data: files, error: filesError } = await supabase
    .from("order_files")
    .select("*")
    .eq("order_id", input.order.id)
    .eq("file_role", "customer_upload")
    .order("created_at", { ascending: true })

  if (filesError) {
    throw new Error(filesError.message)
  }

  const signedFiles = await Promise.all(
    ((files ?? []) as OrderFile[]).map(async (file) => {
      const { data } = await supabase.storage
        .from(file.bucket)
        .createSignedUrl(file.storage_path, 7 * 24 * 60 * 60)

      return {
        name: file.original_filename,
        role: file.file_role,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )

  const shared = {
    orderNumber: input.order.order_number,
    customerEmail: input.order.customer_email,
    packageName: input.packagePlan.name,
    amount: formatMoney(
      input.order.amount_cents ?? input.packagePlan.price_cents,
      input.order.currency ?? input.packagePlan.currency
    ),
    adminUrl: adminOrderUrl(input.order.id),
  }

  if (!existingTypes.has("owner_job_request")) {
    const email = ownerJobRequestEmail({
      ...shared,
      customerName: input.order.customer_name,
      status: input.order.status,
      renderType: input.order.render_type,
      projectType: input.order.project_type,
      stylePreference: input.order.style_preference,
      numberOfFloors: input.order.number_of_floors,
      estimatedSquareMeters: input.order.estimated_square_meters,
      deadlinePreference: input.order.deadline_preference,
      customerNotes: input.order.customer_notes,
      customerStatusUrl: orderStatusUrl(input.order.public_token),
      files: signedFiles,
    })
    const result = await sendTransactionalEmail({
      to: ownerRequestEmail,
      ...email,
    })

    await supabase.from("email_events").insert({
      order_id: input.order.id,
      email_type: "owner_job_request",
      recipient: ownerRequestEmail,
      provider_message_id: result.providerMessageId,
      status: result.status,
    })
  }

  if (!existingTypes.has("owner_job_reminder")) {
    const email = ownerJobReminderEmail(shared)
    const result = await sendTransactionalEmail({
      to: jobReminderEmail,
      ...email,
    })

    await supabase.from("email_events").insert({
      order_id: input.order.id,
      email_type: "owner_job_reminder",
      recipient: jobReminderEmail,
      provider_message_id: result.providerMessageId,
      status: result.status,
    })
  }
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
