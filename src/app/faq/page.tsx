import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/faq",
  title: "Frequently asked questions",
  description:
    "Answers about Cuadrabot legend-driven fixture, device, cable and conduit takeoffs, pricing, accuracy, privacy, and support.",
})

const sections = [
  {
    title: "Service and scope",
    questions: [
      ["What does Cuadrabot count?", "The self-serve workflow covers electrical and lighting fixtures, supported cable or conduit runs, and other installed devices defined by a readable legend or schedule."],
      ["What plan files work best?", "Use a readable, non-password-protected PDF up to 25MB and 250 pages with the applicable legend or schedule. Pure fixture counts do not require scale; measured cable or conduit runs require both a visible route and a stated usable scale."],
      ["Does Cuadrabot count symbols inside the legend?", "No. The legend is used as the item catalog. Legend samples, schedule rows, key plans, and repeated reference views are excluded from installed-placement totals."],
      ["What happens when a code or route is ambiguous?", "Unreadable, conflicting, missing, or unresolved codes and routes are reported as limitations rather than guessed. Your team decides how to resolve them against the complete contract documents."],
      ["Can Cuadrabot measure cable or conduit runs?", "Only when the route is visibly drawn, the applicable legend is readable, and the sheet states a usable scale. Schematic links or symbols without defensible route geometry are not converted into lengths by assumption."],
      ["Is this a final bid?", "No. Cuadrabot provides takeoff support and reviewable source evidence. Your estimator remains responsible for contract interpretation, waste, pricing, labor, alternates, bid decisions, and final verification."],
      ["What is included at delivery?", "A marked source PDF, an Excel quantity workbook with totals by legend code and location, structured source evidence, methodology and limitations, and one in-scope correction request."],
    ],
  },
  {
    title: "Pricing and credits",
    questions: [
      ["How is the price decided?", "The server verifies the actual uploaded PDF and page count, then applies the published scope tiers. Browser-supplied page counts, prices, and credit amounts are never trusted."],
      ["Do takeoffs require credits?", "The first one-sheet trial is free: $0, no card, one legend-based scope, once per user. Paid takeoffs use credits through a reusable pack or a subscription with monthly credits. There is no seat license or unlimited plan."],
      ["When are credits charged?", "Credits are reserved when you approve the verified quote and settled after delivery. A system failure releases the reservation."],
      ["Do credits expire?", "Credits do not expire during the launch version. If an expiry policy is introduced later, it will apply prospectively and will be shown before purchase."],
    ],
  },
  {
    title: "Accuracy, privacy, and support",
    questions: [
      ["Is the workflow self-serve?", "Yes. Upload, quote confirmation, measurement, validation, credit settlement, and delivery are automated. Admin tools are limited to account support, correction requests, and operational exceptions."],
      ["How do I check a quantity?", "Each supported unit carries its legend code, stable identifier, page, sheet or area context, method, confidence, and visible coordinates or bounding box. The marked PDF and workbook preserve that trace."],
      ["Are plans used to train models?", "Not by Cuadrabot without your explicit consent. Plans are processed only to provide the service. Verified originals are kept in a private, checksum-backed source archive and generated files follow the published retention controls."],
      ["How long is my original plan kept?", "A verified original stays in your private source archive while your account is active so you can retrieve it for project history, recovery, support, or a dispute. You can request deletion, subject to identity verification and any legal hold. Unverified uploads are removed after 24 hours."],
      ["Is source archive storage unlimited?", "No. Without a current qualifying subscription or a fulfilled, non-refunded credit-pack purchase, an account can retain up to 25 verified plans or 512 MiB. Qualifying paid-capacity accounts can retain up to 500 plans or 20 GiB. Existing plans are never silently removed when a limit is reached; contact support to review the account."],
      ["What does the included correction cover?", "One request that stays within the approved legend-based scope and the originally uploaded plan set. Scope additions, new revisions, or design changes require a new quote."],
    ],
  },
] as const

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="FAQ"
          title="Straight answers before you upload."
          body="Scope, pricing, evidence, privacy, and what Cuadrabot does—and does not—take responsibility for."
          secondary="View pricing"
          secondaryHref="/pricing"
        />
        <section className="py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Help center
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Still need a specific answer?
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Email{" "}
                <a
                  href="mailto:support@cuadrabot.com"
                  className="font-medium text-primary"
                >
                  support@cuadrabot.com
                </a>{" "}
                with the takeoff category, approximate page count, and
                deadline. Do not
                attach confidential plans to email.
              </p>
            </div>
            <div className="space-y-10">
              {sections.map((section) => (
                <div key={section.title}>
                  <h3 className="border-b pb-3 text-lg font-semibold">
                    {section.title}
                  </h3>
                  <Accordion>
                    {section.questions.map(([question, answer]) => (
                      <AccordionItem key={question} value={question}>
                        <AccordionTrigger>{question}</AccordionTrigger>
                        <AccordionContent>
                          <p className="leading-6 text-muted-foreground">
                            {answer}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </div>
        </section>
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
