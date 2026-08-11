import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
} from "lucide-react"
import { PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buttonVariants } from "@/components/ui/button"
import {
  buildLocalizedMetadata,
  freeTrialSignupPath,
} from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const metadata = buildLocalizedMetadata({
  locale: "es",
  path: "/sample",
  title: "Ejemplo de medición de elementos por leyenda",
  description:
    "Consulta cómo relaciona Cuadrabot una leyenda legible del PDF con recuentos trazables, un plano anotado y un libro de Excel.",
})

const rows = [
  [
    "L-01",
    "Luminaria LED empotrada",
    "E-101",
    "Comercial / ventas",
    "64",
    "ud.",
    "Alta",
  ],
  [
    "L-02",
    "Luminaria lineal suspendida",
    "E-101",
    "Cajas",
    "12",
    "ud.",
    "Alta",
  ],
  [
    "R-01",
    "Toma doble",
    "E-102",
    "Comercial / ventas",
    "58",
    "ud.",
    "Alta",
  ],
  [
    "SW-01",
    "Interruptor unipolar",
    "E-101",
    "Zona de servicio",
    "46",
    "ud.",
    "Alta",
  ],
  [
    "FA-01",
    "Detector de humo",
    "E-103",
    "Nivel 01",
    "18",
    "ud.",
    "Media",
  ],
] as const

export default function SamplePageEs() {
  return (
    <div className="min-h-screen">
      <SiteHeader locale="es" />
      <main>
        <PageHero
          eyebrow="Ejemplo de medición"
          title="Comprueba cómo un código de leyenda se convierte en un recuento trazable."
          body="Este ejemplo eléctrico ilustrativo muestra la leyenda, las ubicaciones correspondientes, la estructura del libro y el contexto de validación automatizada. Los planos reales permanecen privados."
          primary="Probar una hoja gratis"
          secondary="Ver los controles de precisión"
          secondaryHref="/es/accuracy"
          locale="es"
        />

        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="border bg-white p-5 shadow-lg">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-semibold">E-101 · Plano de iluminación</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Leyenda relacionada desde E-001 · vista previa anotada
                    </p>
                  </div>
                  <span className="border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Resultado validado
                  </span>
                </div>
                <div className="relative mt-5 aspect-[4/3] border-2 border-slate-500 blueprint-fine-grid">
                  <div className="absolute left-[34%] top-0 h-full border-l border-slate-500" />
                  <div className="absolute left-0 top-[38%] w-full border-t border-slate-500" />
                  <div className="absolute left-[34%] top-[68%] w-[66%] border-t border-slate-500" />
                  <Marker
                    className="left-[8%] top-[12%]"
                    label="L-01 · 12 ud."
                  />
                  <Marker
                    className="left-[42%] top-[12%]"
                    label="L-02 · 4 ud."
                  />
                  <Marker
                    className="left-[40%] top-[48%]"
                    label="R-01 · 8 ud."
                    tone="amber"
                  />
                  <Marker
                    className="bottom-[7%] right-[7%]"
                    label="SW-01 · 5 ud."
                    tone="green"
                  />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="border p-3">
                    <p className="font-semibold">168</p>
                    <p className="mt-1 text-muted-foreground">
                      Ubicaciones contadas
                    </p>
                  </div>
                  <div className="border p-3">
                    <p className="font-semibold">168</p>
                    <p className="mt-1 text-muted-foreground">Anotadas</p>
                  </div>
                  <div className="border p-3">
                    <p className="font-semibold">0</p>
                    <p className="mt-1 text-muted-foreground">Omitidas</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                  Paquete de entrega
                </p>
                <h2 className="mt-3 text-3xl font-semibold">
                  Cuatro niveles de comprobación
                </h2>
                <div className="mt-8 space-y-4">
                  {[
                    [
                      FileTextIcon,
                      "PDF del plano anotado",
                      "Cada ubicación compatible queda marcada con su código de leyenda y posición visible.",
                    ],
                    [
                      FileSpreadsheetIcon,
                      "Libro de cantidades",
                      "Filas filtrables y resúmenes conciliados por código y ubicación del plano.",
                    ],
                    [
                      FileJsonIcon,
                      "Evidencias estructuradas",
                      "Identificador estable, código de leyenda, página, zona, método, confianza, cantidad y geometría.",
                    ],
                    [
                      CheckCircle2Icon,
                      "Metodología y limitaciones",
                      "Exclusiones de la leyenda, elementos ambiguos, métricas de validación y evento de entrega automatizada.",
                    ],
                  ].map(([Icon, title, body]) => (
                    <div
                      key={String(title)}
                      className="flex gap-4 border-b pb-4"
                    >
                      <Icon className="mt-1 size-5 shrink-0 text-primary" />
                      <div>
                        <h3 className="font-semibold">{String(title)}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {String(body)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-[#f5f7fa] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Vista previa del libro
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Filas por código de leyenda, no un total sin explicación
              </h2>
            </div>
            <div className="overflow-x-auto border bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-[#0b1f3a] text-white">
                  <tr>
                    {[
                      "Código",
                      "Descripción",
                      "Plano",
                      "Zona",
                      "Cant.",
                      "Unidad",
                      "Confianza",
                    ].map((header) => (
                      <th key={header} className="px-4 py-3 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={`${row[0]}-${row[3]}`}>
                      {row.map((cell, index) => (
                        <td
                          key={`${cell}-${index}`}
                          className={cn(
                            "px-4 py-3",
                            index === 0 && "font-mono font-medium text-primary"
                          )}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold">
              Haz la prueba real con tu propia leyenda legible.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Esta página es una vista previa ilustrativa. Prueba una hoja real
              gratis, sin tarjeta, y recibe tu propio PDF anotado y el libro de
              Excel.
            </p>
            <Link
              href={freeTrialSignupPath("es")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-7 h-12 px-7"
              )}
            >
              Probar una hoja gratis
              <ArrowRightIcon />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter locale="es" />
    </div>
  )
}

function Marker({
  className,
  label,
  tone = "blue",
}: {
  className: string
  label: string
  tone?: "blue" | "amber" | "green"
}) {
  const colors = {
    blue: "bg-primary",
    amber: "bg-amber-500",
    green: "bg-emerald-600",
  }
  return (
    <span
      className={cn(
        "absolute px-2 py-1 text-[10px] font-medium text-white shadow",
        colors[tone],
        className
      )}
    >
      {label}
    </span>
  )
}
