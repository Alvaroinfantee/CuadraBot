import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import {
  isTakeoffAnalysisProfile,
  requestedScopesForTrades,
  takeoffAnalysisProfile,
  takeoffWorkflowKind,
} from "../src/lib/takeoff-workflow"

describe("trusted takeoff workflow mapping", () => {
  it("maps selectable legend scopes to the processor contract", () => {
    assert.equal(takeoffWorkflowKind, "legend_fixture_takeoff_v1")
    assert.equal(
      takeoffAnalysisProfile,
      "analyze-building-drawings@2026-08-06"
    )
    assert.equal(isTakeoffAnalysisProfile(takeoffAnalysisProfile), true)
    assert.equal(isTakeoffAnalysisProfile("analyze-building-drawings@latest"), false)
    assert.deepEqual(
      requestedScopesForTrades([
        "fixture_device_counts",
        "cable_conduit_runs",
      ]),
      ["fixture_counts", "cable_runs"]
    )
  })

  it("deduplicates fixture categories and preserves prelaunch legend jobs", () => {
    assert.deepEqual(
      requestedScopesForTrades([
        "fixture_device_counts",
        "fixture_device_counts",
      ]),
      ["fixture_counts"]
    )
    assert.deepEqual(
      requestedScopesForTrades([
        "electrical_fixtures",
        "other_legend_devices",
      ]),
      ["fixture_counts"]
    )
  })

  it("fails closed for missing, obsolete, or unknown scopes", () => {
    assert.throws(() => requestedScopesForTrades([]), /required/)
    assert.throws(
      () => requestedScopesForTrades(["flooring_finishes"]),
      /Unsupported/
    )
    assert.throws(
      () => requestedScopesForTrades(["customer_supplied_scope"]),
      /Unsupported/
    )
  })

  it("keeps trusted workflow scope separate from customer instructions", () => {
    const creationRoute = read("src/app/api/takeoff/jobs/route.ts")
    const inputRoute = read("src/app/api/internal/worker/takeoff/jobs/[id]/input/route.ts")
    const workerIndex = read("worker/src/index.ts")
    const workerSubmission = read("worker/src/takeoff.ts")
    const workerConfig = read("worker/src/config.ts")
    const processorUsageMigration = read(
      "supabase/migrations/20260806120000_takeoff_processor_usage.sql"
    )

    assert.match(
      creationRoute,
      /processor_version:\s*takeoffAnalysisProfile/
    )
    assert.match(
      inputRoute,
      /job\.processor_version\s*!==\s*takeoffAnalysisProfile/
    )
    assert.match(inputRoute, /analysis_profile:\s*takeoffAnalysisProfile/)
    assert.match(inputRoute, /requestedScopesForTrades\(job\.trades\)/)
    assert.match(inputRoute, /workflow_kind:\s*takeoffWorkflowKind/)
    assert.match(inputRoute, /requested_scopes:\s*requestedScopes/)
    assert.match(
      inputRoute,
      /customer_instructions:\s*job\.customer_notes\s*\?\?\s*""/
    )
    assert.doesNotMatch(inputRoute, /job\.instructions/)

    assert.match(
      workerIndex,
      /analysisProfile:\s*input\.job\.analysis_profile/
    )
    assert.match(
      workerSubmission,
      /isTakeoffAnalysisProfile\(analysisProfile\)/
    )
    assert.match(workerSubmission, /form\.append\("workflowKind", workflowKind\)/)
    assert.match(
      workerSubmission,
      /form\.append\("analysisProfile", analysisProfile\)/
    )
    assert.match(
      workerSubmission,
      /form\.append\("requestedScopes", scope\)/
    )
    assert.match(
      workerSubmission,
      /form\.append\(\s*"instructions",\s*customerInstructions/
    )
    assert.match(
      workerConfig,
      /minimumTakeoffJobTimeoutMs\s*=\s*7\s*\*\s*60\s*\*\s*60\s*\*\s*1_000/
    )
    assert.match(
      workerConfig,
      /value\s*<\s*minimumTakeoffJobTimeoutMs/
    )

    const profileBackfill = processorUsageMigration.match(
      /update public\.takeoff_jobs[\s\S]*?trades\s*<@[\s\S]*?;/
    )
    assert.ok(profileBackfill)
    assert.match(profileBackfill[0], /processor_version is null/)
    assert.match(
      profileBackfill[0],
      /processor_version\s*=\s*'analyze-building-drawings@2026-08-06'/
    )
    assert.match(profileBackfill[0], /'fixture_device_counts'/)
    assert.match(profileBackfill[0], /'cable_conduit_runs'/)
    assert.doesNotMatch(profileBackfill[0], /'processing'/)
    assert.doesNotMatch(profileBackfill[0], /'flooring_finishes'/)
  })
})

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
