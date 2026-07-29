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

export const metadata = {
  title: "How it works",
  description:
    "How Cuadrabot turns scaled PDF plans into self-serve, source-linked takeoff deliverables.",
}

const stages = [
  ["01", FileUpIcon, "Private upload", "You choose the launch trades, add scope notes, and upload a scaled PDF directly to private object storage."],
  ["02", FileCheck2Icon, "Server verification", "Cuadrabot checks the stored object, PDF signature, password protection, file size, and actual page count."],
  ["03", WalletCardsIcon, "Fixed quote", "The verified scope maps to published credits. Nothing is reserved until you approve it."],
  ["04", ScanSearchIcon, "Automated measurement", "The processing service produces stable unit IDs, locations, quantities, confidence, methodology, workbook, and marked evidence."],
  ["05", ShieldCheckIcon, "Automated validation", "The service checks the source hash, schema, page locations, identifiers, and required artifacts before release."],
  ["06", CheckCircle2Icon, "Automatic delivery", "The marked PDF, Excel workbook, source evidence, and methodology appear in your private workspace as soon as processing completes."],
] as const

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="How it works"
          title="Upload, confirm, and let Cuadrabot do the rest."
          body="The self-serve workflow keeps pricing, credit movement, processing, validation, and delivery as separate auditable stages."
          secondary="See accuracy controls"
          secondaryHref="/accuracy"
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
              ["Quote authority", "Only the server-verified PDF page count can set the published credit tier."],
              ["Processing authority", "The private worker can access only claimed jobs through short-lived signed URLs."],
              ["Delivery authority", "Only a successfully claimed job with validated result artifacts can settle credits and release deliverables."],
            ].map(([title, body]) => (
              <div key={title} className="border-l border-blue-300/40 pl-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </section>
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
