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
import { buildLocalizedMetadata } from "@/lib/i18n"
import { servicePriceCards } from "@/lib/takeoff-pricing"
import { cn } from "@/lib/utils"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/",
  title: "PDF fixture takeoff and symbol counts",
  description:
    "Upload PDF plans with a readable legend and receive source-linked fixture, device, and supported cable or conduit quantities in hours.",
  keywords: [
    "fixture takeoff",
    "electrical fixture takeoff",
    "lighting fixture count",
    "PDF symbol counting",
    "legend based takeoff",
    "cable takeoff from PDF",
  ],
})

const steps = [
  {
    icon: FileUpIcon,
    title: "Upload plans with a legend",
    body: "Choose one or more legend-based scopes and upload a private PDF plan set.",
  },
  {
    icon: FileSearchIcon,
    title: "Approve a fixed quote",
    body: "We verify the actual PDF and page count on the server before quoting credits.",
  },
  {
    icon: SparklesIcon,
    title: "Cuadrabot maps and counts",
    body: "The workflow reads the legend, maps supported codes and symbols, and records each source-linked placement.",
  },
  {
    icon: DownloadIcon,
    title: "Download the results",
    body: "Validated marked PDF and Excel deliverables are released automatically when processing finishes.",
  },
] as const

const tradeCards = [
  {
    href: "/electrical-takeoff",
    code: "01",
    title: "Electrical & lighting fixtures",
    body: "Legend-coded luminaires, devices, equipment, and source-linked placements by code and location.",
  },
  {
    href: "/cable-takeoff",
    code: "02",
    title: "Cable & conduit runs",
    body: "Supported visible routes measured only when the legend is readable and the drawing states a usable scale.",
  },
  {
    href: "/fixture-takeoff",
    code: "03",
    title: "Other legend-coded devices",
    body: "Repeatable counts for supported installed symbols, with ambiguous or unresolved codes flagged rather than guessed.",
  },
] as const

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 blueprint-fine-grid opacity-55" />
          <div className="relative mx-auto grid min-h-[680px] w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <Badge variant="outline" className="mb-6 bg-white">
                Legend-driven fixture takeoffs
              </Badge>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
                Count fixtures from PDF plans in hours.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                Upload a plan set with a readable legend. Cuadrabot maps each
                supported code to the drawing, counts every placement, and
                returns an annotated PDF plus an Excel workbook—fully
                self-serve.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
                >
                  Check my plans free
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="/sample"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "h-12 bg-white px-6"
                  )}
                >
                  View a sample takeoff
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <LockKeyholeIcon className="size-4 text-primary" />
                  Private plan storage
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 text-primary" />
                  One correction included
                </span>
                <span className="flex items-center gap-2">
                  <Layers3Icon className="size-4 text-primary" />
                  Subscription optional
                </span>
              </div>
            </div>
            <TakeoffPreview />
          </div>
        </section>

        <section className="border-b bg-[#0b1f3a] text-white">
          <div className="mx-auto grid max-w-7xl divide-y divide-white/10 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
            {[
              ["In hours", "Automated self-serve delivery"],
              ["Legend-linked", "Codes, symbols, and visible plan locations"],
              ["PDF + XLSX", "Evidence and quantities you can keep"],
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
              eyebrow="How it works"
              title="A clear chain from legend to placement."
              body="The self-serve workflow verifies, maps, counts, validates, and delivers automatically. Legend samples and repeated reference views are excluded from installed-item totals."
            />
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div key={step.title} className="border-t-2 border-primary pt-6">
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
              eyebrow="Legend-based scope"
              title="Built for fixtures, devices, and defensible routed quantities."
              body="A readable legend defines the catalog. For cable or conduit runs, a visible route and stated scale are required. Anything ambiguous is reported as a limitation instead of being guessed."
            />
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {tradeCards.map((trade) => (
                <Link
                  key={trade.href}
                  href={trade.href}
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
                    Explore this category
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
              eyebrow="What you receive"
              title="Legend-coded quantities with evidence you can check."
              body="The useful product is not a mystery total. It is a reviewable package that lets an estimator trace each counted placement to its code and plan location."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [RulerIcon, "Marked plan PDF", "Every supported placement is tied to its page, legend code, and visible location."],
                [FileSpreadsheetIcon, "Excel quantity workbook", "Filterable rows and reconciled summaries by code, area, page, and floor."],
                [FileSearchIcon, "Source evidence", "Stable unit ID, sheet, area, method, confidence, and visible geometry."],
                [ShieldCheckIcon, "Methodology and limitations", "Clear scope boundaries, exclusions, ambiguous codes, and automated checks."],
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
              eyebrow="Simple service pricing"
              title="Know the scope before credits move."
              body="The uploaded PDF—not a browser field—sets the verified page count. You see the fixed credit quote before confirming."
            />
            <div className="mt-12 grid gap-px bg-white/15 md:grid-cols-2 xl:grid-cols-5">
              {servicePriceCards.map((price) => (
                <div key={price.tier} className="bg-[#0b1f3a] p-6">
                  <p className="text-sm text-blue-200">{price.name}</p>
                  <p className="mt-4 text-3xl font-semibold">
                    ${(price.priceCents / 100).toLocaleString()}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {price.description}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-start justify-between gap-5 border-t border-white/15 pt-8 sm:flex-row sm:items-center">
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                Credit packs and monthly plans are available after login. No
                unlimited tier, no per-seat license, and no charge before
                confirmation.
              </p>
              <Link
                href="/pricing"
                className={cn(buttonVariants({ variant: "secondary" }), "shrink-0")}
              >
                See complete pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
            <SectionIntro
              eyebrow="Common questions"
              title="What estimators usually ask first."
            />
            <Accordion>
              {[
                ["Is the free sample really free?", "Yes. One company can submit one sheet with a visible applicable legend and one legend-based scope without buying credits. The same automated validation and evidence approach applies."],
                ["Does Cuadrabot replace an estimator?", "No. Cuadrabot provides takeoff support and reviewable evidence. Your team remains responsible for scope interpretation, pricing, bid decisions, and final verification."],
                ["Does Cuadrabot count the legend itself?", "No. The legend is used as the item catalog. Legend samples, schedule rows, key plans, and repeated reference views are excluded from installed-placement totals."],
                ["Can Cuadrabot measure cable or conduit runs?", "Only when the route is visibly drawn, the applicable legend is readable, and the sheet states a usable scale. Ambiguous routes or codes are flagged rather than guessed."],
                ["Are my drawings private?", "Yes. Uploads and results use private storage and short-lived signed access. Service secrets and processor credentials never enter the browser."],
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
              Turn your next readable legend into source-linked quantities.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Start with one sheet free, then use credits only when the
              verified scope makes sense.
            </p>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "mt-8 h-12 px-7")}
            >
              Check my plans free
              <ArrowRightIcon />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
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
        OUTPUT VALIDATED
      </div>
      <div className="grid min-h-[470px] gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden border blueprint-fine-grid p-5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">E-101 · LIGHTING PLAN</span>
            <span className="font-mono text-primary">1:100</span>
          </div>
          <div className="relative mt-8 h-72 border-2 border-slate-600">
            <div className="absolute left-[38%] top-0 h-full border-l border-slate-500" />
            <div className="absolute left-0 top-[42%] w-full border-t border-slate-500" />
            <div className="absolute bottom-5 left-5 rounded-sm bg-primary px-2 py-1 text-[10px] text-white">
              L-01 · 12 ea
            </div>
            <div className="absolute right-5 top-5 rounded-sm bg-amber-500 px-2 py-1 text-[10px] text-white">
              R-01 · 8 ea
            </div>
            <div className="absolute left-[44%] top-[48%] rounded-sm bg-emerald-600 px-2 py-1 text-[10px] text-white">
              SW-01 · 5 ea
            </div>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <RulerIcon className="size-4 text-primary" />
            Source coordinates retained for every supported placement
          </p>
        </div>
        <div className="flex flex-col border">
          <div className="border-b p-4">
            <p className="text-sm font-semibold">Legend-code summary</p>
            <p className="mt-1 text-xs text-muted-foreground">
              168 source-linked placements
            </p>
          </div>
          <div className="flex-1 divide-y">
            {[
              ["Luminaire L-01", "64 ea"],
              ["Receptacle R-01", "58 ea"],
              ["Switch SW-01", "46 ea"],
              ["Smoke detector FA-01", "18 ea"],
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
              Marked PDF
            </div>
            <div className="p-4">
              <FileSpreadsheetIcon className="mx-auto mb-2 size-4 text-primary" />
              Excel workbook
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
