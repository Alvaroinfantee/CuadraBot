import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { type Locale } from "@/lib/i18n"

export const metadata = {
  title: "Terms",
}

export default function TermsPage() {
  return <TermsContent locale="en" />
}

export function TermsContent({ locale }: { locale: Locale }) {
  const content =
    locale === "es"
      ? {
          title: "Terminos",
          paragraphs: [
            "Cuadrabot presta servicios de quantity takeoff basados en planos PDF e instrucciones subidas por el cliente.",
            "Cuadrabot no presta servicios licenciados de arquitectura, ingenieria, permisos, documentacion de construccion, cumplimiento normativo, topografia ni estimacion profesional certificada.",
            "Los clientes son responsables de asegurarse de que tienen derecho a subir los planos y materiales de referencia enviados.",
            "Los tiempos de entrega son estimaciones. Archivos complejos, dibujos poco claros, falta de escala o retrasos del cliente pueden afectar los plazos.",
          ],
        }
      : {
          title: "Terms",
          paragraphs: [
            "Cuadrabot provides quantity takeoff services based on customer-uploaded PDF plans and project instructions.",
            "Cuadrabot does not provide licensed architectural, engineering, permitting, construction documentation, code-compliance, surveying, or certified professional estimating services.",
            "Customers are responsible for ensuring they have the rights to upload submitted plans and reference materials.",
            "Delivery times are estimates. Complex files, unclear drawings, missing scale, or customer delays can affect timing.",
          ],
        }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-16 text-base leading-8 text-muted-foreground sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-normal text-foreground">{content.title}</h1>
        {content.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
