import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/faq",
  title: "Preguntas frecuentes",
  description:
    "Respuestas sobre el alcance, los precios, los créditos, la precisión, la privacidad y el soporte de Cuadrabot.",
})

const sections = [
  {
    title: "Servicio y alcance",
    questions: [
      [
        "¿Qué mide Cuadrabot?",
        "La versión inicial autoservicio cubre suelos y acabados, tabiquería/placas de yeso/techos y puertas/ventanas/huecos. En esta versión no se aceptan archivos de especialidades no incluidas.",
      ],
      [
        "¿Qué archivos de planos aceptáis?",
        "El flujo autoservicio admite un PDF a escala, sin protección por contraseña, de hasta 100 MB y 250 páginas. Los conjuntos de más de 25 páginas usan el nivel fijo Proyecto grande.",
      ],
      [
        "¿Es una oferta final?",
        "No. Cuadrabot ofrece apoyo para mediciones y evidencias revisables vinculadas a la fuente. Tu equipo de estimación sigue siendo responsable de interpretar el contrato, el desperdicio, los precios, la mano de obra, las alternativas, las decisiones de oferta y la verificación final.",
      ],
      [
        "¿Qué se incluye en la entrega?",
        "Un PDF de origen marcado, un libro de cantidades en Excel, evidencias estructuradas vinculadas a la fuente, metodología y supuestos, y una solicitud de corrección dentro del alcance.",
      ],
    ],
  },
  {
    title: "Precios y créditos",
    questions: [
      [
        "¿Cómo se calcula el precio?",
        "El servidor verifica el PDF realmente cargado y su número de páginas y, después, aplica los niveles de alcance publicados. Nunca se confía en recuentos de páginas, precios ni importes de créditos enviados por el navegador.",
      ],
      [
        "¿Necesito una suscripción?",
        "No. Puedes comprar un paquete de créditos reutilizable, suscribirte para recibir créditos mensuales o empezar con una hoja gratis. No hay licencias por usuario ni planes ilimitados.",
      ],
      [
        "¿Cuándo se cobran los créditos?",
        "Los créditos se reservan cuando apruebas el precio verificado y se liquidan después de la entrega. Un fallo del sistema libera la reserva.",
      ],
      [
        "¿Caducan los créditos?",
        "Los créditos no caducan durante la versión de lanzamiento. Si más adelante se introduce una política de caducidad, se aplicará de forma prospectiva y se mostrará antes de la compra.",
      ],
    ],
  },
  {
    title: "Precisión, privacidad y soporte",
    questions: [
      [
        "¿El flujo es autoservicio?",
        "Sí. La carga, la confirmación del precio, la medición, la validación, la liquidación de créditos y la entrega están automatizadas. Las herramientas administrativas se limitan al soporte de cuentas, las solicitudes de corrección y las excepciones operativas.",
      ],
      [
        "¿Cómo compruebo una cantidad?",
        "Cada unidad admitida incluye un identificador estable, página, contexto de plano o zona, método, nivel de confianza y coordenadas visibles o recuadro delimitador. El PDF marcado y el libro conservan esa trazabilidad.",
      ],
      [
        "¿Se usan los planos para entrenar modelos?",
        "Cuadrabot no lo hace sin tu consentimiento explícito. Los planos solo se procesan para prestar el servicio. Los originales verificados se conservan en un archivo privado respaldado por checksum y los archivos generados siguen los controles de conservación publicados.",
      ],
      [
        "¿Durante cuánto tiempo se conserva mi plano original?",
        "Un original verificado permanece en tu archivo privado mientras la cuenta esté activa para que puedas recuperarlo como historial del proyecto, ante una incidencia, para soporte o en una disputa. Puedes solicitar su eliminación, sujeta a verificación de identidad y a cualquier retención legal. Las cargas no verificadas se eliminan después de 24 horas.",
      ],
      [
        "¿El almacenamiento del archivo de fuentes es ilimitado?",
        "No. Sin una suscripción vigente que cumpla los requisitos o una compra de paquete de créditos completada y no reembolsada, una cuenta puede conservar hasta 25 planos verificados o 512 MiB. Las cuentas con capacidad de pago válida pueden conservar hasta 500 planos o 20 GiB. Los planos existentes nunca se eliminan silenciosamente al alcanzar un límite; contacta con soporte para revisar la cuenta.",
      ],
      [
        "¿Qué cubre la corrección incluida?",
        "Una solicitud que permanezca dentro del alcance de especialidades aprobado y del conjunto de planos cargado originalmente. Las ampliaciones de alcance, nuevas revisiones o cambios de diseño requieren un nuevo precio.",
      ],
    ],
  },
] as const

export default function FaqPageEs() {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <PageHero
          eyebrow="Preguntas frecuentes"
          title="Respuestas claras antes de subir tus planos."
          body="Alcance, precios, evidencias, privacidad y aquello de lo que Cuadrabot se hace —y no se hace— responsable."
          primary="Probar un plano gratis"
          secondary="Ver precios"
          secondaryHref="/es/pricing"
          locale="es"
        />
        <section className="py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Centro de ayuda
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                ¿Necesitas una respuesta más concreta?
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Escribe a{" "}
                <a
                  href="mailto:support@cuadrabot.com"
                  className="font-medium text-primary"
                >
                  support@cuadrabot.com
                </a>{" "}
                indicando la especialidad, el número aproximado de páginas y la
                fecha límite. No adjuntes planos confidenciales al correo.
              </p>
            </div>
            <div className="space-y-10">
              {sections.map((section) => (
                <div key={section.title}>
                  <h3 className="border-b pb-3 text-lg font-semibold">
                    {section.title}
                  </h3>
                  <Accordion>
                    {section.questions.map(([question, answer]) => (
                      <AccordionItem key={question} value={question}>
                        <AccordionTrigger>{question}</AccordionTrigger>
                        <AccordionContent>
                          <p className="leading-6 text-muted-foreground">
                            {answer}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </div>
        </section>
        <CtaBand locale="es" />
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}
