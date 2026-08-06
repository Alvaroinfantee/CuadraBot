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
  locale: "en",
  path: "/accuracy",
  title: "Accuracy and validation",
  description:
    "Learn how Cuadrabot maps readable PDF legends, preserves source evidence, and automatically validates takeoff outputs before delivery.",
})

const controls = [
  [RulerIcon, "Legend and input provenance", "The readable legend or schedule, selected scope, source SHA-256, actual page count, and page selection travel with the job."],
  [MapPinIcon, "Visible source location", "Every supported unit includes a page and visible point or bounding box in the defined PDF coordinate system."],
  [BracesIcon, "Stable identifiers", "Unique unit IDs keep workbook rows, structured evidence, and PDF annotations reconcilable."],
  [FileSearchIcon, "Code reconciliation", "Totals reconcile by legend code and location. Legend samples, schedule rows, key plans, and repeated reference views are excluded from installed placements."],
  [ShieldCheckIcon, "Automated release gate", "A job is released only after source, schema, geometry, identifiers, and required artifacts pass validation."],
  [CheckCircle2Icon, "No silent guessing", "Unreadable, conflicting, or unresolved codes and routes are reported as limitations instead of being assigned without evidence."],
] as const

export default function AccuracyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Accuracy and validation"
          title="Every quantity should trace back to a legend code and plan location."
          body="Cuadrabot does not present automation as certainty. It preserves source evidence, confidence, assumptions, and machine-checkable validation, while your team retains final estimating judgment."
          secondary="View sample output"
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
                What we validate
              </p>
              <ul className="mt-6 space-y-4 text-sm leading-6">
                {[
                  "Uploaded object is a readable, non-encrypted PDF.",
                  "The applicable legend or schedule is readable for the selected scope.",
                  "Source SHA and page count match the processing manifest.",
                  "Each unit identifier is unique and has visible geometry.",
                  "Legend samples and duplicate reference views are not counted as installed placements.",
                  "Measured cable or conduit runs have a visible route and a stated usable scale.",
                  "Annotations stay on the declared page and visible bounds.",
                  "Required JSON, workbook, methodology, and marked PDF artifacts exist.",
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
                What still requires your judgment
              </p>
              <ul className="mt-6 space-y-4 text-sm leading-6 text-muted-foreground">
                {[
                  "Contract interpretation, addenda, alternates, and bid scope.",
                  "Resolving symbols or routes that are absent, unreadable, or contradictory in the source documents.",
                  "Waste factors, labor, productivity, means and methods, and pricing.",
                  "Design intent, code compliance, engineering, and permit decisions.",
                  "Final reconciliation against the complete contract document set.",
                ].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
