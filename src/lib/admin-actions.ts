"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { adminStatusSchema } from "@/lib/schemas"
import { blenderOutputBucket } from "@/lib/config"
import { orderCompletedEmail, sendTransactionalEmail } from "@/lib/email"
import { orderStatusUrl } from "@/lib/orders"
import { sanitizeFilename } from "@/lib/http"

export type LoginState = {
  error?: string
}

export async function loginAdmin(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Enter email and password." }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { error: "Invalid login." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle()

  if (profile?.role !== "admin") {
    await supabase.auth.signOut()
    return { error: "This account is not an admin." }
  }

  redirect("/admin/orders")
}

export async function logoutAdmin() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/admin/login")
}

export async function updateOrderAdminAction(formData: FormData) {
  await requireAdmin()
  const orderId = String(formData.get("order_id") ?? "")
  const parsed = adminStatusSchema.safeParse({
    status: formData.get("status"),
    internal_notes: formData.get("internal_notes"),
  })

  if (!orderId || !parsed.success) {
    throw new Error("Invalid order update.")
  }

  const supabase = createSupabaseAdminClient()
  const updates: Record<string, unknown> = {
    status: parsed.data.status,
    internal_notes: parsed.data.internal_notes ?? null,
  }

  if (parsed.data.status === "completed") {
    updates.completed_at = new Date().toISOString()
  }

  const { error } = await supabase.from("orders").update(updates).eq("id", orderId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin/orders")
}

export async function uploadAdminFinalFilesAction(formData: FormData) {
  await requireAdmin()
  const orderId = String(formData.get("order_id") ?? "")
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0)

  if (!orderId || !files.length) {
    throw new Error("Choose at least one file.")
  }

  const supabase = createSupabaseAdminClient()
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number")
    .eq("id", orderId)
    .single()

  if (orderError) {
    throw new Error(orderError.message)
  }

  for (const file of files) {
    const filename = sanitizeFilename(file.name)
    const storagePath = `orders/${order.order_number}/final/${crypto.randomUUID()}-${filename}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from(blenderOutputBucket)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { error: insertError } = await supabase.from("order_files").insert({
      order_id: orderId,
      bucket: blenderOutputBucket,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      file_role: "final_render",
    })

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  await supabase
    .from("orders")
    .update({ status: "needs_review" })
    .eq("id", orderId)
    .neq("status", "completed")

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin/orders")
}

export async function sendCompletionEmailAction(formData: FormData) {
  await requireAdmin()
  const orderId = String(formData.get("order_id") ?? "")
  const supabase = createSupabaseAdminClient()
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const { count, error: finalFilesError } = await supabase
    .from("order_files")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id)
    .eq("file_role", "final_render")

  if (finalFilesError) {
    throw new Error(finalFilesError.message)
  }

  if (!count) {
    throw new Error("Upload at least one final render before emailing the customer.")
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "completed",
      completed_at: order.completed_at ?? new Date().toISOString(),
    })
    .eq("id", order.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const email = orderCompletedEmail({
    orderNumber: order.order_number,
    statusUrl: orderStatusUrl(order.public_token),
  })
  const result = await sendTransactionalEmail({
    to: order.customer_email,
    ...email,
  })

  await supabase.from("email_events").insert({
    order_id: order.id,
    email_type: "order_completed",
    recipient: order.customer_email,
    provider_message_id: result.providerMessageId,
    status: result.status,
  })

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin/orders")
}

export async function updatePackageAction(formData: FormData) {
  await requireAdmin()
  const packageId = String(formData.get("package_id") ?? "")
  const price = Number(formData.get("price_cents"))
  const sortOrder = Number(formData.get("sort_order"))

  if (!packageId || Number.isNaN(price)) {
    throw new Error("Invalid package update.")
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("packages")
    .update({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      price_cents: price,
      currency: String(formData.get("currency") ?? "usd").toLowerCase(),
      stripe_price_id: String(formData.get("stripe_price_id") ?? "") || null,
      active: formData.get("active") === "on",
      sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder,
    })
    .eq("id", packageId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin/packages")
  revalidatePath("/pricing")
  revalidatePath("/")
}
