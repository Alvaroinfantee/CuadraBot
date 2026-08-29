import { LegalPage } from "@/components/takeoff/legal-page"

export const metadata = { title: "Scope and exclusions", alternates: { canonical: "/en/scope", languages: { es: "/alcance", en: "/en/scope" } } }

export default function EnglishScopePage() { return <LegalPage locale="en" eyebrow="Standard product" title="Scope and exclusions" intro="The customer purchases reviewed quantities and marked evidence, not a complete construction estimate." sections={[
  { title: "Included", bullets: ["One project, up to 20 selected sheets, drywall partitions and gypsum-board ceilings.", "Quantities by floor, drawing and type; Excel workbook, marked PDF and one correction.", "Centreline length, one- and two-sided areas, openings and ceiling perimeters where applicable."] },
  { title: "Not included", bullets: ["Pricing, labour, suppliers or complete procurement lists.", "Studs, tracks, screws, compound, accessories or insulation.", "Demolition, structure, masonry, flooring, paint, MEP, BIM, IFC, CAD, design or site verification.", "Later revisions, curved or complex surfaces unless manually accepted."] },
  { title: "Measurement policy PLADUR-ES-1.0", bullets: ["Centreline length and height from schedules, sections or the customer-supplied value.", "Dimensioned openings deducted from area, retained in length and recorded separately.", "Types remain separate; conflicting revisions are flagged rather than combined.", "Lengths and areas display two decimals while retaining internal precision.", "No quantity is delivered without an identifiable source."] },
]}/> }
