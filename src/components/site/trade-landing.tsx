import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  FileTextIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TradeLanding({
  eyebrow,
  title,
  body,
  measured,
  assumptions,
}: {
  eyebrow: string
  title: string
  body: string
  measured: string[]
  assumptions: string[]
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow={eyebrow}
          title={title}
          body={body}
          secondary="View sample output"
        />
        <section className="border-b py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Included measurements
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                A focused launch scope
              </h2>
              <ul className="mt-7 space-y-4">
                {measured.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6">
                    <CheckCircle2Icon className="mt-1 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border bg-[#f5f7fa] p-7">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Confirm before bidding
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Common scope decisions
              </h2>
              <ul className="mt-6 space-y-4 text-sm leading-6 text-muted-foreground">
                {assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section className="border-b bg-[#0b1f3a] py-16 text-white">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
            {[
              [MapPinIcon, "Plan-linked", "Page, area, and visible geometry"],
              [FileTextIcon, "Marked PDF", "Review where quantities came from"],
              [FileSpreadsheetIcon, "Excel output", "Filter and price structured rows"],
              [ShieldCheckIcon, "Validated output", "Automatic checks gate delivery"],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="border-l border-blue-300/40 pl-5">
                <Icon className="size-5 text-blue-300" />
                <h3 className="mt-4 font-semibold">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {String(copy)}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="border-b py-16">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-semibold">
                Published self-serve prices start at $49.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The verified PDF page count and number of launch trades set the
                fixed tier.
              </p>
            </div>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              View complete pricing
              <ArrowRightIcon />
            </Link>
          </div>
        </section>
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
