import {
  CheckCircle2Icon,
  FileCheck2Icon,
  FileUpIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
  WalletCardsIcon,
} from "lucide-react"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/how-it-works",
  title: "Cómo funciona",
  description:
    "Cómo convierte Cuadrabot leyendas legibles de planos PDF en cantidades autoservicio de elementos, dispositivos y recorridos compatibles vinculadas al origen.",
})

const stages = [
  [
    "01",
    FileUpIcon,
    "Carga privada",
    "Elige las categorías basadas en leyenda, añade notas sobre el alcance y sube un juego de planos PDF directamente al almacenamiento privado.",
  ],
  [
    "02",
    FileCheck2Icon,
    "Verificación en el servidor",
    "Cuadrabot comprueba el archivo almacenado, la firma del PDF, la protección por contraseña, el tamaño y el número real de páginas.",
  ],
  [
    "03",
    WalletCardsIcon,
    "Precio fijo",
    "El alcance verificado se convierte en los créditos publicados. No se reserva nada hasta que lo apruebas.",
  ],
  [
    "04",
    ScanSearchIcon,
    "Mapeo de leyenda y medición",
    "Cuadrabot utiliza la leyenda legible como catálogo, relaciona códigos y símbolos compatibles en las hojas válidas y registra una unidad vinculada al plano por cada ubicación instalada.",
  ],
  [
    "05",
    ShieldCheckIcon,
    "Validación automatizada",
    "El servicio excluye ejemplos de leyenda y vistas de referencia repetidas, concilia totales por código y ubicación y señala lo ambiguo o sin resolver en lugar de adivinarlo.",
  ],
  [
    "06",
    CheckCircle2Icon,
    "Entrega automática",
    "El PDF marcado, el libro de Excel, las evidencias de origen y la metodología aparecen en tu espacio privado en cuanto termina el procesamiento.",
  ],
] as const

export default function HowItWorksPageEs() {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <PageHero
          eyebrow="Cómo funciona"
          title="Sube los planos, confirma el alcance y deja que Cuadrabot relacione la leyenda."
          body="El flujo autoservicio mantiene como etapas separadas y auditables el precio, los movimientos de créditos, el mapeo de leyenda, el recuento, la validación y la entrega en horas."
          primary="Crear una cuenta"
          secondary="Ver los controles de precisión"
          secondaryHref="/es/accuracy"
          locale="es"
        />
        <section className="border-b py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="space-y-px bg-border">
              {stages.map(([number, Icon, title, body]) => (
                <article
                  key={number}
                  className="grid gap-5 bg-white p-6 sm:grid-cols-[80px_48px_1fr] sm:items-start sm:p-8"
                >
                  <span className="font-mono text-2xl font-semibold text-primary">
                    {number}
                  </span>
                  <Icon className="size-6 text-primary" />
                  <div>
                    <h2 className="text-xl font-semibold">{title}</h2>
                    <p className="mt-2 leading-7 text-muted-foreground">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="border-b bg-[#0b1f3a] py-16 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            {[
              [
                "Autoridad del precio",
                "Solo el número de páginas del PDF verificado por el servidor puede determinar el nivel de créditos publicado.",
              ],
              [
                "Autoridad de procesamiento",
                "El procesador privado solo accede a trabajos que ha reclamado mediante enlaces firmados de corta duración.",
              ],
              [
                "Autoridad de entrega",
                "Solo un trabajo reclamado correctamente y con archivos de resultado validados puede liquidar créditos y liberar los entregables.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="border-l border-blue-300/40 pl-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </section>
        <CtaBand locale="es" />
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}
