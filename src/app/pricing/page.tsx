import { ArrowRightIcon } from "lucide-react"
import { ProjectQuoteCalculator } from "@/components/site/project-quote-calculator"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { TakeoffQuoteOrder } from "@/components/site/takeoff-quote-order"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { commonCopy, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Project quote",
}

export default function PricingPage() {
  return <PricingContent locale="en" />
}

export function PricingContent({ locale }: { locale: Locale }) {
  const common = commonCopy[locale]
  const copy =
    locale === "es"
      ? {
          title: "Cotiza tu render por proyecto.",
          body: "Calcula un precio global por metraje, vistas, complejidad y urgencia, y elige USD o EUR.",
          helper:
            "Ajusta el alcance y continua al pedido con el precio calculado.",
          action: "Calcular precio",
          serviceTitle: "Elige servicio",
          serviceBody:
            "Cotiza renders o takeoffs desde el mismo flujo de subida y pago.",
          renderTab: "Renders",
          takeoffTab: "Takeoff",
        }
      : {
          title: "Quote your render by project.",
          body: "Calculate one global price from area, views, complexity, and urgency, then choose USD or EUR.",
          helper:
            "Adjust the scope and continue to checkout with the calculated price.",
          action: "Calculate price",
          serviceTitle: "Choose service",
          serviceBody:
            "Quote renders or takeoffs from the same upload-and-payment flow.",
          renderTab: "Renders",
          takeoffTab: "Takeoff",
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
            <Tabs defaultValue="render" className="gap-6">
              <TabsList className="h-10 w-fit">
                <TabsTrigger value="render" className="px-4">
                  {copy.renderTab}
                </TabsTrigger>
                <TabsTrigger value="takeoff" className="px-4">
                  {copy.takeoffTab}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="render">
                <div className="mb-4 text-sm font-semibold text-primary">
                  {common.ready72}
                </div>
                <ProjectQuoteCalculator locale={locale} />
              </TabsContent>
              <TabsContent value="takeoff">
                <TakeoffQuoteOrder locale={locale} />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
