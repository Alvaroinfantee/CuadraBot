import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/refund-policy",
  title: "Refund policy",
  description:
    "Refund terms for Cuadrabot credit packs, subscriptions, and takeoff work.",
})

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Legal
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Refund policy</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Effective July 29, 2026
            </p>
          </div>
        </section>
        <article className="mx-auto max-w-4xl space-y-9 px-4 py-16 text-sm leading-7 text-muted-foreground sm:px-6">
          <Section title="Unused credit packs">
            A full credit-pack refund may be requested within 14 days when none
            of the pack’s credits have been reserved, consumed, transferred,
            expired, or combined into a disputed job. Partial pack refunds are
            not available at launch.
          </Section>
          <Section title="Subscriptions">
            Cancel through the Stripe billing portal to stop renewal at the end
            of the current paid period. We do not normally prorate a started
            period. Mandatory cancellation or withdrawal rights, where
            applicable, remain unaffected.
          </Section>
          <Section title="Takeoff charges">
            Once you confirm a verified quote, credits are reserved for that
            scope. A system failure releases the reservation. Delivered work is
            eligible for the included correction process, not an automatic
            refund, unless Cuadrabot cannot provide the agreed in-scope
            deliverables after a reasonable correction opportunity.
          </Section>
          <Section title="Plan quality and scope">
            Refunds do not apply because a plan is incomplete, unscaled,
            illegible, changed after confirmation, or missing documents needed
            to interpret scope. If we detect those conditions before work
            begins, we may request better files, revise the quote, or release
            the reservation.
          </Section>
          <Section title="Refund process">
            Email{" "}
            <a href="mailto:billing@cuadrabot.com" className="text-primary underline">
              billing@cuadrabot.com
            </a>{" "}
            with the account email, invoice or Checkout reference, and reason.
            Approved refunds return to the original payment method. Original
            credit grants remain in the immutable ledger and receive a
            compensating reversal.
          </Section>
          <Section title="Disputes">
            Please contact us before filing a payment dispute so we can review
            the job evidence and policy. While a dispute is open, related
            unused credits may be frozen and the account may be restricted.
          </Section>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3">{children}</p>
    </section>
  )
}
