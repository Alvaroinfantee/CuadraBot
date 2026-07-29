import { TradeLanding } from "@/components/site/trade-landing"

export const metadata = {
  title: "Door and window takeoff",
  description:
    "Self-serve door, window, and opening counts from scaled PDF plans.",
}

export default function DoorWindowTakeoffPage() {
  return (
    <TradeLanding
      eyebrow="Doors, windows and openings"
      title="Opening counts with type labels and visible locations."
      body="Capture doors, windows, and supported opening types from plans while preserving the page, visible label, location, and evidence needed to reconcile schedules."
      measured={[
        "Counts by visible door, window, or approved opening type.",
        "Page, level, area, visible label, and plan coordinates for each unit.",
        "Stable identifiers for reconciliation between marked PDF and workbook.",
        "Marked source PDF, Excel workbook, methodology, confidence, and assumptions.",
      ]}
      assumptions={[
        "Confirm hardware sets, frames, glazing, ratings, finishes, and accessories from schedules and specifications.",
        "Confirm whether storefront, curtain wall, louvers, borrowed lights, and specialty assemblies are in scope.",
        "Reconcile plan tags, elevations, schedules, addenda, and alternates before procurement or final bid.",
      ]}
    />
  )
}
