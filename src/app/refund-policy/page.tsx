import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { type Locale } from "@/lib/i18n"

export const metadata = {
  title: "Refund Policy",
}

export default function RefundPolicyPage() {
  return <RefundPolicyContent locale="en" />
}

export function RefundPolicyContent({ locale }: { locale: Locale }) {
  const content =
    locale === "es"
      ? {
          title: "Política de Reembolso",
          paragraphs: [
            "El trabajo de renderizado comienza después de que Stripe confirma el pago y el pedido entra en la cola de procesamiento pagada.",
            "La elegibilidad de reembolso depende del estado del proyecto y del trabajo ya realizado. Los pedidos no iniciados pueden ser elegibles para revisión de cancelación o reembolso.",
            "Los servicios de renderizado completados generalmente no son reembolsables, pero Cuadrabot puede ofrecer las revisiones incluidas en el paquete cuando corresponda.",
            "Las ventanas de entrega son estimaciones, no garantías. Si un proyecto no puede procesarse porque los archivos enviados no son utilizables, Cuadrabot contactará al cliente para definir los siguientes pasos.",
          ],
        }
      : {
          title: "Refund Policy",
          paragraphs: [
            "Rendering work begins after Stripe confirms payment and the order enters the paid processing queue.",
            "Refund eligibility depends on project status and work already performed. Orders not yet started may be eligible for cancellation or refund review.",
            "Completed rendering services are generally non-refundable, but Cuadrabot may provide package-included revisions when applicable.",
            "Delivery windows are estimates, not guarantees. If a project becomes impossible to process because submitted files are unusable, Cuadrabot will contact the customer for next steps.",
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
