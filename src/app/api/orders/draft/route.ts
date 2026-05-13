import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createOrderNumber, createPublicToken } from "@/lib/orders"
import { orderDetailsSchema } from "@/lib/schemas"
import { jsonError } from "@/lib/http"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = orderDetailsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order details.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const supabase = createSupabaseAdminClient()
  const { data: packagePlan, error: packageError } = await supabase
    .from("packages")
    .select("*")
    .eq("slug", parsed.data.package_slug)
    .eq("active", true)
    .maybeSingle()

  if (packageError) {
    return jsonError(packageError.message, 500)
  }

  if (!packagePlan) {
    return jsonError("Selected package is not available.", 400)
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      public_token: createPublicToken(),
      order_number: createOrderNumber(),
      customer_name: parsed.data.customer_name,
      customer_email: parsed.data.customer_email.toLowerCase(),
      package_id: packagePlan.id,
      status: "draft",
      render_type: parsed.data.render_type,
      project_type: parsed.data.project_type,
      style_preference: parsed.data.style_preference,
      number_of_floors: parsed.data.number_of_floors ?? null,
      estimated_square_meters: parsed.data.estimated_square_meters ?? null,
      customer_notes: parsed.data.customer_notes ?? null,
      deadline_preference: parsed.data.deadline_preference ?? null,
      amount_cents: packagePlan.price_cents,
      currency: packagePlan.currency,
    })
    .select("id,public_token,order_number")
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ order })
}
