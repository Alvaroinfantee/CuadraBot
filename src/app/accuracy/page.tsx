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

export const metadata = {
  title: "Accuracy and validation",
  description:
    "Learn how Cuadrabot preserves plan evidence and validates self-serve outputs before delivery.",
}

const controls = [
  [RulerIcon, "Input provenance", "SHA-256, actual PDF page count, page selection, and verified source metadata travel with the job."],
  [MapPinIcon, "Visible source location", "Every supported unit includes a page and visible point or bounding box in the defined PDF coordinate system."],
  [BracesIcon, "Stable identifiers", "Unique unit IDs keep workbook rows, structured evidence, and PDF annotations reconcilable."],
  [FileSearchIcon, "Output validation", "The service rejects malformed schema, mismatched source hashes, duplicate IDs, invalid pages, and missing geometry."],
  [ShieldCheckIcon, "Automated release gate", "A job is released only after source, schema, geometry, identifiers, and required artifacts pass validation."],
  [CheckCircle2Icon, "Correction path", "One in-scope correction request is included, with the original output and event history retained for audit."],
] as const

export default function AccuracyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Accuracy and validation"
          title="A quantity should be easy to trace, challenge, and correct."
          body="Cuadrabot does not present automation as certainty. It preserves evidence, confidence, assumptions, and machine-checkable validation, while your team retains final estimating judgment."
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
                  "Source SHA and page count match the processing manifest.",
                  "Each unit identifier is unique and has visible geometry.",
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
