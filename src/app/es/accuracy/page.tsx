import {
  BracesIcon,
  CheckCircle2Icon,
  FileSearchIcon,
  MapPinIcon,
  RulerIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/accuracy",
  title: "Precisión y validación",
  description:
    "Descubre cómo relaciona Cuadrabot leyendas legibles de planos PDF, conserva las evidencias de origen y valida automáticamente los resultados.",
})

const controls = [
  [
    RulerIcon,
    "Procedencia de la leyenda y la entrada",
    "La leyenda o cuadro legible, el alcance seleccionado, el SHA-256, el número real de páginas y la selección de páginas acompañan al trabajo.",
  ],
  [
    MapPinIcon,
    "Ubicación visible en la fuente",
    "Cada unidad admitida incluye una página y un punto o recuadro visible dentro del sistema de coordenadas definido para el PDF.",
  ],
  [
    BracesIcon,
    "Identificadores estables",
    "Los identificadores únicos permiten conciliar las filas del libro, las evidencias estructuradas y las anotaciones del PDF.",
  ],
  [
    FileSearchIcon,
    "Conciliación por código",
    "Los totales se concilian por código de leyenda y ubicación. Los ejemplos de leyenda, las filas de cuadros, las plantas clave y las vistas repetidas se excluyen de las instalaciones.",
  ],
  [
    ShieldCheckIcon,
    "Control automático de entrega",
    "Un trabajo solo se entrega cuando la fuente, el esquema, la geometría, los identificadores y los archivos obligatorios superan la validación.",
  ],
  [
    CheckCircle2Icon,
    "Sin adivinanzas silenciosas",
    "Los códigos y recorridos ilegibles, contradictorios o sin resolver se indican como limitaciones en lugar de asignarlos sin evidencias.",
  ],
] as const

export default function AccuracyPageEs() {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <PageHero
          eyebrow="Precisión y validación"
          title="Cada cantidad debe poder rastrearse hasta un código de leyenda y una ubicación del plano."
          body="Cuadrabot no presenta la automatización como certeza. Conserva evidencias de origen, nivel de confianza, supuestos y validaciones comprobables por máquina, mientras tu equipo mantiene el criterio final de estimación."
          primary="Probar una hoja gratis"
          secondary="Ver un ejemplo de entrega"
          locale="es"
        />
        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-px border bg-border md:grid-cols-2 lg:grid-cols-3">
              {controls.map(([Icon, title, body]) => (
                <article key={String(title)} className="bg-white p-7">
                  <Icon className="size-6 text-primary" />
                  <h2 className="mt-6 text-lg font-semibold">{String(title)}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {String(body)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="border-b bg-[#f5f7fa] py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Qué validamos
              </p>
              <ul className="mt-6 space-y-4 text-sm leading-6">
                {[
                  "El archivo cargado es un PDF legible y sin cifrar.",
                  "La leyenda o el cuadro aplicable es legible para el alcance seleccionado.",
                  "El SHA de la fuente y el número de páginas coinciden con el manifiesto de procesamiento.",
                  "Cada identificador de unidad es único y cuenta con geometría visible.",
                  "Los ejemplos de la leyenda y las vistas de referencia duplicadas no se cuentan como instalaciones.",
                  "Los recorridos medidos de cables o canalizaciones tienen una ruta visible y una escala utilizable indicada.",
                  "Las anotaciones permanecen en la página declarada y dentro de los límites visibles.",
                  "Existen los archivos JSON, el libro, la metodología y el PDF marcado obligatorios.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2Icon className="mt-1 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border bg-white p-7">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Qué sigue exigiendo tu criterio
              </p>
              <ul className="mt-6 space-y-4 text-sm leading-6 text-muted-foreground">
                {[
                  "La interpretación del contrato, las adendas, las alternativas y el alcance de la oferta.",
                  "La resolución de símbolos o recorridos ausentes, ilegibles o contradictorios en los documentos de origen.",
                  "Los factores de desperdicio, la mano de obra, la productividad, los medios y métodos y los precios.",
                  "La intención de diseño, el cumplimiento normativo, la ingeniería y las decisiones de permisos.",
                  "La conciliación final con el conjunto completo de documentos contractuales.",
                ].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <CtaBand locale="es" />
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}
