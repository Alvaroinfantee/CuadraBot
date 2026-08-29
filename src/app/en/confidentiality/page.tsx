import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Confidentiality", alternates: { canonical: "/en/confidentiality", languages: { es: "/confidencialidad", en: "/en/confidentiality" } } }

export default function EnglishConfidentialityPage() { return <LegalPage locale="en" eyebrow="Private plans" title="Confidentiality commitment" intro="Construction documents contain sensitive information. The product is designed to keep them private and isolated between customers." sections={[
  { title: "Required production controls", bullets: ["HTTPS and encryption in transit and at rest where supported by the provider.", "Private storage and short-lived signed download links.", "Project isolation, administrator authentication and server-verified roles.", "Audited downloads and status changes, with expiring sessions.", "No file content in logs and no secrets in source code or the browser."] },
  { title: "Human access", paragraphs: ["Only assigned personnel who need to measure or review the order can access the plans. Internal notes are never customer-visible."] },
  { title: "Deletion", paragraphs: ["Default retention is 90 days after final delivery. Customers may request earlier deletion by emailing privacidad@cuadrabot.com."] },
]}/> }
