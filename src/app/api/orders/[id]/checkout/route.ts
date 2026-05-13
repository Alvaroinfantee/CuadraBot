import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"
import { getSiteUrl } from "@/lib/config"
import { jsonError } from "@/lib/http"
import { isLocale, localePath, type Locale } from "@/lib/i18n"
import { getStripePriceIdForPackage } from "@/lib/packages"

type Context = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const orderToken = request.headers.get("x-order-token")
  const supabase = createSupabaseAdminClient()
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, packages(*)")
    .eq("id", id)
    .maybeSingle()

  if (orderError) {
    return jsonError(orderError.message, 500)
  }

  if (!order || order.public_token !== orderToken) {
    return jsonError("Order not found.", 404)
  }

  if (!["draft", "awaiting_payment"].includes(order.status)) {
    return jsonError("This order is not available for checkout.", 400)
  }

  const { count, error: fileCountError } = await supabase
    .from("order_files")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id)
    .eq("file_role", "customer_upload")

  if (fileCountError) {
    return jsonError(fileCountError.message, 500)
  }

  if (!count) {
    return jsonError("Upload at least one blueprint or reference file before checkout.", 400)
  }

  const packagePlan = Array.isArray(order.packages) ? order.packages[0] : order.packages
  const stripePriceId =
    packagePlan?.stripe_price_id ?? getStripePriceIdForPackage(packagePlan?.slug ?? "")

  if (!packagePlan || !stripePriceId) {
    return jsonError("Stripe price ID is not configured for this package.", 500)
  }

  const stripe = getStripe()
  const siteUrl = getSiteUrl()
  const requestLocale = request.headers.get("x-locale") ?? "en"
  const locale: Locale = isLocale(requestLocale) ? requestLocale : "en"
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    allow_promotion_codes: true,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    customer_email: order.customer_email,
    success_url: `${siteUrl}${localePath(locale, "/order/success")}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}${localePath(locale, `/order?package=${packagePlan.slug}&cancelled=1`)}`,
    metadata: {
      order_id: order.id,
      public_token: order.public_token,
      package_slug: packagePlan.slug,
    },
  })

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "awaiting_payment",
      stripe_checkout_session_id: session.id,
    })
    .eq("id", order.id)

  if (updateError) {
    return jsonError(updateError.message, 500)
  }

  return NextResponse.json({ url: session.url })
}
