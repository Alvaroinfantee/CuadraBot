import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { ProjectQuoteCalculator } from "@/components/site/project-quote-calculator"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buttonVariants } from "@/components/ui/button"
import { commonCopy, localePath, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Project quote",
}

export default function QuotePage() {
  return <QuoteContent locale="en" />
}

export function QuoteContent({ locale }: { locale: Locale }) {
  const common = commonCopy[locale]
  const copy =
    locale === "es"
      ? {
          title: "Cotiza por proyecto, no solo por paquete.",
          body: "Usa metraje, vistas, complejidad y urgencia para calcular un precio bajo pero normal para USA, Espana o Rep. Dom.",
          helper:
            "La cotizacion automatica sirve como punto de partida. Proyectos grandes o muy urgentes pasan a revision manual.",
          packages: "Ver paquetes fijos",
        }
      : {
          title: "Quote by project, not only by package.",
          body: "Use area, views, complexity, and urgency to calculate a low-but-normal price for the USA, Spain, or Dominican Republic.",
          helper:
            "The automatic quote is a starting point. Large or very urgent projects move to manual review.",
          packages: "View fixed packages",
        }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-normal">
              {copy.title}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
              {copy.body}
            </p>
            <p className="max-w-2xl text-sm font-semibold text-primary">
              {copy.helper}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={localePath(locale, "/order")}
                className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
              >
                {common.startRender}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
              <Link
                href={localePath(locale, "/pricing")}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-6")}
              >
                {copy.packages}
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <ProjectQuoteCalculator locale={locale} />
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
