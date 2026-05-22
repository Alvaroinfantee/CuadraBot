import Link from "next/link"
import { CheckCircle2Icon } from "lucide-react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { StatusBadge } from "@/components/site/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formatDeliveryRange, formatMoney } from "@/lib/format"
import { hasSupabaseServerEnv } from "@/lib/config"
import { localePath, type Locale } from "@/lib/i18n"
import { isTakeoffOrderNotes } from "@/lib/takeoff-quote"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Order confirmed",
}

export const dynamic = "force-dynamic"

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  return <OrderSuccessContent locale="en" searchParams={searchParams} />
}

export async function OrderSuccessContent({
  searchParams,
  locale,
}: {
  searchParams: Promise<{ session_id?: string }>
  locale: Locale
}) {
  const { session_id } = await searchParams
  const order = session_id && hasSupabaseServerEnv() ? await getOrder(session_id) : null
  const packagePlan = Array.isArray(order?.packages) ? order?.packages[0] : order?.packages
  const isTakeoff = isTakeoffOrderNotes(order?.customer_notes)
  const copy =
    locale === "es"
      ? {
          title: isTakeoff ? "Tu takeoff esta en cola" : "Tu proyecto está en cola",
          body: isTakeoff
            ? "Hemos recibido tu PDF y el pago. Tu takeoff ya esta en cola de produccion."
            : "Hemos recibido tus archivos de planos y el pago. Tu proyecto ya está en cola para renderizado.",
          processing:
            "La confirmación de Stripe se está procesando. Usa el enlace de estado de tu email de confirmación cuando el webhook termine.",
          orderNumber: "Número de pedido",
          status: "Estado",
          customerEmail: "Email del cliente",
          quote: "Cotizacion",
          delivery: "Entrega estimada",
          statusLink: "Ver estado del pedido",
          quoteFallback: "Precio cotizado",
          deliveryFallback: "Estimacion de entrega",
        }
      : {
          title: isTakeoff ? "Your takeoff is queued" : "Your project is queued",
          body: isTakeoff
            ? "We received your PDF and payment. Your takeoff is now queued for production."
            : "We received your blueprint files and payment. Your project is now queued for rendering.",
          processing:
            "Stripe confirmation is being processed. Use the order status link from your confirmation email once the webhook completes.",
          orderNumber: "Order number",
          status: "Status",
          customerEmail: "Customer email",
          quote: "Quote",
          delivery: "Estimated delivery",
          statusLink: "View order status",
          quoteFallback: "Quoted price",
          deliveryFallback: "Delivery estimate",
        }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-start gap-4">
          <CheckCircle2Icon className="mt-1 text-primary" />
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-semibold tracking-normal">{copy.title}</h1>
            <p className="text-lg leading-8 text-muted-foreground">
              {copy.body}
            </p>
          </div>
        </div>
        {order ? (
          <div className="grid gap-4 border p-6 text-sm sm:grid-cols-2">
            <Info label={copy.orderNumber} value={order.order_number} />
            <Info label={copy.status} value={<StatusBadge status={order.status} locale={locale} />} />
            <Info label={copy.customerEmail} value={order.customer_email} />
            <Info
              label={copy.quote}
              value={
                order.amount_cents && order.currency
                  ? formatMoney(order.amount_cents, order.currency)
                  : copy.quoteFallback
              }
            />
            <Info
              label={copy.delivery}
              value={
                isTakeoff
                  ? locale === "es"
                    ? "Maximo 7 dias"
                    : "7 days max"
                  : packagePlan
                  ? formatDeliveryRange(
                      packagePlan.estimated_delivery_days_min,
                      packagePlan.estimated_delivery_days_max,
                      locale
                    )
                  : copy.deliveryFallback
              }
            />
          </div>
        ) : (
          <div className="border p-6 text-sm leading-6 text-muted-foreground">
            {copy.processing}
          </div>
        )}
        {order ? (
          <Link
            href={localePath(locale, `/orders/${order.public_token}`)}
            className={cn(buttonVariants({ size: "lg" }), "h-12 w-fit px-6")}
          >
            {copy.statusLink}
          </Link>
        ) : null}
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}

async function getOrder(sessionId: string) {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from("orders")
    .select("*, packages(*)")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle()

  return data
}

function Info({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
