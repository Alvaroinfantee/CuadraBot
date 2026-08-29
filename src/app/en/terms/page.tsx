import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Service terms", alternates: { canonical: "/en/terms", languages: { es: "/terminos", en: "/en/terms" } } }

export default function EnglishTermsPage() { return <LegalPage locale="en" eyebrow="Terms" title="Takeoff service terms" intro="Cuadrabot delivers traceable drywall quantities from customer-supplied documents. These terms define the standard €149 + VAT service." sections={[
  { title: "Contracted service", bullets: ["One project and up to 20 selected PDF sheets.", "Drywall partitions and gypsum-board ceilings when ceiling plans exist.", "Quantity workbook, marked PDF, assumptions, exclusions and one correction.", "Two-business-day commitment from payment and receipt of complete information."] },
  { title: "Customer responsibility", paragraphs: ["The customer confirms the right to share the plans, identifies the applicable revision and responds promptly to clarifications. Quantities must be checked before purchasing materials or submitting a binding bid."] },
  { title: "Assumptions, clarifications and timing", paragraphs: ["Unknown conditions are recorded as assumptions or questions. The turnaround may pause while Cuadrabot waits for clarification; the portal will show this explicitly."] },
  { title: "Included correction", paragraphs: ["The correction covers errors against the original plans. New revisions, drawings or added scope require another order or quotation."] },
  { title: "Limits", paragraphs: ["Site conditions are not verified. The customer verification requirement does not reduce Cuadrabot's obligation to deliver a reviewed, coherent and traceable result."] },
]}/> }
