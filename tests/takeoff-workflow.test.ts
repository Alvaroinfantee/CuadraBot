import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import {
  requestedScopesForTrades,
  takeoffWorkflowKind,
} from "../src/lib/takeoff-workflow"

describe("trusted takeoff workflow mapping", () => {
  it("maps selectable legend scopes to the processor contract", () => {
    assert.equal(takeoffWorkflowKind, "legend_fixture_takeoff_v1")
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
    const inputRoute = read("src/app/api/internal/worker/takeoff/jobs/[id]/input/route.ts")
    const workerSubmission = read("worker/src/takeoff.ts")

    assert.match(inputRoute, /requestedScopesForTrades\(job\.trades\)/)
    assert.match(inputRoute, /workflow_kind:\s*takeoffWorkflowKind/)
    assert.match(inputRoute, /requested_scopes:\s*requestedScopes/)
    assert.match(
      inputRoute,
      /customer_instructions:\s*job\.customer_notes\s*\?\?\s*""/
    )
    assert.doesNotMatch(inputRoute, /job\.instructions/)

    assert.match(workerSubmission, /form\.append\("workflowKind", workflowKind\)/)
    assert.match(
      workerSubmission,
      /form\.append\("requestedScopes", scope\)/
    )
    assert.match(
      workerSubmission,
      /form\.append\(\s*"instructions",\s*customerInstructions/
    )
  })
})

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
