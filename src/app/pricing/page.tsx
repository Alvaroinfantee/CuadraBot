import { ArrowRightIcon } from "lucide-react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { TakeoffQuoteOrder } from "@/components/site/takeoff-quote-order"
import { buttonVariants } from "@/components/ui/button"
import { type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Takeoff quote",
}

export default function PricingPage() {
  return <PricingContent locale="en" />
}

export function PricingContent({ locale }: { locale: Locale }) {
  const copy =
    locale === "es"
      ? {
          title: "Cotiza tu takeoff desde planos PDF.",
          body: "Sube planos PDF con escala, calcula el precio por pagina detectada y elige USD o EUR.",
          helper:
            "Por ahora Cuadrabot solo acepta pedidos publicos de takeoff.",
          action: "Cotizar takeoff",
          serviceTitle: "Takeoff PDF",
          serviceBody:
            "Sube uno o mas PDFs, revisa la cotizacion instantanea y continua al pago seguro.",
        }
      : {
          title: "Quote your takeoff from PDF plans.",
          body: "Upload scaled PDF plans, calculate pricing by detected page count, and choose USD or EUR.",
          helper:
            "Cuadrabot is only accepting public takeoff orders right now.",
          action: "Quote takeoff",
          serviceTitle: "PDF takeoff",
          serviceBody:
            "Upload one or more PDFs, review the instant quote, and continue to secure payment.",
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
            <div>
              <a
                href="#project-quote"
                className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
              >
                {copy.action}
                <ArrowRightIcon data-icon="inline-end" />
              </a>
            </div>
          </div>
        </section>

        <section id="project-quote" className="scroll-mt-24 py-16">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-semibold tracking-normal">
                {copy.serviceTitle}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {copy.serviceBody}
              </p>
            </div>
            <TakeoffQuoteOrder locale={locale} />
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
