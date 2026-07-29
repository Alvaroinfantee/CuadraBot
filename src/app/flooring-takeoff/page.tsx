import { TradeLanding } from "@/components/site/trade-landing"
import { buildLocalizedMetadata } from "@/lib/i18n"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/flooring-takeoff",
  title: "Flooring and finishes takeoff",
  description:
    "Self-serve flooring and finishes quantities from scaled PDF plans.",
})

export default function FlooringTakeoffPage() {
  return (
    <TradeLanding
      eyebrow="Flooring and finishes"
      title="Flooring takeoffs with room-level plan evidence."
      body="Turn finish plans and scaled floor plans into marked areas, perimeters, codes, and structured quantities that an estimator can review."
      measured={[
        "Floor finish areas by visible code, room, area, level, and sheet.",
        "Perimeters or linear extents where the approved scope calls for them.",
        "Stable unit identifiers and visible PDF coordinates for each supported quantity.",
        "Marked source PDF, Excel workbook, methodology, confidence, and assumptions.",
      ]}
      assumptions={[
        "Confirm whether waste, attic stock, thresholds, transitions, base, and trims belong in the bid quantity.",
        "Confirm demolition, floor preparation, leveling, moisture mitigation, and substrate work separately.",
        "Reconcile finish legends, room finish schedules, alternates, and addenda against the complete contract documents.",
      ]}
    />
  )
}
