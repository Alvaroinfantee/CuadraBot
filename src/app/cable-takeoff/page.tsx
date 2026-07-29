import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/cable-takeoff",
  title: "Cable and conduit takeoff from PDF plans",
  description:
    "Self-serve cable and conduit takeoffs when PDF routes are visible, the scale is stated, and legend codes are readable.",
  keywords: [
    "cable takeoff from PDF",
    "conduit takeoff",
    "electrical cable measurement",
    "legend based cable takeoff",
  ],
})

export default function CableTakeoffPage() {
  return (
    <TradeLanding
      eyebrow="Cable and conduit runs"
      title="Traceable run quantities only when the plan shows the route and scale."
      body="Cuadrabot can quantify supported cable and conduit runs when the route is visibly drawn, the applicable legend is readable, and the sheet states a usable scale. Anything unresolved is flagged rather than guessed."
      measured={[
        "Supported visible runs grouped by legend code, system, area, level, and sheet.",
        "Source-linked route evidence and quantities only where the route and stated scale support measurement.",
        "Reconciled totals by code and area with ambiguous endpoints, branches, or scales listed as limitations.",
        "Annotated source PDF, Excel workbook, methodology, confidence, and assumptions.",
      ]}
      assumptions={[
        "A visible route, readable legend or schedule, and stated drawing scale are required for measured runs.",
        "Confirm routing allowances, vertical rises, slack, loops, terminations, waste, and concealed conditions separately.",
        "Single-line diagrams, risers, schematic links, and symbols without defensible route geometry are not converted into lengths by assumption.",
      ]}
    />
  )
}
