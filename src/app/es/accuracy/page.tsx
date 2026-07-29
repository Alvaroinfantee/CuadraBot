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
    "Descubre cómo conserva Cuadrabot las evidencias del plano y valida los resultados autoservicio antes de entregarlos.",
})

const controls = [
  [
    RulerIcon,
    "Procedencia de la entrada",
    "El SHA-256, el número real de páginas del PDF, la selección de páginas y los metadatos verificados de origen acompañan al trabajo.",
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
    "Validación de resultados",
    "El servicio rechaza esquemas incorrectos, hashes de origen que no coinciden, identificadores duplicados, páginas no válidas y geometría ausente.",
  ],
  [
    ShieldCheckIcon,
    "Control automático de entrega",
    "Un trabajo solo se entrega cuando la fuente, el esquema, la geometría, los identificadores y los archivos obligatorios superan la validación.",
  ],
  [
    CheckCircle2Icon,
    "Vía de corrección",
    "Se incluye una solicitud de corrección dentro del alcance, conservando el resultado original y el historial de eventos para auditoría.",
  ],
] as const

export default function AccuracyPageEs() {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <PageHero
          eyebrow="Precisión y validación"
          title="Cada cantidad debe ser fácil de rastrear, cuestionar y corregir."
          body="Cuadrabot no presenta la automatización como certeza. Conserva evidencias, nivel de confianza, supuestos y validaciones comprobables por máquina, mientras tu equipo mantiene el criterio final de estimación."
          primary="Probar un plano gratis"
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
                  "El SHA de la fuente y el número de páginas coinciden con el manifiesto de procesamiento.",
                  "Cada identificador de unidad es único y cuenta con geometría visible.",
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
