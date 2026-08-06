export const takeoffWorkflowKind = "legend_fixture_takeoff_v1" as const

export const takeoffAnalysisProfile =
  "analyze-building-drawings@2026-08-06" as const

export type TakeoffAnalysisProfile = typeof takeoffAnalysisProfile

export function isTakeoffAnalysisProfile(
  value: unknown
): value is TakeoffAnalysisProfile {
  return value === takeoffAnalysisProfile
}

export const processorRequestedScopes = [
  "fixture_counts",
  "cable_runs",
] as const

export type ProcessorRequestedScope =
  (typeof processorRequestedScopes)[number]

const fixtureCountTrades = new Set([
  "electrical_fixtures",
  "other_legend_devices",
  "fixture_device_counts",
])

export function requestedScopesForTrades(
  trades: readonly string[]
): ProcessorRequestedScope[] {
  const scopes = new Set<ProcessorRequestedScope>()

  for (const trade of trades) {
    if (fixtureCountTrades.has(trade)) {
      scopes.add("fixture_counts")
      continue
    }
    if (trade === "cable_conduit_runs") {
      scopes.add("cable_runs")
      continue
    }
    throw new Error(`Unsupported takeoff scope: ${trade}`)
  }

  if (!scopes.size) {
    throw new Error("A trusted takeoff scope is required.")
  }

  return processorRequestedScopes.filter((scope) => scopes.has(scope))
}
