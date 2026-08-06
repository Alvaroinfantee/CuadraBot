import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { localizedTradeLabels } from "../src/lib/i18n"
import { takeoffDraftSchema } from "../src/lib/takeoff-schemas"
import {
  legacyTakeoffTrades,
  selectableTakeoffTrades,
  takeoffTrades,
  tradeLabels,
} from "../src/lib/takeoff-types"

const root = process.cwd()

describe("legend-driven takeoff scopes", () => {
  it("offers only processor-distinct scopes while retaining historical labels", () => {
    assert.deepEqual(selectableTakeoffTrades, [
      "fixture_device_counts",
      "cable_conduit_runs",
    ])
    assert.deepEqual(legacyTakeoffTrades, [
      "flooring_finishes",
      "drywall_partitions_ceilings",
      "doors_windows_openings",
      "electrical_fixtures",
      "other_legend_devices",
    ])
    assert.deepEqual(takeoffTrades, [
      ...legacyTakeoffTrades,
      ...selectableTakeoffTrades,
    ])

    for (const scope of takeoffTrades) {
      assert.ok(tradeLabels[scope])
      assert.ok(localizedTradeLabels.en[scope])
      assert.ok(localizedTradeLabels.es[scope])
    }
  })

  it("accepts selectable scopes and rejects historical scopes for new drafts", () => {
    const base = {
      projectName: "Legend test",
      mode: "standard" as const,
      notes: "",
      filename: "electrical.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_048,
    }

    assert.equal(
      takeoffDraftSchema.safeParse({
        ...base,
        trades: [...selectableTakeoffTrades],
      }).success,
      true
    )
    assert.equal(
      takeoffDraftSchema.safeParse({
        ...base,
        trades: ["flooring_finishes"],
      }).success,
      false
    )
  })

  it("publishes replacement landing pages and permanently redirects legacy URLs", () => {
    for (const route of [
      "fixture-takeoff",
      "electrical-takeoff",
      "cable-takeoff",
    ]) {
      assert.equal(existsSync(page(route)), true)
      assert.equal(existsSync(page(`es/${route}`)), true)
    }

    for (const route of [
      "flooring-takeoff",
      "drywall-takeoff",
      "door-window-takeoff",
    ]) {
      assert.equal(existsSync(page(route)), false)
      assert.equal(existsSync(page(`es/${route}`)), false)
    }

    const nextConfig = read("next.config.ts")
    for (const source of [
      "/flooring-takeoff",
      "/drywall-takeoff",
      "/door-window-takeoff",
      "/es/flooring-takeoff",
      "/es/drywall-takeoff",
      "/es/door-window-takeoff",
    ]) {
      assert.match(
        nextConfig,
        new RegExp(`source:\\s*"${source.replaceAll("/", "\\/")}"`)
      )
    }
    assert.equal((nextConfig.match(/permanent:\s*true/g) ?? []).length, 6)
  })

  it("documents cable evidence requirements and a no-guess rule", () => {
    const customerCopy = [
      read("src/app/cable-takeoff/page.tsx"),
      read("src/app/es/cable-takeoff/page.tsx"),
      read("src/lib/takeoff-instructions.ts"),
      read("src/lib/dashboard-i18n.ts"),
    ].join("\n")

    assert.match(customerCopy, /visible route/i)
    assert.match(customerCopy, /stated scale/i)
    assert.match(customerCopy, /flagged rather than guessed/i)
    assert.match(customerCopy, /ruta visible/i)
    assert.match(customerCopy, /escala indicada/i)
    assert.match(customerCopy, /se señalan, no se adivinan/i)
  })
})

function page(route: string) {
  return path.join(root, "src/app", route, "page.tsx")
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8")
}
