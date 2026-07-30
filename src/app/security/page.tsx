import {
  ClockIcon,
  DatabaseIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/security",
  title: "Security and privacy",
  description:
    "How Cuadrabot protects customer plans, processing credentials, billing data, and administrative access.",
})

const measures = [
  [LockKeyholeIcon, "Private storage", "Original plans and deliverables live in private buckets. Source downloads use ownership-checked links that expire after five minutes."],
  [KeyRoundIcon, "Short-lived access", "Workers and customers receive signed URLs for a limited purpose and time; buckets are never public."],
  [EyeOffIcon, "Server-only secrets", "Stripe, Supabase service, worker, and processing credentials never use public browser variables."],
  [DatabaseIcon, "Tenant data controls", "Customer reads are limited by row-level security. Trusted service writes use narrowly scoped server code and audited RPCs."],
  [ShieldCheckIcon, "Verified administration", "Admin access requires an authenticated profile role; sensitive changes are recorded in the audit log."],
  [ClockIcon, "Archive and retention", "Verified originals have a checksum-backed database record and protected source archive. Generated files, account closure, and deletion requests follow separate controls."],
] as const

export default function SecurityPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Security and privacy"
          title="Your plans are customer data, not public content."
          body="Cuadrabot separates browser access, application authority, processing credentials, and administrative controls around private project files."
          secondary="Read privacy policy"
          secondaryHref="/privacy"
        />
        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {measures.map(([Icon, title, body]) => (
                <article key={String(title)} className="border p-7">
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
        <section className="border-b bg-[#0b1f3a] py-16 text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">Data-use commitment</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="border-l border-blue-300/50 pl-5">
                <h3 className="font-semibold">Service use</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Plans are processed to provide the ordered takeoff, operate
                  validation, deliver files, resolve support, prevent abuse,
                  and meet legal obligations.
                </p>
              </div>
              <div className="border-l border-blue-300/50 pl-5">
                <h3 className="font-semibold">No silent model training</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Cuadrabot does not use customer plans to train its own models
                  without separate, explicit consent.
                </p>
              </div>
            </div>
          </div>
        </section>
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
