import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  creditPacks,
  getTakeoffPrice,
  subscriptionPlans,
} from "../src/lib/takeoff-pricing"

const flooring = ["flooring_finishes"] as const

describe("takeoff pricing", () => {
  it("grants a zero-credit one-sheet sample only when available", () => {
    const price = getTakeoffPrice({
      mode: "sample",
      pageCount: 1,
      trades: [...flooring],
      freeSampleAvailable: true,
      firstPaidAvailable: true,
    })
    assert.equal(price.tier, "free_sample")
    assert.equal(price.credits, 0)
  })

  it("does not grant a used sample", () => {
    const price = getTakeoffPrice({
      mode: "sample",
      pageCount: 1,
      trades: [...flooring],
      freeSampleAvailable: false,
      firstPaidAvailable: true,
    })
    assert.equal(price.tier, "first_verified")
  })

  it("uses first verified pricing for an eligible first paid job", () => {
    assert.equal(
      getTakeoffPrice({
        mode: "standard",
        pageCount: 5,
        trades: [...flooring],
        freeSampleAvailable: false,
        firstPaidAvailable: true,
      }).credits,
      49
    )
  })

  it("uses essential and professional one-trade tiers", () => {
    assert.equal(
      getTakeoffPrice({
        mode: "standard",
        pageCount: 10,
        trades: [...flooring],
        freeSampleAvailable: false,
        firstPaidAvailable: false,
      }).tier,
      "essential"
    )
    assert.equal(
      getTakeoffPrice({
        mode: "standard",
        pageCount: 25,
        trades: [...flooring],
        freeSampleAvailable: false,
        firstPaidAvailable: false,
      }).tier,
      "professional"
    )
  })

  it("uses multi-trade pricing through 25 pages", () => {
    const price = getTakeoffPrice({
      mode: "standard",
      pageCount: 25,
      trades: [
        "flooring_finishes",
        "drywall_partitions_ceilings",
        "doors_windows_openings",
      ],
      freeSampleAvailable: false,
      firstPaidAvailable: false,
    })
    assert.equal(price.tier, "multi_trade")
    assert.equal(price.credits, 299)
  })

  it("keeps larger supported plan sets self-serve", () => {
    const price = getTakeoffPrice({
      mode: "standard",
      pageCount: 26,
      trades: [...flooring],
      freeSampleAvailable: false,
      firstPaidAvailable: false,
    })
    assert.equal(price.tier, "large_set")
    assert.equal(price.selfServe, true)
    assert.equal(price.turnaroundHours, 8)
  })

  it("keeps the published pack and subscription catalog exact", () => {
    assert.deepEqual(
      creditPacks.map(({ credits, priceCents }) => [credits, priceCents]),
      [
        [550, 50_000],
        [1_800, 150_000],
        [5_000, 400_000],
      ]
    )
    assert.deepEqual(
      subscriptionPlans.map(({ credits, priceCents }) => [
        credits,
        priceCents,
      ]),
      [
        [300, 24_900],
        [780, 59_900],
        [1_650, 119_900],
      ]
    )
  })
})
