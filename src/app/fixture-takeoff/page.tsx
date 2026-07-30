import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/fixture-takeoff",
  title: "Fixture takeoff from PDF legends",
  description:
    "Self-serve fixture and device counts from readable PDF plan legends, delivered in hours with source-linked evidence.",
  keywords: [
    "fixture takeoff",
    "PDF fixture count",
    "legend based takeoff",
    "construction symbol counting",
  ],
})

export default function FixtureTakeoffPage() {
  return (
    <TradeLanding
      eyebrow="Fixture and device takeoff"
      title="Turn a readable PDF legend into source-linked fixture counts."
      body="Cuadrabot uses the applicable legend or schedule as the item catalog, maps supported codes and symbols across eligible plan sheets, and records every installed placement without counting legend samples as real units."
      measured={[
        "Fixture and device placements grouped by visible legend code and description.",
        "Stable unit identifiers with page, sheet, area, level, confidence, and visible PDF geometry.",
        "Reconciled totals by code, area, page, and floor, with unresolved or ambiguous symbols flagged rather than guessed.",
        "Annotated source PDF, Excel workbook, methodology, confidence, and assumptions.",
      ]}
      assumptions={[
        "Provide a readable legend or schedule that defines the codes or symbols in scope.",
        "State the codes, areas, levels, demolition work, alternates, and repeated views to include or exclude.",
        "Cuadrabot does not count legend examples, schedule rows, key plans, or repeated reference views as installed placements.",
      ]}
    />
  )
}
