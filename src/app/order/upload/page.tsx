import { redirect } from "next/navigation"
import { OrderFlow } from "@/components/order/order-flow"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { getActivePackages } from "@/lib/packages"
import { localePath, type Locale } from "@/lib/i18n"
import { parseProjectQuoteInput } from "@/lib/project-quote"

type UploadSearchParams = Promise<Record<string, string | string[] | undefined>>

export const metadata = {
  title: "Upload files",
}

export default async function OrderUploadPage({
  searchParams,
}: {
  searchParams: UploadSearchParams
}) {
  return <OrderUploadContent locale="en" searchParams={searchParams} />
}

export async function OrderUploadContent({
  searchParams,
  locale,
}: {
  searchParams: UploadSearchParams
  locale: Locale
}) {
  const params = await searchParams
  const quoteInput = parseProjectQuoteInput(params)

  if (!quoteInput) {
    redirect(localePath(locale, "/pricing"))
  }

  const packages = await getActivePackages()
  const copy =
    locale === "es"
      ? {
          title: "Sube tus planos",
          body: "Agrega PDF, imagenes, DWG, DXF o ZIP despues de revisar la cotizacion por proyecto.",
        }
      : {
          title: "Upload blueprints",
          body: "Add PDFs, images, DWG, DXF, or ZIP files after reviewing the project quote.",
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
        </div>
        <OrderFlow packages={packages} quoteInput={quoteInput} focusUpload locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
