import Link from "next/link"
import Image from "next/image"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  DownloadIcon,
  FileCheck2Icon,
  FileSpreadsheetIcon,
  FileUpIcon,
  LockKeyholeIcon,
  MinusCircleIcon,
  MousePointerClickIcon,
  RulerIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { MarkedPlan } from "@/components/takeoff/marked-plan"
import { AttributionCapture } from "@/components/takeoff/attribution-capture"

const included = [
  "Tabiques de pladur por planta, plano y tipo",
  "Techos de placa de yeso cuando haya RCP",
  "Longitudes, superficies brutas y netas",
  "Huecos dimensionados registrados por separado",
  "Excel trazable y PDF marcado por colores",
  "Una correccion sobre los planos originales",
]

const excluded = [
  "Precios, mano de obra o presupuestos de proveedor",
  "Tornillos, montantes, canales y accesorios",
  "Otros oficios, demoliciones, BIM o IFC",
  "Cambios de planos o ampliaciones de alcance",
]

const faqs = [
  ["¿Que recibo exactamente?", "Un Excel de cantidades con resumen, detalle de tabiques, techos, huecos, supuestos y revisiones; ademas de un PDF de los planos fuente marcado por colores e identificadores."],
  ["¿El precio incluye IVA?", "El precio base es 149 €. El IVA aplicable se calcula y muestra antes del pago en el checkout seguro."],
  ["¿Cuando empieza el plazo?", "El plazo de dos dias laborables empieza cuando se confirma el pago y tenemos todos los planos y respuestas necesarias. Si pedimos una aclaracion, el reloj queda pausado y lo veras en el portal."],
  ["¿Que ocurre si necesito mas de 20 hojas?", "Conservamos tu proyecto y te mostramos un flujo de revision personalizada. No se permite comprar el producto fijo de 149 € por error."],
  ["¿Como se protegen mis planos?", "Los archivos de produccion se guardan en almacenamiento privado, con acceso temporal, aislamiento por proyecto y eliminacion por defecto 90 dias despues de la entrega final."],
  ["¿Esto sustituye mi comprobacion profesional?", "No. Entregamos una medicion revisada y trazable, pero debes verificarla antes de comprar materiales o presentar una oferta vinculante. No verificamos condiciones de obra."],
]

export function TakeoffLanding({ locale = "es" }: { locale?: "es" | "en" }) {
  return locale === "en" ? <EnglishTakeoffLanding /> : <SpanishTakeoffLanding />
}

function SpanishTakeoffLanding() {
  return (
    <div className="min-h-screen bg-[#f7f8f5] text-slate-950">
      <AttributionCapture />
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f7f8f5]/92 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-[#153a31] text-sm text-white">C</span>
            Cuadrabot
            <span className="hidden rounded-full bg-[#e3eee9] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#153a31] sm:inline">Mediciones</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
            <Link href="#como-funciona" className="hover:text-slate-950">Como funciona</Link>
            <Link href="#muestra" className="hover:text-slate-950">Muestra</Link>
            <Link href="#alcance" className="hover:text-slate-950">Alcance</Link>
            <Link href="#preguntas" className="hover:text-slate-950">Preguntas</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/en" className="text-xs font-semibold text-slate-600 hover:text-slate-950" aria-label="View in English">EN</Link>
            <Link href="/pedido" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#e35e38] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c94f2e]">
              Subir planos <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(#dfe6e2_1px,transparent_1px),linear-gradient(90deg,#dfe6e2_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#afc7be] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#153a31]">
                <ShieldCheckIcon className="size-4" /> Revisado antes de entregar · España · Sistema metrico
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl">
                Mediciones de pladur desde tus planos en <span className="text-[#e35e38]">dos dias laborables</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Sube tus planos en PDF y recibe un Excel de cantidades y un PDF marcado, revisados y listos para presupuestar. <strong className="font-semibold text-slate-950">Precio fijo: 149 € + IVA.</strong>
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/pedido" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#e35e38] px-6 font-semibold text-white shadow-[0_8px_24px_rgba(227,94,56,0.25)] transition hover:-translate-y-0.5 hover:bg-[#c94f2e]">
                  <FileUpIcon className="size-5" /> Subir planos
                </Link>
                <Link href="#muestra" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 font-semibold hover:border-slate-500">
                  Ver una entrega realista <ArrowRightIcon className="size-4" />
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                <span>Hasta 20 hojas relevantes</span><span>Sin suscripcion</span><span>Una revision incluida</span>
              </div>
              <p className="mt-7 flex items-center gap-2 text-xs leading-5 text-slate-500">
                <LockKeyholeIcon className="size-4 shrink-0 text-[#153a31]" /> Planos confidenciales. Archivos privados y eliminacion por defecto 90 dias tras la entrega.
              </p>
            </div>

            <div className="relative pb-14 lg:pl-4">
              <MarkedPlan />
              <div className="absolute -bottom-1 right-0 w-[84%] rounded-xl border border-slate-200 bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.18)] sm:w-[70%]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheetIcon className="size-4 text-[#17816b]" /> Resumen de cantidades</div>
                  <span className="rounded bg-[#e6f4ef] px-2 py-1 text-[10px] font-bold text-[#146854]">XLSX</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Metric label="Tabiques" value="86,42 m" />
                  <Metric label="Area neta" value="438,17 m²" />
                  <Metric label="Techos" value="164,80 m²" />
                </div>
              </div>
            </div>
          </div>

          <div className="relative border-t border-slate-200 bg-white/85">
            <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-200 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
              <Promise icon={<FileCheck2Icon />} value="2 archivos" label="Excel + PDF marcado" />
              <Promise icon={<Clock3Icon />} value="2 dias" label="laborables" />
              <Promise icon={<RulerIcon />} value="20 hojas" label="seleccionadas" />
              <Promise icon={<MousePointerClickIcon />} value="149 €" label="+ IVA, pago unico" />
            </div>
          </div>
        </section>

        <section id="muestra" className="border-b border-slate-200 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionEyebrow>Muestra completa</SectionEyebrow>
            <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">No te mostramos promesas: te mostramos el formato de entrega.</h2>
              <div className="flex flex-wrap gap-3">
                <a href="/samples/cuadrabot-plano-original-muestra.pdf" download className="sample-download"><DownloadIcon /> Plano original</a>
                <a href="/samples/cuadrabot-plano-marcado-muestra.pdf" download className="sample-download"><DownloadIcon /> PDF marcado</a>
                <a href="/samples/cuadrabot-mediciones-muestra.xlsx" download className="sample-download"><DownloadIcon /> Excel</a>
              </div>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-slate-200 bg-[#f7f8f5] p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between text-sm"><span className="font-semibold">A-101 · Planta primera · Rev. 03</span><span className="text-slate-500">Escala 1:100</span></div>
                <MarkedPlan compact />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#102f28] p-6 text-white sm:p-8">
                <div className="flex items-center gap-3"><FileSpreadsheetIcon className="size-6 text-[#7dd8bd]" /><h3 className="text-xl font-semibold">Cuadro de mediciones</h3></div>
                <p className="mt-3 text-sm leading-6 text-white/65">Cada fila se reconcilia con un identificador visible en el PDF. Las formulas conservan precision y el informe redondea a dos decimales.</p>
                <div className="mt-7 overflow-hidden rounded-lg border border-white/15 bg-white">
                  <Image src="/samples/cuadrabot-excel-muestra.png" alt="Captura del Excel de cantidades de muestra" width={1469} height={770} loading="eager" className="h-auto w-full" />
                </div>
                <div className="mt-6 rounded-lg border border-[#7dd8bd]/30 bg-[#7dd8bd]/10 p-4 text-sm leading-6 text-[#c9f2e5]">
                  <strong>Supuesto de muestra:</strong> altura 2,70 m aplicada en el distribuidor por ausencia de seccion acotada. Afecta P-003; pendiente de confirmacion.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="border-b border-slate-200 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionEyebrow>Pedido sin llamadas</SectionEyebrow>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Del PDF a una medicion revisada en cuatro pasos.</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {[
                ["01", "Sube tus planos", "PDF, hasta 10 archivos y 500 MB en total."],
                ["02", "Elige las hojas", "Selecciona hasta 20 paginas relevantes para pladur."],
                ["03", "Define el alcance", "Responde las preguntas que evitan supuestos innecesarios."],
                ["04", "Paga y sigue el pedido", "Pago unico; portal por enlace seguro y entrega descargable."],
              ].map(([number, title, body]) => <div key={number} className="rounded-xl border border-slate-200 bg-white p-6"><div className="font-mono text-sm text-[#e35e38]">{number}</div><h3 className="mt-8 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}
            </div>
            <div className="mt-8 flex items-start gap-3 rounded-xl border border-[#b6cec5] bg-[#e7f0ec] p-5 text-sm leading-6 text-[#153a31]">
              <CheckCircle2Icon className="mt-0.5 size-5 shrink-0" /> Analisis asistido por software y revisado antes de la entrega. Si la automatizacion no basta, el operador completa la medicion manualmente: el pedido nunca queda bloqueado por el sistema.
            </div>
          </div>
        </section>

        <section id="alcance" className="border-b border-slate-200 bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <ScopeCard title="Incluido en 149 €" items={included} included />
            <ScopeCard title="No incluido" items={excluded} />
          </div>
        </section>

        <section id="preguntas" className="py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
            <div><SectionEyebrow>Preguntas frecuentes</SectionEyebrow><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Antes de subir tus planos.</h2><p className="mt-4 text-sm leading-6 text-slate-600">Si el proyecto es excepcional o supera 20 hojas, guardamos tus datos y lo enviamos a revision personalizada sin cobrar el producto estandar.</p></div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {faqs.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{question}<span className="text-2xl font-light text-slate-400 group-open:rotate-45">+</span></summary><p className="max-w-3xl pt-3 text-sm leading-6 text-slate-600">{answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="bg-[#102f28] py-20 text-white">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6">
            <LockKeyholeIcon className="size-8 text-[#7dd8bd]" />
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Tus planos entran. La medicion profesional sale.</h2>
            <p className="mt-4 max-w-2xl text-white/65">Sin suscripcion, sin crear contraseña y sin tener que hablar con ventas. Si el alcance es estandar, completas el pedido en menos de cinco minutos.</p>
            <Link href="/pedido" className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-[#e35e38] px-7 font-semibold text-white hover:bg-[#ef6d48]">Subir planos <ArrowRightIcon className="size-4" /></Link>
            <Link href="/reembolsos" className="mt-4 text-xs text-white/60 underline underline-offset-4">Ver politica de reembolso</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-sm text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 sm:px-6 md:flex-row lg:px-8">
          <div><span className="font-semibold text-slate-900">Cuadrabot</span> · Mediciones de pladur revisadas · soporte@cuadrabot.com</div>
          <div className="flex flex-wrap gap-5"><Link href="/terminos">Terminos</Link><Link href="/privacidad">Privacidad</Link><Link href="/reembolsos">Reembolsos</Link><Link href="/confidencialidad">Confidencialidad</Link><Link href="/alcance">Alcance</Link></div>
        </div>
      </footer>
    </div>
  )
}

const englishIncluded = [
  "Drywall partitions by floor, drawing and wall type",
  "Gypsum-board ceilings when reflected ceiling plans are provided",
  "Lengths plus gross and net surface areas",
  "Dimensioned openings recorded separately",
  "Traceable Excel workbook and colour-marked PDF",
  "One correction against the original drawing revision",
]

const englishExcluded = [
  "Pricing, labour or supplier quotations",
  "Studs, tracks, screws and accessories",
  "Other trades, demolition, BIM or IFC",
  "Drawing revisions or added scope after ordering",
]

const englishFaqs = [
  ["What exactly will I receive?", "An Excel quantity workbook covering partitions, ceilings, openings, assumptions and revisions, plus a colour-marked copy of the source drawings with matching identifiers."],
  ["Does the price include VAT?", "The base price is €149. Any applicable VAT is calculated and displayed before payment in the secure checkout."],
  ["When does the two-day turnaround begin?", "It begins once payment is confirmed and we have all required drawings and answers. If we request clarification, the clock pauses and the portal shows that status."],
  ["What if I need more than 20 sheets?", "We keep the project and route it to a free custom review. You cannot accidentally purchase the fixed €149 product for an ineligible project."],
  ["How are my drawings protected?", "Production files stay in private storage with temporary access, project isolation and default deletion 90 days after final delivery."],
  ["Does this replace my professional review?", "No. We deliver a reviewed, traceable takeoff, but you must verify it before purchasing materials or submitting a binding bid. We do not verify site conditions."],
]

function EnglishTakeoffLanding() {
  return (
    <div className="min-h-screen bg-[#f7f8f5] text-slate-950">
      <AttributionCapture />
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f7f8f5]/92 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/en" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-[#153a31] text-sm text-white">C</span>
            Cuadrabot
            <span className="hidden rounded-full bg-[#e3eee9] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#153a31] sm:inline">Takeoffs</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
            <Link href="#how-it-works" className="hover:text-slate-950">How it works</Link>
            <Link href="#sample" className="hover:text-slate-950">Sample</Link>
            <Link href="#scope" className="hover:text-slate-950">Scope</Link>
            <Link href="#questions" className="hover:text-slate-950">FAQ</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs font-semibold text-slate-600 hover:text-slate-950" aria-label="Ver en español">ES</Link>
            <Link href="/en/order" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#e35e38] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c94f2e]">
              Upload plans <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(#dfe6e2_1px,transparent_1px),linear-gradient(90deg,#dfe6e2_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#afc7be] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#153a31]">
                <ShieldCheckIcon className="size-4" /> Reviewed before delivery · Spain · Metric
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl">
                Drywall takeoffs from your plans in <span className="text-[#e35e38]">two business days</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                Upload PDF plans and receive a reviewed Excel quantity workbook and colour-marked PDF, ready for estimating. <strong className="font-semibold text-slate-950">Fixed price: €149 + VAT.</strong>
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/en/order" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#e35e38] px-6 font-semibold text-white shadow-[0_8px_24px_rgba(227,94,56,0.25)] transition hover:-translate-y-0.5 hover:bg-[#c94f2e]"><FileUpIcon className="size-5" /> Upload plans</Link>
                <Link href="#sample" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 font-semibold hover:border-slate-500">View a realistic delivery <ArrowRightIcon className="size-4" /></Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600"><span>Up to 20 relevant sheets</span><span>No subscription</span><span>One correction included</span></div>
              <p className="mt-7 flex items-center gap-2 text-xs leading-5 text-slate-500"><LockKeyholeIcon className="size-4 shrink-0 text-[#153a31]" /> Confidential plans. Private files, deleted by default 90 days after delivery.</p>
            </div>
            <div className="relative pb-14 lg:pl-4">
              <MarkedPlan locale="en" />
              <div className="absolute -bottom-1 right-0 w-[84%] rounded-xl border border-slate-200 bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.18)] sm:w-[70%]">
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheetIcon className="size-4 text-[#17816b]" /> Quantity summary</div><span className="rounded bg-[#e6f4ef] px-2 py-1 text-[10px] font-bold text-[#146854]">XLSX</span></div>
                <div className="grid grid-cols-3 gap-2 text-xs"><Metric label="Partitions" value="86.42 m" /><Metric label="Net area" value="438.17 m²" /><Metric label="Ceilings" value="164.80 m²" /></div>
              </div>
            </div>
          </div>
          <div className="relative border-t border-slate-200 bg-white/85"><div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-200 px-4 sm:px-6 md:grid-cols-4 lg:px-8"><Promise icon={<FileCheck2Icon />} value="2 files" label="Excel + marked PDF" /><Promise icon={<Clock3Icon />} value="2 days" label="business days" /><Promise icon={<RulerIcon />} value="20 sheets" label="selected" /><Promise icon={<MousePointerClickIcon />} value="€149" label="+ VAT, one payment" /></div></div>
        </section>

        <section id="sample" className="border-b border-slate-200 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionEyebrow>Complete sample</SectionEyebrow>
            <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">See the delivery format—not just a promise.</h2><div className="flex flex-wrap gap-3"><a href="/samples/cuadrabot-plano-original-muestra.pdf" download className="sample-download"><DownloadIcon /> Original plan</a><a href="/samples/cuadrabot-plano-marcado-muestra.pdf" download className="sample-download"><DownloadIcon /> Marked PDF</a><a href="/samples/cuadrabot-mediciones-muestra.xlsx" download className="sample-download"><DownloadIcon /> Excel workbook</a></div></div>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-slate-200 bg-[#f7f8f5] p-4 sm:p-6"><div className="mb-4 flex items-center justify-between text-sm"><span className="font-semibold">A-101 · First floor · Rev. 03</span><span className="text-slate-500">Scale 1:100</span></div><MarkedPlan compact locale="en" /></div>
              <div className="rounded-2xl border border-slate-200 bg-[#102f28] p-6 text-white sm:p-8"><div className="flex items-center gap-3"><FileSpreadsheetIcon className="size-6 text-[#7dd8bd]" /><h3 className="text-xl font-semibold">Quantity schedule</h3></div><p className="mt-3 text-sm leading-6 text-white/65">Every row reconciles to an identifier visible in the PDF. Formulas retain precision while the report displays two decimals.</p><div className="mt-7 overflow-hidden rounded-lg border border-white/15 bg-white"><Image src="/samples/cuadrabot-excel-muestra.png" alt="Screenshot of the sample quantity workbook" width={1469} height={770} loading="eager" className="h-auto w-full" /></div><div className="mt-6 rounded-lg border border-[#7dd8bd]/30 bg-[#7dd8bd]/10 p-4 text-sm leading-6 text-[#c9f2e5]"><strong>Sample assumption:</strong> 2.70 m height applied in the corridor because no dimensioned section was supplied. Affects P-003; confirmation pending.</div></div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-slate-200 py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><SectionEyebrow>No-call ordering</SectionEyebrow><h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">From PDF to reviewed takeoff in four steps.</h2><div className="mt-10 grid gap-4 md:grid-cols-4">{[["01", "Upload your plans", "PDF, up to 10 files and 500 MB total."], ["02", "Choose the sheets", "Select up to 20 sheets relevant to drywall."], ["03", "Define the scope", "Answer the questions that prevent unnecessary assumptions."], ["04", "Pay and track", "One payment, secure-link portal and downloadable delivery."]].map(([number, title, body]) => <div key={number} className="rounded-xl border border-slate-200 bg-white p-6"><div className="font-mono text-sm text-[#e35e38]">{number}</div><h3 className="mt-8 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div><div className="mt-8 flex items-start gap-3 rounded-xl border border-[#b6cec5] bg-[#e7f0ec] p-5 text-sm leading-6 text-[#153a31]"><CheckCircle2Icon className="mt-0.5 size-5 shrink-0" /> Software-assisted analysis, reviewed before delivery. When automation is insufficient, the operator completes the takeoff manually—the order is never abandoned because of the system.</div></div></section>

        <section id="scope" className="border-b border-slate-200 bg-white py-20"><div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8"><ScopeCard title="Included for €149" items={englishIncluded} included /><ScopeCard title="Not included" items={englishExcluded} /></div></section>

        <section id="questions" className="py-20"><div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8"><div><SectionEyebrow>Frequently asked questions</SectionEyebrow><h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Before uploading your plans.</h2><p className="mt-4 text-sm leading-6 text-slate-600">Exceptional projects and selections above 20 sheets are saved and routed to a free custom review without charging for the standard product.</p></div><div className="divide-y divide-slate-200 border-y border-slate-200">{englishFaqs.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{question}<span className="text-2xl font-light text-slate-400 group-open:rotate-45">+</span></summary><p className="max-w-3xl pt-3 text-sm leading-6 text-slate-600">{answer}</p></details>)}</div></div></section>

        <section className="bg-[#102f28] py-20 text-white"><div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6"><LockKeyholeIcon className="size-8 text-[#7dd8bd]" /><h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Your plans go in. A professional takeoff comes out.</h2><p className="mt-4 max-w-2xl text-white/65">No subscription, no password and no sales call. If the scope is standard, the order takes less than five minutes to place.</p><Link href="/en/order" className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-[#e35e38] px-7 font-semibold text-white hover:bg-[#ef6d48]">Upload plans <ArrowRightIcon className="size-4" /></Link><Link href="/en/refunds" className="mt-4 text-xs text-white/60 underline underline-offset-4">View refund policy</Link></div></section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-sm text-slate-500"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 sm:px-6 md:flex-row lg:px-8"><div><span className="font-semibold text-slate-900">Cuadrabot</span> · Reviewed drywall takeoffs · support@cuadrabot.com</div><div className="flex flex-wrap gap-5"><Link href="/en/terms">Terms</Link><Link href="/en/privacy">Privacy</Link><Link href="/en/refunds">Refunds</Link><Link href="/en/confidentiality">Confidentiality</Link><Link href="/en/scope">Scope</Link></div></div></footer>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-[#f2f5f3] p-2.5"><span className="block text-[10px] text-slate-500">{label}</span><strong className="mt-1 block text-slate-900">{value}</strong></div> }
function Promise({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) { return <div className="flex items-center gap-3 px-3 py-5 sm:px-6 [&_svg]:size-5 [&_svg]:text-[#17816b]"><span>{icon}</span><div><strong className="block text-sm">{value}</strong><span className="text-xs text-slate-500">{label}</span></div></div> }
function SectionEyebrow({ children }: { children: React.ReactNode }) { return <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#e35e38]">{children}</div> }
function ScopeCard({ title, items, included: isIncluded = false }: { title: string; items: string[]; included?: boolean }) { return <div className={`rounded-2xl border p-7 sm:p-9 ${isIncluded ? "border-[#b6cec5] bg-[#edf4f1]" : "border-slate-200 bg-[#f7f8f5]"}`}><h3 className="text-xl font-semibold">{title}</h3><ul className="mt-6 space-y-4">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">{isIncluded ? <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-[#17816b]" /> : <MinusCircleIcon className="mt-0.5 size-5 shrink-0 text-slate-400" />}{item}</li>)}</ul></div> }
