import { redirect } from "next/navigation"
import { OrderFlow } from "@/components/order/order-flow"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { getActivePackages } from "@/lib/packages"
import { commonCopy, localePath, type Locale } from "@/lib/i18n"
import { parseProjectQuoteInput } from "@/lib/project-quote"

type OrderSearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata = {
  title: "Start your render",
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: OrderSearchParams
}) {
  return <OrderContent locale="en" searchParams={searchParams} />
}

export async function OrderContent({
  searchParams,
  locale,
}: {
  searchParams: OrderSearchParams
  locale: Locale
}) {
  const params = await searchParams
  const quoteInput = parseProjectQuoteInput(params)

  if (!quoteInput) {
    redirect(localePath(locale, "/pricing"))
  }

  const packages = await getActivePackages()
  const common = commonCopy[locale]
  const copy =
    locale === "es"
      ? {
          title: "Inicia tu render",
          body: "Revisa tu cotizacion, describe el proyecto, sube archivos y continua a Stripe Checkout.",
          cancelled:
            "El checkout fue cancelado. Tus archivos no entran en cola hasta que se confirme el pago.",
        }
      : {
          title: "Start your render",
          body: "Review your quote, describe the project, upload files, and continue to Stripe Checkout.",
          cancelled:
            "Checkout was cancelled. Your files are not queued until payment is confirmed.",
        }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-semibold tracking-normal">{copy.title}</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            {copy.body}
          </p>
          <p className="text-sm font-semibold text-primary">
            {common.ready72}
          </p>
          {params.cancelled ? (
            <p className="text-sm font-medium text-muted-foreground">
              {copy.cancelled}
            </p>
          ) : null}
        </div>
        <OrderFlow packages={packages} quoteInput={quoteInput} locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
