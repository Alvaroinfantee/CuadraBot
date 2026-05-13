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
          title: "Términos",
          paragraphs: [
            "Cuadrabot presta servicios de visualización y renderizado basados en planos, bocetos, imágenes y notas de proyecto subidos por el cliente.",
            "Cuadrabot no presta servicios licenciados de arquitectura, ingeniería, permisos, documentación de construcción, cumplimiento normativo ni topografía. Los renders son para visualización y presentación.",
            "Los clientes son responsables de asegurarse de que tienen derecho a subir los planos y materiales de referencia enviados.",
            "Los tiempos de entrega son estimaciones. Archivos complejos, dibujos poco claros, solicitudes de revisión o retrasos del cliente pueden afectar los plazos.",
          ],
        }
      : {
          title: "Terms",
          paragraphs: [
            "Cuadrabot provides visualization and rendering services based on customer-uploaded plans, sketches, images, and project notes.",
            "Cuadrabot does not provide licensed architectural, engineering, permitting, construction documentation, code-compliance, or surveying services. Renderings are for visualization and presentation.",
            "Customers are responsible for ensuring they have the rights to upload submitted plans and reference materials.",
            "Delivery times are estimates. Complex files, unclear drawings, revision requests, or customer delays can affect timing.",
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
