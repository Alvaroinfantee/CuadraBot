import { OrderFlow } from "@/components/order/order-flow"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { getActivePackages } from "@/lib/packages"
import { commonCopy, type Locale } from "@/lib/i18n"

export const metadata = {
  title: "Start your render",
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string; cancelled?: string }>
}) {
  return <OrderContent locale="en" searchParams={searchParams} />
}

export async function OrderContent({
  searchParams,
  locale,
}: {
  searchParams: Promise<{ package?: string; cancelled?: string }>
  locale: Locale
}) {
  const params = await searchParams
  const packages = await getActivePackages()
  const common = commonCopy[locale]
  const copy =
    locale === "es"
      ? {
          title: "Inicia tu render",
          body: "Elige un paquete, describe el proyecto, sube archivos y continúa a Stripe Checkout.",
          cancelled:
            "El checkout fue cancelado. Tus archivos no entran en cola hasta que se confirme el pago.",
        }
      : {
          title: "Start your render",
          body: "Choose a package, describe the project, upload files, and continue to Stripe Checkout.",
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
        <OrderFlow packages={packages} initialPackageSlug={params.package} locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
