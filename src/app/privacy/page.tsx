import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/privacy",
  title: "Privacy policy",
  description:
    "How Cuadrabot collects, uses, protects, and retains account, billing, and project data.",
})

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy policy" effective="August 10, 2026">
      <PolicySection title="1. Who is responsible">
        <p>
          Cuadrabot is the controller of account, billing, product-usage, and
          support information used to operate this service. The legal operator
          and tax identity are shown on your Checkout screen and invoice. You
          can contact us at{" "}
          <a href="mailto:privacy@cuadrabot.com">privacy@cuadrabot.com</a>.
        </p>
      </PolicySection>
      <PolicySection title="2. Information we process">
        <ul>
          <li>Account details such as name, work email, company, and authentication records.</li>
          <li>Coarse business location such as country, region, and city from your profile or billing data.</li>
          <li>Private project materials, including plan PDFs, scope notes, generated quantities, marked plans, workbooks, and validation records.</li>
          <li>Billing references, subscription state, purchased and consumed credits, invoices, refunds, and disputes. Stripe stores complete payment-card data; Cuadrabot does not.</li>
          <li>Operational events such as uploads, job stages, downloads, support requests, service health, audit records, and security logs.</li>
          <li>With consent, first-party marketing events such as page paths, campaign tags, referring host, random browser and session identifiers, device category, browser and operating-system category, language, timezone, screen-size band, and coarse profile or billing geography when available.</li>
        </ul>
      </PolicySection>
      <PolicySection title="3. Why we process it">
        <p>
          We process data to create and secure accounts; verify, measure, and
          validate plan sets; deliver files; collect payment; manage credits and
          subscriptions; provide support; prevent abuse; monitor reliability;
          improve the product using aggregated operational evidence; and meet
          legal, tax, accounting, and security obligations.
        </p>
        <p>
          Depending on context, our legal bases include performing the service
          contract, legitimate interests in operating and securing the service,
          legal obligations, and consent where required.
        </p>
      </PolicySection>
      <PolicySection title="4. Model and processor use">
        <p>
          Project materials may be sent to contracted infrastructure and
          processing providers solely to provide the takeoff service. Cuadrabot
          does not use customer plans to train its own models without separate,
          explicit consent. Provider handling remains subject to the relevant
          business terms and data-processing commitments.
        </p>
      </PolicySection>
      <PolicySection title="5. Sharing and international transfers">
        <p>
          We use service providers for hosting, database and object storage,
          payment processing, email, monitoring, and automated analysis. We
          disclose only what each provider needs for its role. Where data moves
          outside the EEA, we use an available lawful transfer mechanism, such
          as an adequacy decision or approved contractual safeguards.
        </p>
      </PolicySection>
      <PolicySection title="6. Retention">
        <p>
          Account and billing records are retained while the account is active
          and as required for tax, accounting, dispute, and legal obligations.
          Once an uploaded plan passes verification, its original PDF is kept
          in a private source archive for customer project history, recovery,
          support, and dispute handling while the account is active. The
          archive registry records ownership, file size, page count, and a
          SHA-256 fingerprint. Customers may download their original plan from
          the project workspace and may request deletion subject to identity
          verification and any applicable legal hold.
        </p>
        <p>
          Unverified or abandoned uploads are removed after 24 hours.
          Processor working copies and generated deliverables are removed by a
          scheduled process after the terminal-job retention window has
          elapsed; the current window is available through support. Provider
          recovery copies, when enabled, follow a separate restricted and
          finite lifecycle. Job history, billing, credit, security, and audit
          records may be retained or de-identified for the purposes above. A
          legal hold or other obligation may require longer retention.
        </p>
        <p>
          The board has not yet approved a fixed age-based retention schedule
          for marketing events, so automated age-based deletion is disabled and
          the policy is marked for governance review. This does not override an
          applicable deletion right, withdrawal of consent, legal requirement,
          or documented legal hold. We may aggregate or anonymize older records
          when they no longer need to identify a browser or person.
        </p>
      </PolicySection>
      <PolicySection title="7. Cookies and advertising measurement">
        <p>
          Cuadrabot uses necessary cookies and similar storage for sign-in,
          security, language, consent choices, and core service functions. With
          applicable regional rules require opt-in, we wait for your permission
          before setting first-party random visitor and session IDs and a
          limited campaign-attribution cookie. Elsewhere these optional tools
          may be enabled by default, with a persistent opt-out. These let us
          build an internal marketing-intelligence database from the categories
          listed above. We do not copy arbitrary browser cookies or store raw IP
          addresses, payment details, or uploaded plans in that database.
        </p>
        <p>
          We use a server-side country lookup to choose the applicable consent
          experience. Country.is processes the request IP transiently for that
          lookup and states that it does not log requests. Cuadrabot stores only
          a signed regional classification and coarse country code, not the IP
          address. If the country cannot be resolved, optional storage remains
          opt-in. We also honor supported Global Privacy Control signals as an
          opt-out.
        </p>
        <p>
          The same regional choice controls Google Ads conversion measurement.
          Purchase events sent to Google include the transaction reference,
          currency, and amount confirmed by Stripe, but not full payment-card
          details. Advertising, analytics, ad-user-data, and ad-personalization
          consent are denied by default in opt-in regions until you choose. When denied, Google
          tags may send consent-aware, cookieless measurement signals with ads
          data redaction. When allowed, Google may read or write advertising
          identifiers for measurement. You can reject, allow, or later change
          this choice with the Cookie settings control available throughout the
          site. Reject and allow are presented at the same level. See Google&apos;s{" "}
          <a href="https://policies.google.com/privacy">privacy policy</a> for
          its processing and international-transfer safeguards.
        </p>
      </PolicySection>
      <PolicySection title="8. Your choices and rights">
        <p>
          Depending on your location, you may request access, correction,
          deletion, restriction, portability, or objection, and may withdraw
          consent where processing relies on it. You may also complain to your
          local data-protection authority. Email{" "}
          <a href="mailto:privacy@cuadrabot.com">privacy@cuadrabot.com</a>.
          We may verify identity before acting on a request.
        </p>
      </PolicySection>
      <PolicySection title="9. Security and changes">
        <p>
          We use encrypted transport and provider-managed encryption at rest,
          private storage, tenant-level access rules, short-lived signed
          links, server-only credentials, checksum-backed source records,
          scheduled object-presence checks, audit logs, and restricted
          administrative access. No system is completely secure. We will
          update this policy when processing materially changes and will post
          the new effective date.
        </p>
      </PolicySection>
    </PolicyPage>
  )
}

function PolicyPage({
  title,
  effective,
  children,
}: {
  title: string
  effective: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Legal
            </p>
            <h1 className="mt-3 text-4xl font-semibold">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Effective {effective}
            </p>
          </div>
        </section>
        <article className="policy-copy mx-auto max-w-4xl px-4 py-16 sm:px-6">
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}

function PolicySection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </section>
  )
}
