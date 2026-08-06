import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/terms",
  title: "Terms of service",
  description:
    "Terms governing Cuadrabot accounts, credits, subscriptions, and construction takeoff services.",
})

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Legal
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Terms of service</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Effective July 29, 2026
            </p>
          </div>
        </section>
        <article className="mx-auto max-w-4xl px-4 py-16 text-sm leading-7 text-muted-foreground sm:px-6">
          <Term title="1. The service">
            Cuadrabot provides construction takeoff support from customer
            supplied plans, including automated analysis and validation, marked
            plan evidence, quantity files, assumptions, and related workspace
            tools. It does not provide architecture, engineering, surveying,
            code or permit review, cost advice, or a final bid.
          </Term>
          <Term title="2. Accounts and authority">
            You must provide accurate information, protect credentials, and
            promptly report unauthorized access. If you use Cuadrabot for a
            company, you confirm that you may accept these terms and upload the
            materials on its behalf. We may suspend an account for security,
            nonpayment, unlawful use, or material breach.
          </Term>
          <Term title="3. Customer materials and instructions">
            You retain ownership of uploaded plans and grant Cuadrabot and its
            processors the limited rights needed to privately host, archive,
            process, and deliver the service, including keeping verified source
            plans for project history, recovery, support, and disputes as
            described in the Privacy Policy. You must have permission to
            provide the materials and must not upload malicious, unlawful,
            export-restricted, or third-party-confidential content without
            authority.
          </Term>
          <Term title="4. Scope and verification">
            A fixed quote covers only the selected legend-based scope, verified pages,
            source plan set, and stated assumptions. You are responsible for
            checking outputs against the complete contract documents,
            specifications, schedules, addenda, alternates, and field
            conditions before pricing, procurement, or construction.
          </Term>
          <Term title="5. Credits, packs, and subscriptions">
            Credits are application-use units, not money, stored value, or
            transferable property. Credits do not expire during the launch
            version. Any future expiry policy will be disclosed before purchase
            and applied prospectively. Subscriptions renew until canceled and
            may be canceled at period end through the billing portal. Failed
            payment creates no new credit grant.
          </Term>
          <Term title="6. Delivery and corrections">
            Eligible self-serve scopes are processed automatically and are
            generally delivered in hours after a valid upload and confirmed
            quote. Turnaround is a target, not a guarantee, and can vary with
            plan complexity, queue load, or required customer response. One
            correction is included when requested within 7 days of delivery
            and limited to the approved scope and original plan set. Revisions,
            added scope, or changed documents require a new quote.
          </Term>
          <Term title="7. Acceptable use">
            You may not probe or bypass access controls, submit automated volume
            outside published interfaces, resell access without agreement,
            reverse engineer protected service components, interfere with
            others, or use outputs or systems unlawfully.
          </Term>
          <Term title="8. Availability and changes">
            We may maintain, improve, or discontinue features and may use
            qualified subcontractors. We do not promise uninterrupted service.
            If a system failure prevents a takeoff, reserved credits are
            released; this is separate from delays caused by incomplete,
            illegible, unscaled, or changed customer documents.
          </Term>
          <Term title="9. Disclaimers and liability">
            To the extent allowed by law, the service and outputs are provided
            with reasonable care but without a guarantee that every document,
            scope interpretation, or quantity is error free. Cuadrabot is not
            liable for indirect, consequential, special, or downstream bid,
            procurement, schedule, construction, or profit loss. Aggregate
            liability is limited to the amount paid for the affected service in
            the preceding three months, except where law does not permit that
            limitation.
          </Term>
          <Term title="10. Governing terms and contact">
            Mandatory consumer and data-protection rights remain unaffected.
            These terms are governed by Spanish law, and disputes are subject
            to the courts competent for the Cuadrabot operator, unless
            mandatory law requires another forum. Contact{" "}
            <a href="mailto:support@cuadrabot.com" className="text-primary underline">
              support@cuadrabot.com
            </a>
            .
          </Term>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}

function Term({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-9">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3">{children}</p>
    </section>
  )
}
