import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/drywall-takeoff",
  title: "Drywall and ceiling takeoff",
  description:
    "Self-serve drywall, partition, and ceiling quantities from scaled PDF plans.",
})

export default function DrywallTakeoffPage() {
  return (
    <TradeLanding
      eyebrow="Drywall, partitions and ceilings"
      title="Partition and ceiling quantities that remain tied to the plan."
      body="Measure visible partition runs and ceiling areas with wall-type, area, sheet, and confidence context preserved for review."
      measured={[
        "Partition linear extents by visible type, level, sheet, and area.",
        "Ceiling areas and visible ceiling-type codes within approved scope.",
        "Stable unit identifiers and visible PDF coordinates for each supported quantity.",
        "Marked source PDF, Excel workbook, methodology, confidence, and assumptions.",
      ]}
      assumptions={[
        "Confirm wall heights, layers, board types, shaft walls, fire ratings, insulation, and framing gauges from schedules and sections.",
        "Confirm bulkheads, soffits, curved walls, access panels, clouds, and specialist ceiling systems separately.",
        "Reconcile reflected ceiling plans, partition plans, details, alternates, and addenda before final pricing.",
      ]}
    />
  )
}
