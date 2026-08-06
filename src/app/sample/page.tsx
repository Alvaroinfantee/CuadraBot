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
import { buildLocalizedMetadata } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/sample",
  title: "Sample legend-based fixture takeoff",
  description:
    "Preview how Cuadrabot maps a readable PDF legend to source-linked fixture counts, an annotated plan, and an Excel workbook.",
})

const rows = [
  ["L-01", "Recessed LED luminaire", "E-101", "Retail / sales", "64", "ea", "High"],
  ["L-02", "Linear pendant luminaire", "E-101", "Checkout", "12", "ea", "High"],
  ["R-01", "Duplex receptacle", "E-102", "Retail / sales", "58", "ea", "High"],
  ["SW-01", "Single-pole switch", "E-101", "Back of house", "46", "ea", "High"],
  ["FA-01", "Smoke detector", "E-103", "Level 01", "18", "ea", "Medium"],
] as const

export default function SamplePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Sample takeoff"
          title="See how a legend code becomes a traceable count."
          body="This illustrative electrical sample shows the legend, matching placements, workbook structure, and automated validation context. Customer plans and actual outputs remain private."
          primary="Create account"
          secondary="Read accuracy controls"
          secondaryHref="/accuracy"
        />

        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="border bg-white p-5 shadow-lg">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-semibold">E-101 · Lighting plan</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Legend mapped from E-001 · marked output preview
                    </p>
                  </div>
                  <span className="border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Output validated
                  </span>
                </div>
                <div className="relative mt-5 aspect-[4/3] border-2 border-slate-500 blueprint-fine-grid">
                  <div className="absolute left-[34%] top-0 h-full border-l border-slate-500" />
                  <div className="absolute left-0 top-[38%] w-full border-t border-slate-500" />
                  <div className="absolute left-[34%] top-[68%] w-[66%] border-t border-slate-500" />
                  <Marker className="left-[8%] top-[12%]" label="L-01 · 12 ea" />
                  <Marker className="left-[42%] top-[12%]" label="L-02 · 4 ea" />
                  <Marker className="left-[40%] top-[48%]" label="R-01 · 8 ea" tone="amber" />
                  <Marker className="bottom-[7%] right-[7%]" label="SW-01 · 5 ea" tone="green" />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="border p-3">
                    <p className="font-semibold">168</p>
                    <p className="mt-1 text-muted-foreground">
                      Counted placements
                    </p>
                  </div>
                  <div className="border p-3">
                    <p className="font-semibold">168</p>
                    <p className="mt-1 text-muted-foreground">Annotated</p>
                  </div>
                  <div className="border p-3">
                    <p className="font-semibold">0</p>
                    <p className="mt-1 text-muted-foreground">Skipped</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                  Delivery package
                </p>
                <h2 className="mt-3 text-3xl font-semibold">
                  Four layers of reviewability
                </h2>
                <div className="mt-8 space-y-4">
                  {[
                    [FileTextIcon, "Annotated plan PDF", "Every supported placement is marked with its legend code and visible location."],
                    [FileSpreadsheetIcon, "Quantity workbook", "Filterable rows and reconciled summaries by code and plan location."],
                    [FileJsonIcon, "Structured evidence", "Stable unit ID, legend code, page, area, method, confidence, quantity, and geometry."],
                    [CheckCircle2Icon, "Methodology and limitations", "Legend exclusions, ambiguous items, validation metrics, and the automated delivery event."],
                  ].map(([Icon, title, body]) => (
                    <div key={String(title)} className="flex gap-4 border-b pb-4">
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
                Workbook preview
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Legend-coded rows, not an unexplained total
              </h2>
            </div>
            <div className="overflow-x-auto border bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-[#0b1f3a] text-white">
                  <tr>
                    {["Code", "Description", "Sheet", "Area", "Qty", "Unit", "Confidence"].map((header) => (
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
              Use your own readable legend for the real test.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              This page is an illustrative output preview. Create an account,
              buy credits through a pack or subscription, and submit your own
              readable plans for a real takeoff.
            </p>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "mt-7 h-12 px-7")}
            >
              Create account
              <ArrowRightIcon />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
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
