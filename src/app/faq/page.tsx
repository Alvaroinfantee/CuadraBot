import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CtaBand, PageHero } from "@/components/site/page-hero"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"

export const metadata = { title: "Frequently asked questions" }

const sections = [
  {
    title: "Service and scope",
    questions: [
      ["What does Cuadrabot count?", "The self-serve launch covers flooring and finishes, drywall/partitions/ceilings, and doors/windows/openings. Files outside those supported trades are not accepted in the launch version."],
      ["What plan files do you accept?", "The self-serve workflow accepts a scaled, non-password-protected PDF up to 100MB and 250 pages. Sets above 25 pages use the fixed Large Set tier."],
      ["Is this a final bid?", "No. Cuadrabot provides takeoff support and reviewable source evidence. Your estimator remains responsible for contract interpretation, waste, pricing, labor, alternates, bid decisions, and final verification."],
      ["What is included at delivery?", "A marked source PDF, an Excel quantity workbook, structured source evidence, methodology and assumptions, and one in-scope correction request."],
    ],
  },
  {
    title: "Pricing and credits",
    questions: [
      ["How is the price decided?", "The server verifies the actual uploaded PDF and page count, then applies the published scope tiers. Browser-supplied page counts, prices, and credit amounts are never trusted."],
      ["Do I need a subscription?", "No. You can buy a reusable credit pack, subscribe for monthly credits, or start with one free sheet. There is no seat license and no unlimited plan."],
      ["When are credits charged?", "Credits are reserved when you approve the verified quote and settled after delivery. A system failure releases the reservation."],
      ["Do credits expire?", "Credits do not expire during the launch version. If an expiry policy is introduced later, it will apply prospectively and will be shown before purchase."],
    ],
  },
  {
    title: "Accuracy, privacy, and support",
    questions: [
      ["Is the workflow self-serve?", "Yes. Upload, quote confirmation, measurement, validation, credit settlement, and delivery are automated. Admin review is reserved for correction requests and operational exceptions."],
      ["How do I check a quantity?", "Each supported unit carries a stable identifier, page, sheet/area context, method, confidence, and visible coordinates or bounding box. The marked PDF and workbook preserve that trace."],
      ["Are plans used to train models?", "Not by Cuadrabot without your explicit consent. Plans are processed to provide the ordered service and are stored privately with access controls and retention settings."],
      ["What does the included correction cover?", "One request that stays within the approved trade scope and the originally uploaded plan set. Scope additions, new revisions, or design changes require a new quote."],
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
                with the trade, approximate page count, and deadline. Do not
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
