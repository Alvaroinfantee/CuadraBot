import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  BUDGET_PROFILES,
  estimateRequestInputTokens,
  forceBoundedImageDetail,
} from "../src/budget-policy.mjs"
import { createEgressConfig } from "../src/egress-config.mjs"
import { AtomicJsonState } from "../src/state.mjs"
import { TokenRegistry, validateTokenState } from "../src/token-registry.mjs"

const MODEL = "gpt-5.6-sol"
const SAFETY_ID = `cb_${"b".repeat(48)}`

test("egress memory and concurrency defaults are hard-bounded", () => {
  const environment = {
    OPENAI_API_KEY: "fixture-master-credential-123456789",
    EGRESS_CONTROL_TOKEN: "fixture-control-credential-123456789",
  }
  const config = createEgressConfig(environment)
  assert.equal(config.maxRequestBytes, 16 * 1024 * 1024)
  assert.equal(config.maxResponseBytes, 16 * 1024 * 1024)
  assert.equal(config.maxInFlightRequests, 1)
  assert.equal(config.maxInFlightRequestsPerToken, 1)
  assert.throws(
    () =>
      createEgressConfig({
        ...environment,
        EGRESS_MAX_REQUEST_BYTES: String(64 * 1024 * 1024),
      }),
    /hard safety limit/i
  )
})

test("trusted pricing classes enforce conservative source-job USD ceilings atomically", async (t) => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(BUDGET_PROFILES).map(([name, value]) => [
        name,
        value.maxCostMicros,
      ])
    ),
    {
      free_sample: 20_000_000,
      first_verified: 10_000_000,
      essential: 20_000_000,
      professional: 35_000_000,
      multi_trade: 60_000_000,
      large_set: 100_000_000,
    }
  )

  const fixture = await registryFixture(t)
  const free = await fixture.registry.register(registration("free_sample"))
  const admitted = await fixture.registry.authorizeAndReserve(free.token, MODEL, {
    requestBytes: 1_000,
    estimatedInputTokens: 100_000,
    maxOutputTokens: 1_000,
  })
  const freeRecord = fixture.state.snapshot().tokens[free.tokenId]
  assert.ok(admitted.reservedCostMicros <= BUDGET_PROFILES.free_sample.maxCostMicros)
  assert.equal(admitted.reservedCostMicros, 2_590_000)
  assert.equal(admitted.serviceTier, "priority")
  assert.equal(
    freeRecord.reservations[admitted.reservationId].costMicros,
    admitted.reservedCostMicros
  )
  await fixture.registry.releaseReservation(free.tokenId, admitted.reservationId)

  await assert.rejects(
    fixture.registry.authorizeAndReserve(free.token, MODEL, {
      requestBytes: 1_000,
      estimatedInputTokens: 800_000,
      maxOutputTokens: 1,
    }),
    /USD cost budget/i
  )

  const paid = await fixture.registry.register(
    registration("large_set", "e".repeat(64))
  )
  const paidReservation = await fixture.registry.authorizeAndReserve(
    paid.token,
    MODEL,
    {
      requestBytes: 1_000,
      estimatedInputTokens: 500_000,
      maxOutputTokens: 1,
    }
  )
  assert.ok(
    paidReservation.reservedCostMicros <=
      BUDGET_PROFILES.large_set.maxCostMicros
  )

  await assert.rejects(
    fixture.registry.register(registration("customer_selected")),
    /budget class/i
  )
  assert.throws(
    () =>
      new TokenRegistry(fixture.state, {
        allowedModels: ["unpriced-model"],
      }),
    /cost rate/i
  )
})

test("base64 plan images use a bounded vision allowance, not text-byte pricing", () => {
  const decodedBytes = 1024 * 1024
  const planImage = Buffer.alloc(decodedBytes, 7)
  Buffer.from("89504e470d0a1a0a", "hex").copy(planImage, 0)
  planImage.writeUInt32BE(13, 8)
  planImage.write("IHDR", 12, "ascii")
  planImage.writeUInt32BE(6_000, 16)
  planImage.writeUInt32BE(4_000, 20)
  const imageUrl = `data:image/png;base64,${planImage.toString("base64")}`
  const body = {
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Count the electrical fixtures." },
          { type: "input_image", image_url: imageUrl, detail: "high" },
        ],
      },
    ],
  }
  const rawBytes = Buffer.byteLength(JSON.stringify(body))
  forceBoundedImageDetail(body)
  const estimate = estimateRequestInputTokens(body, rawBytes)

  assert.equal(estimate.imageCount, 1)
  assert.ok(rawBytes > 1_300_000)
  assert.equal(estimate.reservedImageTokens, 94_000)
  assert.ok(estimate.estimatedInputTokens >= 94_000)
  assert.ok(estimate.estimatedInputTokens < 96_000)
  assert.throws(
    () =>
      estimateRequestInputTokens(
        {
          input: [
            {
              type: "input_image",
              image_url: "https://example.com/plan.png",
              detail: "high",
            },
          ],
        },
        100
      ),
    /canonical base64 data images/i
  )
})

test("usage above its reservation fails closed and survives a registry restart", async (t) => {
  const fixture = await registryFixture(t)
  const credential = await fixture.registry.register(registration("essential"))
  const reservation = await fixture.registry.authorizeAndReserve(
    credential.token,
    MODEL,
    {
      requestBytes: 100,
      estimatedInputTokens: 100,
      maxOutputTokens: 10,
    }
  )
  await fixture.registry.recordUsage(
    credential.tokenId,
    reservation.reservationId,
    { input_tokens: 1_000, output_tokens: 10 }
  )
  const record = fixture.state.snapshot().tokens[credential.tokenId]
  assert.equal(record.accountingFailed, true)
  assert.ok(record.spentCostMicros > reservation.reservedCostMicros)

  const restartedState = await new AtomicJsonState(fixture.stateFile, {
    initialState: { version: 1, tokens: {}, ledgers: {} },
    validate: validateTokenState,
  }).init()
  const restarted = new TokenRegistry(restartedState, {
    allowedModels: [MODEL],
  })
  await assert.rejects(
    restarted.authorizeAndReserve(credential.token, MODEL, {
      requestBytes: 1,
      estimatedInputTokens: 1,
      maxOutputTokens: 1,
    }),
    /unsettled cost reservation/i
  )
  assert.equal(JSON.stringify(restartedState.snapshot()).includes("cbe_"), false)
  await restarted.revoke(credential.tokenId)
  const retry = await restarted.register({
    ...registration("essential"),
    jobId: "execution-accounting-retry",
  })
  await assert.rejects(
    restarted.authorizeAndReserve(retry.token, MODEL, {
      requestBytes: 1,
      estimatedInputTokens: 1,
      maxOutputTokens: 1,
    }),
    /ledger failed accounting/i
  )
})

test("source-job budget survives token revocation and a new worker attempt", async (t) => {
  const fixture = await registryFixture(t)
  const first = await fixture.registry.register(registration("free_sample"))
  const uncertain = await fixture.registry.authorizeAndReserve(
    first.token,
    MODEL,
    {
      requestBytes: 1_000,
      estimatedInputTokens: 300_000,
      maxOutputTokens: 1_000,
    }
  )
  assert.equal(uncertain.reservedCostMicros, 7_590_000)
  await fixture.registry.recordUsage(first.tokenId, uncertain.reservationId, {
    input_tokens: 300_000,
    output_tokens: 1_000,
  })
  await fixture.registry.revoke(first.tokenId)

  const ledger = fixture.state.snapshot().ledgers["d".repeat(64)]
  assert.equal(ledger.spentCostMicros, uncertain.reservedCostMicros)
  assert.equal(ledger.reservedCostMicros, 0)
  assert.equal(ledger.accountingFailed, false)

  const retry = await fixture.registry.register({
    ...registration("free_sample"),
    jobId: "execution-budget-retry",
  })
  await assert.rejects(
    fixture.registry.authorizeAndReserve(retry.token, MODEL, {
      requestBytes: 1_000,
      estimatedInputTokens: 500_000,
      maxOutputTokens: 1_000,
    }),
    /USD cost budget/i
  )
})

test("authorization expiry cleanup conservatively settles an in-flight reservation", async (t) => {
  let now = 1_000_000
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "cuadrabot-expiry-test-")
  )
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const state = await new AtomicJsonState(path.join(directory, "tokens.json"), {
    initialState: { version: 1, tokens: {}, ledgers: {} },
    validate: validateTokenState,
  }).init()
  const registry = new TokenRegistry(state, {
    allowedModels: [MODEL],
    clock: () => now,
  })
  const credential = await registry.register({
    ...registration("essential", "e".repeat(64)),
    expiresAt: now + 100,
  })
  const reservation = await registry.authorizeAndReserve(
    credential.token,
    MODEL,
    {
      requestBytes: 100,
      estimatedInputTokens: 100,
      maxOutputTokens: 10,
    }
  )

  now += 101
  await assert.rejects(
    registry.authorizeAndReserve(credential.token, MODEL, {
      requestBytes: 1,
      estimatedInputTokens: 1,
      maxOutputTokens: 1,
    }),
    /unauthorized/i
  )

  const persisted = state.snapshot()
  assert.equal(persisted.tokens[credential.tokenId], undefined)
  assert.equal(persisted.ledgers["e".repeat(64)].reservedCostMicros, 0)
  assert.equal(
    persisted.ledgers["e".repeat(64)].spentCostMicros,
    reservation.reservedCostMicros
  )
  assert.equal(persisted.ledgers["e".repeat(64)].accountingFailed, true)
})

async function registryFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cuadrabot-budget-test-"))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const stateFile = path.join(directory, "tokens.json")
  const state = await new AtomicJsonState(stateFile, {
    initialState: { version: 1, tokens: {}, ledgers: {} },
    validate: validateTokenState,
  }).init()
  const registry = new TokenRegistry(state, { allowedModels: [MODEL] })
  return { stateFile, state, registry }
}

function registration(budgetClass, ledgerId = "d".repeat(64)) {
  return {
    jobId: "execution-budget-test",
    ledgerId,
    models: [MODEL],
    budgetClass,
    safetyIdentifier: SAFETY_ID,
    expiresAt: Date.now() + 60_000,
  }
}
