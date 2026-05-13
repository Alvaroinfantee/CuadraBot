import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { commonCopy, type Locale } from "@/lib/i18n"

export const metadata = {
  title: "FAQ",
}

export default function FaqPage() {
  return <FaqContent locale="en" />
}

export function FaqContent({ locale }: { locale: Locale }) {
  const common = commonCopy[locale]
  const faqs =
    locale === "es"
      ? [
          ["¿Qué archivos puedo subir?", "Se aceptan PDF, PNG, JPG/JPEG, DWG, DXF y ZIP. DWG y DXF se almacenan para procesamiento, aunque pueden no previsualizarse en el navegador."],
          ["¿Necesito un plano arquitectónico terminado?", "No. Un plano terminado ayuda, pero bocetos, plantas, elevaciones y referencias son suficientes para iniciar el brief."],
          ["¿Cuánto tarda?", "Las estimaciones dependen del paquete. Los paquetes iniciales van de 2 a 5 días hábiles."],
          ["¿Puedo pedir revisiones?", "Sí. Las rondas de revisión dependen del paquete seleccionado en checkout."],
          ["¿Mis archivos son privados?", "Sí. Los archivos se guardan en buckets privados de Supabase Storage. El acceso usa URLs firmadas para admin, worker y estado del pedido."],
          ["¿Trabajan con propietarios?", "Sí. Cuadrabot está pensado para arquitectos, promotores, agentes inmobiliarios, propietarios y equipos de reforma."],
          ["¿Entregan documentos de construcción?", "No. Cuadrabot ofrece visualización/renderizado y no sustituye servicios de arquitectura, ingeniería, permisos ni documentación de construcción."],
          ["¿Qué ocurre después de pagar?", "Stripe confirma el pago con un webhook, tu pedido pasa a pendiente de procesamiento y el worker local lo toma desde la cola segura."],
        ]
      : [
          ["What files can I upload?", "PDF, PNG, JPG/JPEG, DWG, DXF, and ZIP files are accepted. DWG and DXF are stored for processing but may not preview in the browser."],
          ["Do I need a finished architectural plan?", "No. A finished plan helps, but sketches, floor plans, elevations, and reference files are enough to start a visualization brief."],
          ["How long does it take?", "Delivery estimates depend on the package. Initial packages range from 2 to 5 business days."],
          ["Can I request revisions?", "Yes. Revision rounds depend on the package selected at checkout."],
          ["Are my files private?", "Yes. Files are stored in private Supabase Storage buckets. Access uses signed URLs for authorized admin, worker, and order-status flows."],
          ["Do you work with homeowners?", "Yes. Cuadrabot is designed for architects, developers, realtors, homeowners, and renovation teams."],
          ["Do you provide construction documents?", "No. Cuadrabot provides visualization/rendering services and does not replace licensed architectural, engineering, permitting, or construction documentation."],
          ["What happens after I pay?", "Stripe confirms payment through a webhook, your order becomes paid pending processing, and the local rendering worker pulls it from the secure queue."],
        ]

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-semibold tracking-normal">{common.faq}</h1>
          <p className="text-lg leading-8 text-muted-foreground">
            {locale === "es"
              ? "Respuestas claras para el flujo de plano a render."
              : "Clear answers for the blueprint-to-render workflow."}
          </p>
        </div>
        <Accordion>
          {faqs.map(([question, answer]) => (
            <AccordionItem key={question} value={question}>
              <AccordionTrigger>{question}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
