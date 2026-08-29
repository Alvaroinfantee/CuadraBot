import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Privacy", alternates: { canonical: "/en/privacy", languages: { es: "/privacidad", en: "/en/privacy" } } }

export default function EnglishPrivacyPage() { return <LegalPage locale="en" eyebrow="Personal data" title="Privacy policy" intro="We process only the data needed to create, charge for, complete and deliver an order, handle corrections and measure campaign effectiveness." sections={[
  { title: "Data processed", bullets: ["Work email, company, project, location and scope answers.", "Billing details and payment status handled by the secure payment provider.", "Attribution: gclid, UTM parameters, path, referrer, session, date, device and country.", "Messages, status history, audit events and correction or deletion requests."] },
  { title: "Purpose and legal basis", paragraphs: ["We use the data to perform the contract, meet legal obligations, protect the service and, subject to the applicable consent configuration, measure Google Ads conversions."] },
  { title: "Retention", paragraphs: ["Plans and deliverables are deleted by default 90 days after final delivery unless a legal obligation, open incident or earlier request applies. Tax records are retained for the legally required periods."] },
  { title: "Rights", paragraphs: ["You can request access, correction, deletion, restriction or objection by emailing privacidad@cuadrabot.com."] },
]}/> }
