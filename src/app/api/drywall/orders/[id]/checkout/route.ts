import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import type Stripe from "stripe"
import {
  drywallMaxSelectedPages,
  getRequiredEnv,
  getSiteUrl,
  ownerRequestEmail,
  stripeAutomaticTaxEnabled,
} from "@/lib/config"
import { escapeEmailHtml, sendDrywallEmail } from "@/lib/drywall-email"
import {
  drywallPath,
  drywallPortalUrlPath,
  normalizeDrywallLocale,
} from "@/lib/drywall-i18n"
import { verifyDrywallDraftToken } from "@/lib/drywall-portal"
import { drywallCheckoutSchema } from "@/lib/drywall-takeoff-schemas"
import { jsonError } from "@/lib/http"
import { consumeTakeoffRateLimit } from "@/lib/request-rate-limit"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"
import { getStripe, StripeConfigurationError } from "@/lib/stripe"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const bodyResult = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.drywallCheckoutJson
  )
  const parsed = drywallCheckoutSchema.safeParse(
    bodyResult.ok ? bodyResult.value : null
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisa el alcance y las condiciones.", issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const supabase = createSupabaseAdminClient()
  const { data: project, error: projectError } = await supabase
    .from("drywall_takeoff_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (
    projectError ||
    !project ||
    !verifyDrywallDraftToken(project.draft_token_hash, parsed.data.accessToken)
  ) {
    return jsonError("No se encontró el pedido.", 404)
  }
  if (!["awaiting_payment", "custom_review"].includes(project.status)) {
    return jsonError("Los planos deben verificarse antes del pago.", 409)
  }

  try {
    const limit = await consumeTakeoffRateLimit({
      supabase,
      request,
      userId: id,
      action: "checkout_drywall_order",
    })
    if (!limit.allowed) {
      const response = jsonError(
        "Demasiados intentos de pago. Inténtalo de nuevo más tarde.",
        429
      )
      response.headers.set("Retry-After", String(limit.retryAfterSeconds))
      return response
    }
  } catch {
    return jsonError("La protección del checkout no está disponible.", 503)
  }

  const [{ data: customer }, { data: files, error: fileError }] =
    await Promise.all([
      supabase
        .from("drywall_takeoff_customers")
        .select("id,email,company")
        .eq("id", project.customer_id)
        .maybeSingle(),
      supabase
        .from("drywall_takeoff_files")
        .select("id,page_count,upload_status")
        .eq("project_id", id),
    ])
  if (!customer || fileError || !files?.length) {
    return jsonError("El pedido no está completo.", 409)
  }
  if (files.some((file) => file.upload_status !== "verified")) {
    return jsonError("Todos los PDF deben estar verificados antes del pago.", 409)
  }

  const filePages = new Map(
    files.map((file) => [file.id, Number(file.page_count)])
  )
  const selectedKeys = new Set<string>()
  for (const selection of parsed.data.selectedPages) {
    const pageCount = filePages.get(selection.fileId)
    if (!pageCount) return jsonError("La selección contiene un archivo ajeno.", 422)
    for (const page of selection.pageNumbers) {
      if (page > pageCount) {
        return jsonError("La selección contiene una página inexistente.", 422)
      }
      selectedKeys.add(`${selection.fileId}:${page}`)
    }
  }
  const selectedCount = selectedKeys.size
  if (selectedCount < 1) return jsonError("Selecciona al menos una hoja.", 422)

  const exceptional = ["hospital", "aeropuerto", "industrial_complejo"].includes(
    project.project_type
  )
  const customReview =
    exceptional || selectedCount > drywallMaxSelectedPages
  const selectedPages = parsed.data.selectedPages.map((selection) => ({
    file_id: selection.fileId,
    page_numbers: [...new Set(selection.pageNumbers)].sort((a, b) => a - b),
  }))
  const customerLocale = normalizeDrywallLocale(parsed.data.locale)
  const { error: projectUpdateError } = await supabase
    .from("drywall_takeoff_projects")
    .update({
      scope_answers: parsed.data.scope,
      selected_pages: selectedPages,
      selected_sheet_count: selectedCount,
      locale: customerLocale,
      status: customReview ? "custom_review" : "awaiting_payment",
    })
    .eq("id", id)
  if (projectUpdateError) return jsonError("No se pudo guardar el alcance.", 503)

  if (customReview) {
    await Promise.allSettled([
      supabase.from("drywall_takeoff_events").insert({
        project_id: id,
        event_name: "custom_review_requested",
        actor: "customer",
        metadata: { selected_sheet_count: selectedCount, exceptional },
      }),
      sendDrywallEmail({
        to: ownerRequestEmail,
        subject: `Revisión personalizada: ${project.project_name}`,
        html: `<p>Nuevo proyecto fuera del alcance fijo.</p><p><strong>${escapeEmailHtml(project.project_name)}</strong><br>${escapeEmailHtml(customer.email)}<br>${selectedCount} hojas seleccionadas.</p>`,
      }),
    ])
    return NextResponse.json({ customReview: true })
  }

  try {
    const stripe = getStripe()
    const priceId = getRequiredEnv("STRIPE_PRICE_DRYWALL_TAKEOFF")
    const price = await stripe.prices.retrieve(priceId)
    assertDrywallPrice(price)

    let { data: order } = await supabase
      .from("drywall_takeoff_orders")
      .select("*")
      .eq("project_id", id)
      .maybeSingle()

    if (order?.payment_status === "paid") {
      return NextResponse.json({
        paid: true,
        url: `${getSiteUrl()}${drywallPortalUrlPath(id, customerLocale)}`,
      })
    }
    let checkoutAttempt = "initial"
    if (order?.stripe_checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        order.stripe_checkout_session_id
      )
      if (existing.status === "open" && existing.url) {
        return NextResponse.json({ url: existing.url })
      }
      checkoutAttempt = existing.id
    }

    if (!order) {
      const orderNumber = createOrderNumber()
      const { data: created, error: orderError } = await supabase
        .from("drywall_takeoff_orders")
        .insert({ project_id: id, order_number: orderNumber })
        .select("*")
        .single()
      if (orderError || !created) throw new Error("Could not create the order.")
      order = created
    }

    const stripeCustomerId =
      order.stripe_customer_id ||
      (
        await stripe.customers.create({
          email: customer.email,
          name: customer.company || undefined,
          metadata: { drywall_project_id: id, drywall_order_id: order.id },
        })
      ).id
    const metadata: Stripe.MetadataParam = {
      schema_version: "1",
      flow: "drywall_takeoff",
      drywall_project_id: id,
      drywall_order_id: order.id,
      order_number: order.order_number,
      measurement_policy: "PLADUR-ES-1.0",
      customer_locale: customerLocale,
    }
    const integrationIdentifier = `cuadrabot_drywall_${randomLetters(8)}`
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        locale: customerLocale,
        customer: stripeCustomerId,
        customer_update: { address: "auto", name: "auto" },
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        automatic_tax: { enabled: stripeAutomaticTaxEnabled },
        invoice_creation: {
          enabled: true,
          invoice_data: { metadata },
        },
        client_reference_id: order.id,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata,
        payment_intent_data: {
          metadata,
          receipt_email: customer.email,
        },
        success_url: `${getSiteUrl()}${drywallPortalUrlPath(id, customerLocale)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${getSiteUrl()}${drywallPath(customerLocale, "order")}?order=${id}&checkout=cancelled`,
        integration_identifier: integrationIdentifier,
      },
      { idempotencyKey: `drywall-checkout-${order.id}-${checkoutAttempt}` }
    )
    if (!session.url) throw new Error("Stripe did not return a Checkout URL.")

    const { error: updateError } = await supabase
      .from("drywall_takeoff_orders")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id: stripeCustomerId,
        payment_status: "checkout_created",
      })
      .eq("id", order.id)
    if (updateError) throw new Error(updateError.message)

    await supabase.from("drywall_takeoff_events").insert({
      project_id: id,
      event_name: "checkout_created",
      actor: "customer",
      metadata: { stripe_checkout_session_id: session.id },
    })

    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    if (error instanceof StripeConfigurationError) {
      return jsonError("El pago aún no está configurado.", 503)
    }
    console.error("Drywall Checkout creation failed.", {
      projectId: id,
      error: error instanceof Error ? error.message : "unknown",
    })
    return jsonError("No se pudo abrir el pago seguro.", 503)
  }
}

function assertDrywallPrice(price: Stripe.Price) {
  if (
    !price.active ||
    price.type !== "one_time" ||
    price.currency.toLowerCase() !== "eur" ||
    price.unit_amount !== 14900 ||
    price.tax_behavior !== "exclusive"
  ) {
    throw new Error(
      "STRIPE_PRICE_DRYWALL_TAKEOFF must be an active one-time 149 EUR price with exclusive tax behavior."
    )
  }
}

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "")
  return `CB-${date}-${randomBytes(4).toString("hex").toUpperCase()}`
}

function randomLetters(length: number) {
  return Array.from(randomBytes(length), (byte) =>
    String.fromCharCode(97 + (byte % 26))
  ).join("")
}
