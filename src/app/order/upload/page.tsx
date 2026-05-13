import { OrderFlow } from "@/components/order/order-flow"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { getActivePackages } from "@/lib/packages"
import { type Locale } from "@/lib/i18n"

export const metadata = {
  title: "Upload files",
}

export default async function OrderUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>
}) {
  return <OrderUploadContent locale="en" searchParams={searchParams} />
}

export async function OrderUploadContent({
  searchParams,
  locale,
}: {
  searchParams: Promise<{ package?: string }>
  locale: Locale
}) {
  const params = await searchParams
  const packages = await getActivePackages()
  const copy =
    locale === "es"
      ? {
          title: "Sube tus planos",
          body: "Añade PDF, imágenes, DWG, DXF o ZIP después de describir el alcance del render.",
        }
      : {
          title: "Upload blueprints",
          body: "Add PDFs, images, DWG, DXF, or ZIP files after describing the rendering scope.",
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
        <OrderFlow packages={packages} initialPackageSlug={params.package} focusUpload locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
