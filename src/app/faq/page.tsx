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
          ["Que archivos puedo subir?", "Por ahora los pedidos publicos de takeoff aceptan planos en PDF."],
          ["Los planos necesitan escala?", "Si. Para medir correctamente, el PDF debe incluir escala clara o cotas suficientes."],
          ["Cuanto tarda?", "La entrega del takeoff es de 7 dias maximo despues del pago y de recibir planos utilizables."],
          ["Que incluye el takeoff?", "Puedes indicar en notas las partidas, cantidades, materiales, areas o prioridades que necesitas medir."],
          ["Mis archivos son privados?", "Si. Los archivos se guardan en buckets privados de Supabase Storage y el acceso usa URLs firmadas."],
          ["Trabajan con contratistas y arquitectos?", "Si. Cuadrabot esta pensado para contratistas, promotores, arquitectos y equipos inmobiliarios."],
          ["Entregan documentos de construccion?", "No. Cuadrabot ofrece apoyo de quantity takeoff y no sustituye servicios profesionales de arquitectura, ingenieria, permisos, estimacion ni documentacion de construccion."],
          ["Que ocurre despues de pagar?", "Stripe confirma el pago con un webhook, tu pedido pasa a pendiente de procesamiento y el equipo prepara el takeoff final."],
        ]
      : [
          ["What files can I upload?", "Public takeoff orders currently accept blueprint PDFs only."],
          ["Do the plans need scale?", "Yes. To measure correctly, the PDF must include a clear scale or enough dimensions."],
          ["How long does it take?", "Takeoff delivery is 7 days max after payment and usable plan files are received."],
          ["What does the takeoff include?", "Use the notes field to specify the quantities, materials, areas, or priorities you need measured."],
          ["Are my files private?", "Yes. Files are stored in private Supabase Storage buckets and accessed through signed URLs."],
          ["Do you work with contractors and architects?", "Yes. Cuadrabot is designed for contractors, developers, architects, and property teams."],
          ["Do you provide construction documents?", "No. Cuadrabot provides quantity takeoff support and does not replace licensed architectural, engineering, permitting, estimating, or construction documentation services."],
          ["What happens after I pay?", "Stripe confirms payment through a webhook, your order becomes paid pending processing, and the team prepares the final takeoff."],
        ]

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale={locale} />
      <main className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-semibold tracking-normal">{common.faq}</h1>
          <p className="text-lg leading-8 text-muted-foreground">
            {locale === "es"
              ? "Respuestas claras para el flujo de takeoff desde PDF."
              : "Clear answers for the PDF takeoff workflow."}
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
