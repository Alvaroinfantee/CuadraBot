import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/electrical-takeoff",
  title: "Electrical fixture takeoff from PDF plans",
  description:
    "Count legend-coded electrical and lighting fixtures from PDF plans in hours with marked evidence and Excel quantities.",
  keywords: [
    "electrical fixture takeoff",
    "lighting fixture count",
    "electrical symbol counting",
    "PDF electrical takeoff",
  ],
})

export default function ElectricalTakeoffPage() {
  return (
    <TradeLanding
      eyebrow="Electrical and lighting fixtures"
      title="Electrical fixture counts that stay tied to the drawing."
      body="Map readable electrical legends to supported luminaires, devices, equipment, and other installed symbols while preserving every counted placement for review."
      measured={[
        "Legend-coded lighting fixtures, electrical devices, and supported equipment placements.",
        "Visible code, description, sheet, area, level, and source coordinates for every unit.",
        "Totals reconciled by code and plan location, with legend samples and duplicate reference views excluded.",
        "Annotated source PDF, Excel workbook, methodology, confidence, and assumptions.",
      ]}
      assumptions={[
        "Confirm the applicable electrical legend, schedules, plan revisions, addenda, and alternates.",
        "State whether demolition, existing-to-remain items, temporary work, and owner-furnished equipment belong in scope.",
        "Unresolved, conflicting, or unreadable symbols are reported as limitations instead of being silently assigned to a code.",
      ]}
    />
  )
}
