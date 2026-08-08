import { CheckCircle2Icon } from "lucide-react"

type ProductDemoVideoProps = {
  locale?: "en" | "es"
}

const content = {
  en: {
    eyebrow: "See the workflow",
    title: "Upload a blueprint. Get counts you can trace.",
    body:
      "Watch Cuadrabot move from a PDF upload to count locations marked directly on the plan, with an Excel workbook ready for estimating.",
    label:
      "Cuadrabot blueprint takeoff walkthrough showing upload, verification, fixture counts, annotations, and downloadable results",
    transcript:
      "A sample electrical blueprint is uploaded and verified. Cuadrabot returns 174 fixture and device placements, 3 equipment placements, and 177 annotated count locations, delivered as an annotated PDF and Excel workbook.",
    note:
      "Real Cuadrabot interface and sample output. Sensitive project details are redacted and processing time is compressed.",
    points: [
      "Upload a legend-based PDF",
      "Review every marked count",
      "Download PDF + Excel",
    ],
    fallback: "Your browser does not support embedded video.",
  },
  es: {
    eyebrow: "Mira el flujo",
    title: "Sube un plano. Recibe conteos que puedes comprobar.",
    body:
      "Mira cómo Cuadrabot pasa de un PDF a ubicaciones contadas y marcadas directamente en el plano, con un Excel listo para presupuestar.",
    label:
      "Demostración de Cuadrabot que muestra la subida, verificación, conteo, anotaciones y descarga de resultados",
    transcript:
      "Se sube y verifica un plano eléctrico de ejemplo. Cuadrabot entrega 174 ubicaciones de luminarias y dispositivos, 3 ubicaciones de equipos y 177 ubicaciones anotadas, en un PDF anotado y un Excel.",
    note:
      "Interfaz y resultado reales de Cuadrabot. Los datos sensibles están ocultos y el tiempo de procesamiento está abreviado.",
    points: [
      "Sube un PDF con leyenda",
      "Comprueba cada conteo marcado",
      "Descarga PDF + Excel",
    ],
    fallback: "Tu navegador no admite vídeo integrado.",
  },
} as const

export function ProductDemoVideo({ locale = "en" }: ProductDemoVideoProps) {
  const copy = content[locale]
  const titleId = `product-demo-title-${locale}`
  const transcriptId = `product-demo-transcript-${locale}`

  return (
    <section className="border-b bg-[#f5f7fa] py-20" aria-labelledby={titleId}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {copy.eyebrow}
            </p>
            <h2
              id={titleId}
              className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {copy.title}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">
            {copy.body}
          </p>
        </div>

        <figure className="mt-10 overflow-hidden border border-slate-300 bg-[#0b1f3a] shadow-2xl shadow-slate-900/15">
          <video
            className="aspect-video h-auto w-full bg-[#0b1f3a]"
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/media/cuadrabot-blueprint-takeoff-demo-poster.jpg"
            width={1280}
            height={720}
            aria-label={copy.label}
            aria-describedby={transcriptId}
          >
            <source
              src="/media/cuadrabot-blueprint-takeoff-demo.mp4"
              type="video/mp4"
            />
            {copy.fallback}
          </video>
          <figcaption className="flex flex-col gap-4 border-t border-white/15 px-5 py-5 text-white sm:px-7">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              {copy.points.map((point) => (
                <span key={point} className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 shrink-0 text-blue-300" />
                  {point}
                </span>
              ))}
            </div>
            <p className="text-xs leading-5 text-slate-400">{copy.note}</p>
            <p id={transcriptId} className="sr-only">
              {copy.transcript}
            </p>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
