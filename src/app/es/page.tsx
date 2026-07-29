import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  DownloadIcon,
  FileSearchIcon,
  FileSpreadsheetIcon,
  FileUpIcon,
  Layers3Icon,
  LockKeyholeIcon,
  RulerIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import {
  buildLocalizedMetadata,
  localizedAuthPath,
  localizedPublicPath,
  localizeTakeoffPrice,
  type PublicMarketingPath,
} from "@/lib/i18n"
import { servicePriceCards } from "@/lib/takeoff-pricing"
import { cn } from "@/lib/utils"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/",
  title: "Mediciones de obra autoservicio",
  description:
    "Sube planos PDF a escala y recibe en cuestión de horas planos marcados y cantidades en Excel.",
  keywords: [
    "mediciones de obra",
    "cómputo de cantidades",
    "medición de suelos",
    "medición de tabiquería",
    "recuento de puertas",
    "estimación de obra",
  ],
})

const steps = [
  {
    icon: FileUpIcon,
    title: "Sube planos a escala",
    body:
      "Elige una o varias especialidades disponibles y sube de forma privada un conjunto de planos en PDF.",
  },
  {
    icon: FileSearchIcon,
    title: "Aprueba un precio fijo",
    body:
      "Verificamos en el servidor el PDF real y su número de páginas antes de calcular los créditos.",
  },
  {
    icon: SparklesIcon,
    title: "Cuadrabot mide los planos",
    body:
      "El flujo extrae cantidades, ubicaciones, nivel de confianza y supuestos vinculados a la fuente.",
  },
  {
    icon: DownloadIcon,
    title: "Descarga los resultados",
    body:
      "El PDF marcado y los entregables de Excel validados se liberan automáticamente cuando termina el procesamiento.",
  },
] as const

const tradeCards: Array<{
  href: PublicMarketingPath
  code: string
  title: string
  body: string
}> = [
  {
    href: "/flooring-takeoff",
    code: "01",
    title: "Suelos y acabados",
    body:
      "Superficies, perímetros, códigos de acabado, asignación por estancia y anotaciones vinculadas al plano.",
  },
  {
    href: "/drywall-takeoff",
    code: "02",
    title: "Tabiquería, placas de yeso y techos",
    body:
      "Recorridos de particiones, tipos de muro, superficies de techo y referencias trazables en los planos.",
  },
  {
    href: "/door-window-takeoff",
    code: "03",
    title: "Puertas, ventanas y huecos",
    body:
      "Recuentos por tipo, etiquetas visibles, ubicaciones por página y cuadros de huecos.",
  },
]

export default function HomePageEs() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader locale="es" />
      <main>
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 blueprint-fine-grid opacity-55" />
          <div className="relative mx-auto grid min-h-[680px] w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <Badge variant="outline" className="mb-6 bg-white">
                Cantidades de obra verificadas
              </Badge>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
                Mediciones de obra autoservicio en cuestión de horas.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                Sube planos PDF a escala. Prueba gratis la medición de una hoja
                real, aprueba un precio fijo y recibe planos marcados y
                cantidades en Excel, sin comprar software de mediciones.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={localizedAuthPath("/signup", "es")}
                  className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
                >
                  Probar un plano gratis
                  <ArrowRightIcon />
                </Link>
                <Link
                  href={localizedPublicPath("/sample", "es")}
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "h-12 bg-white px-6"
                  )}
                >
                  Ver un ejemplo de medición
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <LockKeyholeIcon className="size-4 text-primary" />
                  Almacenamiento privado de planos
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-primary" />
                  Una corrección incluida
                </span>
                <span className="flex items-center gap-2">
                  <Layers3Icon className="size-4 text-primary" />
                  Suscripción opcional
                </span>
              </div>
            </div>
            <TakeoffPreview />
          </div>
        </section>

        <section className="border-b bg-[#0b1f3a] text-white">
          <div className="mx-auto grid max-w-7xl divide-y divide-white/10 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
            {[
              ["En horas", "Plazo automatizado para los alcances disponibles"],
              [
                "3 especialidades",
                "Cobertura autoservicio bien definida en el lanzamiento",
              ],
              ["PDF + XLSX", "Evidencias y cantidades que puedes conservar"],
            ].map(([value, label]) => (
              <div key={value} className="px-4 py-7 text-center">
                <p className="text-2xl font-semibold">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Cómo funciona"
              title="Una cadena clara desde el plano hasta la cantidad."
              body="El flujo autoservicio verifica, mide, valida y entrega automáticamente. Cada elemento contado permanece vinculado a evidencias visibles del plano."
            />
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div
                    key={step.title}
                    className="border-t-2 border-primary pt-6"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="size-5 text-primary" />
                      <span className="font-mono text-xs text-muted-foreground">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-7 font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="border-b bg-[#f5f7fa] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Alcance de lanzamiento"
              title="Creado para las especialidades que necesitan recuentos repetibles."
              body="Un alcance bien definido facilita entender los precios, las evidencias, la validación y el plazo. Los conjuntos mayores siguen siendo autoservicio mediante un nivel fijo para proyectos grandes."
            />
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {tradeCards.map((trade) => (
                <Link
                  key={trade.href}
                  href={localizedPublicPath(trade.href, "es")}
                  className="group border bg-white p-7 transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                >
                  <span className="font-mono text-xs text-primary">
                    {trade.code}
                  </span>
                  <h3 className="mt-8 text-xl font-semibold">{trade.title}</h3>
                  <p className="mt-3 min-h-18 text-sm leading-6 text-muted-foreground">
                    {trade.body}
                  </p>
                  <span className="mt-8 flex items-center gap-2 text-sm font-medium text-primary">
                    Explorar este alcance
                    <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <SectionIntro
              eyebrow="Qué recibes"
              title="Cantidades acompañadas de las evidencias necesarias para comprobarlas."
              body="El producto útil no es una hoja de cálculo misteriosa, sino un paquete revisable que permite rastrear qué se ha contado y dónde."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [
                  RulerIcon,
                  "PDF del plano marcado",
                  "Cada unidad admitida está vinculada a su página y ubicación visible.",
                ],
                [
                  FileSpreadsheetIcon,
                  "Libro de cantidades en Excel",
                  "Cantidades estructuradas listas para revisar, filtrar e incorporar a los costes.",
                ],
                [
                  FileSearchIcon,
                  "Evidencias vinculadas a la fuente",
                  "Plano, zona, método, nivel de confianza e identificadores únicos de unidad.",
                ],
                [
                  ShieldCheckIcon,
                  "Metodología y supuestos",
                  "Límites de alcance, exclusiones y controles aplicados antes de la entrega.",
                ],
              ].map(([Icon, title, body]) => (
                <div key={String(title)} className="border p-6">
                  <Icon className="size-5 text-primary" />
                  <h3 className="mt-5 font-semibold">{String(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {String(body)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b bg-[#0b1f3a] py-20 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              inverse
              eyebrow="Precios de servicio sencillos"
              title="Conoce el alcance antes de que se muevan los créditos."
              body="El PDF cargado, no un campo del navegador, determina el número verificado de páginas. Ves el precio fijo en créditos antes de confirmar."
            />
            <div className="mt-12 grid gap-px bg-white/15 md:grid-cols-2 xl:grid-cols-5">
              {servicePriceCards.map((basePrice) => {
                const price = localizeTakeoffPrice(basePrice, "es")
                return (
                  <div key={price.tier} className="bg-[#0b1f3a] p-6">
                    <p className="text-sm text-blue-200">{price.name}</p>
                    <p className="mt-4 text-3xl font-semibold">
                      {(price.priceCents / 100).toLocaleString("es-ES")} $
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {price.description}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="mt-8 flex flex-col items-start justify-between gap-5 border-t border-white/15 pt-8 sm:flex-row sm:items-center">
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                Los paquetes de créditos y planes mensuales están disponibles
                después de iniciar sesión. Sin niveles ilimitados, sin licencias
                por usuario y sin cargos antes de confirmar.
              </p>
              <Link
                href={localizedPublicPath("/pricing", "es")}
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "shrink-0"
                )}
              >
                Ver todos los precios
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
            <SectionIntro
              eyebrow="Preguntas habituales"
              title="Lo primero que suele preguntar un equipo de estimación."
            />
            <Accordion>
              {[
                [
                  "¿La muestra gratis es realmente gratuita?",
                  "Sí. Una empresa puede enviar una hoja y una especialidad disponible sin comprar créditos. Se aplica el mismo enfoque de validación y evidencias.",
                ],
                [
                  "¿Cuadrabot sustituye a un profesional de la estimación?",
                  "No. Cuadrabot ofrece apoyo para mediciones y evidencias revisables. Tu equipo sigue siendo responsable de interpretar el alcance, fijar precios, tomar decisiones de oferta y realizar la verificación final.",
                ],
                [
                  "¿Qué ocurre si mi conjunto de planos es grande?",
                  "Los conjuntos de más de 25 páginas pasan al nivel Proyecto grande publicado y continúan por el mismo flujo autoservicio. La versión inicial sigue limitada a las tres especialidades admitidas.",
                ],
                [
                  "¿Mis planos son privados?",
                  "Sí. Las cargas y los resultados usan almacenamiento privado y accesos firmados de corta duración. Los secretos del servicio y las credenciales de procesamiento nunca llegan al navegador.",
                ],
                [
                  "¿Puedo solicitar una corrección?",
                  "Se incluye una solicitud de corrección en los trabajos autoservicio entregados cuando permanece dentro del alcance aprobado y del conjunto de planos de origen.",
                ],
              ].map(([question, answer]) => (
                <AccordionItem key={question} value={question}>
                  <AccordionTrigger>{question}</AccordionTrigger>
                  <AccordionContent>
                    <p className="leading-6 text-muted-foreground">{answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="blueprint-grid py-20">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
            <Clock3Icon className="size-8 text-primary" />
            <h2 className="mt-6 text-4xl font-semibold tracking-tight">
              Convierte tu próximo conjunto de planos en evidencias listas para
              licitar.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Empieza con una hoja gratis y usa créditos solo cuando el alcance
              verificado tenga sentido.
            </p>
            <Link
              href={localizedAuthPath("/signup", "es")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-8 h-12 px-7"
              )}
            >
              Probar un plano gratis
              <ArrowRightIcon />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}

function SectionIntro({
  eyebrow,
  title,
  body,
  inverse = false,
}: {
  eyebrow: string
  title: string
  body?: string
  inverse?: boolean
}) {
  return (
    <div>
      <p
        className={cn(
          "font-mono text-xs uppercase tracking-[0.18em]",
          inverse ? "text-blue-300" : "text-primary"
        )}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {body ? (
        <p
          className={cn(
            "mt-4 max-w-2xl leading-7",
            inverse ? "text-slate-300" : "text-muted-foreground"
          )}
        >
          {body}
        </p>
      ) : null}
    </div>
  )
}

function TakeoffPreview() {
  return (
    <div className="relative border bg-white p-4 shadow-2xl sm:p-6">
      <div className="absolute -right-4 -top-4 border bg-[#0b1f3a] px-4 py-2 text-xs font-medium text-white">
        RESULTADO VALIDADO
      </div>
      <div className="grid min-h-[470px] gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden border blueprint-fine-grid p-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">A-201 · PLANTA</span>
            <span className="font-mono text-primary">1:100</span>
          </div>
          <div className="relative mt-8 h-72 border-2 border-slate-600">
            <div className="absolute left-[38%] top-0 h-full border-l border-slate-500" />
            <div className="absolute left-0 top-[42%] w-full border-t border-slate-500" />
            <div className="absolute bottom-5 left-5 rounded-sm bg-primary px-2 py-1 text-[10px] text-white">
              FL-03 · 42,6 m²
            </div>
            <div className="absolute right-5 top-5 rounded-sm bg-amber-500 px-2 py-1 text-[10px] text-white">
              D-02 · 3 ud.
            </div>
            <div className="absolute left-[44%] top-[48%] rounded-sm bg-emerald-600 px-2 py-1 text-[10px] text-white">
              PT-01 · 18,4 ml
            </div>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <RulerIcon className="size-4 text-primary" />
            Se conservan las coordenadas de origen de cada cantidad admitida
          </p>
        </div>
        <div className="flex flex-col border">
          <div className="border-b p-4">
            <p className="text-sm font-semibold">Resumen de cantidades</p>
            <p className="mt-1 text-xs text-muted-foreground">
              168 unidades vinculadas a la fuente
            </p>
          </div>
          <div className="flex-1 divide-y">
            {[
              ["Acabado de suelo FL-03", "42,6 m²"],
              ["Partición PT-01", "18,4 ml"],
              ["Tipo de puerta D-02", "3 ud."],
              ["Techo CL-01", "39,8 m²"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 p-4 text-xs"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 divide-x border-t text-center text-xs">
            <div className="p-4">
              <DownloadIcon className="mx-auto mb-2 size-4 text-primary" />
              PDF marcado
            </div>
            <div className="p-4">
              <FileSpreadsheetIcon className="mx-auto mb-2 size-4 text-primary" />
              Libro de Excel
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
