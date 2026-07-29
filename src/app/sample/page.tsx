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
  title: "Sample takeoff",
  description:
    "Preview the marked PDF, workbook structure, evidence, and validation context delivered by Cuadrabot.",
})

const rows = [
  ["FL-03", "Porcelain tile, 600x600", "A-201", "Retail / sales", "42.60", "m²", "High"],
  ["FL-05", "Carpet tile", "A-201", "Office 104", "28.15", "m²", "High"],
  ["PT-01", "100mm metal stud partition", "A-201", "Core / corridor", "18.40", "lm", "Medium"],
  ["D-02", "900mm single leaf door", "A-201", "East suite", "3", "ea", "High"],
  ["W-04", "Fixed glazed opening", "A-202", "North elevation", "6", "ea", "High"],
] as const

export default function SamplePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Sample takeoff"
          title="See the evidence behind the number."
          body="This illustrative sample shows the structure of a delivered package. Customer plans and actual outputs remain private to their workspace."
          primary="Create a free sample"
          secondary="Read accuracy controls"
          secondaryHref="/accuracy"
        />

        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="border bg-white p-5 shadow-lg">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-semibold">A-201 · Level 01 plan</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Marked output preview · scale 1:100
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
                  <Marker className="left-[8%] top-[12%]" label="FL-03 · 42.60 m²" />
                  <Marker className="left-[42%] top-[12%]" label="FL-05 · 28.15 m²" />
                  <Marker className="left-[40%] top-[48%]" label="PT-01 · 18.40 lm" tone="amber" />
                  <Marker className="bottom-[7%] right-[7%]" label="D-02 · 3 ea" tone="green" />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="border p-3">
                    <p className="font-semibold">168</p>
                    <p className="mt-1 text-muted-foreground">Counted units</p>
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
                    [FileTextIcon, "Annotated plan PDF", "Visible labels and locations on the original sheet."],
                    [FileSpreadsheetIcon, "Quantity workbook", "Filterable rows and summaries for estimating workflows."],
                    [FileJsonIcon, "Structured evidence", "Stable unit ID, page, area, method, confidence, quantity, and geometry."],
                    [CheckCircle2Icon, "Methodology and validation", "Scope assumptions, validation metrics, and the automated delivery event."],
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
                Structured rows, not an unexplained total
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
            <h2 className="text-3xl font-semibold">Use your own plan for the real test.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Your company receives one free sheet and one launch trade, with
              the same private storage and automated validation gate.
            </p>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "mt-7 h-12 px-7")}
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
