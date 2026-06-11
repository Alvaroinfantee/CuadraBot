import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createOrderNumber, createPublicToken } from "@/lib/orders"
import { orderDetailsSchema } from "@/lib/schemas"
import { jsonError } from "@/lib/http"
import {
  calculateTakeoffQuote,
  formatTakeoffQuoteForNotes,
} from "@/lib/takeoff-quote"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = orderDetailsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order details.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  if (!parsed.data.takeoff_quote) {
    return jsonError("Rendering orders are temporarily unavailable. Public checkout is currently limited to takeoff services.", 403)
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

  const takeoffQuote = calculateTakeoffQuote(parsed.data.takeoff_quote)
  const customerNotes = [
    parsed.data.customer_notes,
    formatTakeoffQuoteForNotes(takeoffQuote),
  ]
    .filter(Boolean)
    .join("\n\n")

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      public_token: createPublicToken(),
      order_number: createOrderNumber(),
      customer_name: parsed.data.customer_name,
      customer_email: parsed.data.customer_email.toLowerCase(),
      package_id: packagePlan.id,
      status: "draft",
      render_type: "Takeoff",
      project_type: "Other",
      style_preference: "Other",
      number_of_floors: null,
      estimated_square_meters: null,
      customer_notes: customerNotes || null,
      deadline_preference: `Takeoff delivery within ${takeoffQuote.deliveryDaysMax} days`,
      amount_cents: takeoffQuote.totalCents,
      currency: takeoffQuote.currency,
    })
    .select("id,public_token,order_number")
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ order })
}
