import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Refund policy", alternates: { canonical: "/en/refunds", languages: { es: "/reembolsos", en: "/en/refunds" } } }

export default function EnglishRefundPage() { return <LegalPage locale="en" eyebrow="One-time payment" title="Refund policy" intro="We want payment handling to be clear before takeoff work begins." sections={[
  { title: "Before work begins", paragraphs: ["If you cancel before the initial review starts, we can issue a full refund. The portal will show the updated status after the payment provider confirms it."] },
  { title: "Project outside scope", paragraphs: ["If we determine after payment that the project does not fit the standard scope and you do not accept an alternative, we will issue a full refund."] },
  { title: "After work begins", paragraphs: ["We first apply the included correction to errors against the original plans. This does not limit any applicable statutory customer or consumer rights."] },
  { title: "How to request a refund", paragraphs: ["Email support@cuadrabot.com with the order number. Refunds return to the original payment method and are recorded for audit."] },
]}/> }
