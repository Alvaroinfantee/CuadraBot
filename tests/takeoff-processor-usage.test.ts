import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  parseTakeoffProcessorUsage,
  summarizeTakeoffProcessorUsage,
  type TakeoffProcessorUsage,
  type TakeoffProcessorUsageRow,
} from "../src/lib/takeoff-processor-usage"

const validUsage = {
  schema_version: 1 as const,
  provider: "openai" as const,
  model: "gpt-5.6-sol" as const,
  pricing_as_of: "2026-08-06",
  currency: "USD" as const,
  usage_turns: 1,
  input_tokens: 100_000,
  uncached_input_tokens: 70_000,
  cached_input_tokens: 20_000,
  cache_write_tokens: 10_000,
  output_tokens: 5_000,
  reasoning_output_tokens: 1_000,
  estimated_cost_usd: 0.5725,
  estimated_cost_usd_upper_bound: null,
  estimated_cost_usd_all_input_uncached: 0.65,
  estimated_cost_usd_all_input_uncached_upper_bound: null,
  long_context_pricing_may_apply: false,
  rate_snapshot_usd_per_million: {
    input: 5,
    cached_input: 0.5,
    cache_write: 6.25,
    output: 30,
  },
}

test("accepts reconciled, versioned processor usage", () => {
  const parsed = parseTakeoffProcessorUsage(validUsage)

  assert.equal(parsed.success, true)
})

test("accepts each canonical GPT-5.6 takeoff rate snapshot", () => {
  const variants = [
    {
      model: "gpt-5.6-terra" as const,
      estimated_cost_usd: 0.229,
      estimated_cost_usd_all_input_uncached: 0.26,
      rate_snapshot_usd_per_million: {
        input: 2,
        cached_input: 0.2,
        cache_write: 2.5,
        output: 12,
      },
    },
    {
      model: "gpt-5.6-luna" as const,
      estimated_cost_usd: 0.0229,
      estimated_cost_usd_all_input_uncached: 0.026,
      rate_snapshot_usd_per_million: {
        input: 0.2,
        cached_input: 0.02,
        cache_write: 0.25,
        output: 1.2,
      },
    },
  ]

  for (const variant of variants) {
    assert.equal(
      parseTakeoffProcessorUsage({ ...validUsage, ...variant }).success,
      true
    )
  }
})

test("accepts current standard and priority pricing snapshots", () => {
  const currentStandard = {
    ...validUsage,
    pricing_as_of: "2026-08-13",
  }
  const currentPriority = {
    ...validUsage,
    pricing_as_of: "2026-08-13",
    estimated_cost_usd: 1.145,
    estimated_cost_usd_all_input_uncached: 1.3,
    rate_snapshot_usd_per_million: {
      input: 10,
      cached_input: 1,
      cache_write: 12.5,
      output: 60,
    },
  }

  assert.equal(parseTakeoffProcessorUsage(currentStandard).success, true)
  assert.equal(parseTakeoffProcessorUsage(currentPriority).success, true)
  assert.equal(
    parseTakeoffProcessorUsage({
      ...currentPriority,
      rate_snapshot_usd_per_million: {
        ...currentPriority.rate_snapshot_usd_per_million,
        output: 30,
      },
    }).success,
    false
  )
})

test("accepts the processor's half-up eight-decimal cost rounding", () => {
  assert.equal(
    parseTakeoffProcessorUsage({
      ...validUsage,
      model: "gpt-5.6-terra",
      input_tokens: 1,
      uncached_input_tokens: 0,
      cached_input_tokens: 0,
      cache_write_tokens: 1,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      estimated_cost_usd: 0.0000025,
      estimated_cost_usd_all_input_uncached: 0.000002,
      rate_snapshot_usd_per_million: {
        input: 2,
        cached_input: 0.2,
        cache_write: 2.5,
        output: 12,
      },
    }).success,
    true
  )
})

test("rejects inconsistent token categories and cost ranges", () => {
  assert.equal(
    parseTakeoffProcessorUsage({
      ...validUsage,
      uncached_input_tokens: 69_999,
    }).success,
    false
  )
  assert.equal(
    parseTakeoffProcessorUsage({
      ...validUsage,
      long_context_pricing_may_apply: true,
    }).success,
    false
  )
  assert.equal(
    parseTakeoffProcessorUsage({
      ...validUsage,
      reasoning_output_tokens: validUsage.output_tokens + 1,
    }).success,
    false
  )
})

test("rejects forged pricing snapshots and unreconciled costs", () => {
  assert.equal(
    parseTakeoffProcessorUsage({
      ...validUsage,
      estimated_cost_usd: 0,
    }).success,
    false
  )
  assert.equal(
    parseTakeoffProcessorUsage({
      ...validUsage,
      estimated_cost_usd_all_input_uncached: 0,
    }).success,
    false
  )
  assert.equal(
    parseTakeoffProcessorUsage({
      ...validUsage,
      rate_snapshot_usd_per_million: {
        ...validUsage.rate_snapshot_usd_per_million,
        input: 999,
      },
    }).success,
    false
  )
  assert.equal(
    parseTakeoffProcessorUsage({
      ...validUsage,
      pricing_as_of: "2026-08-05",
    }).success,
    false
  )
})

test("handles multi-turn long-context ranges without inventing turn boundaries", () => {
  const aggregate = {
    ...validUsage,
    usage_turns: 2,
    input_tokens: 300_000,
    uncached_input_tokens: 270_000,
    estimated_cost_usd: 1.5725,
    estimated_cost_usd_all_input_uncached: 1.65,
  }

  assert.equal(parseTakeoffProcessorUsage(aggregate).success, true)
  assert.equal(
    parseTakeoffProcessorUsage({
      ...aggregate,
      estimated_cost_usd_upper_bound: 2.2,
      estimated_cost_usd_all_input_uncached_upper_bound: 2.4,
      long_context_pricing_may_apply: true,
    }).success,
    true
  )
  assert.equal(
    parseTakeoffProcessorUsage({
      ...aggregate,
      estimated_cost_usd_upper_bound: 3.08,
      estimated_cost_usd_all_input_uncached_upper_bound: 2.4,
      long_context_pricing_may_apply: true,
    }).success,
    false
  )
  assert.equal(
    parseTakeoffProcessorUsage({
      ...aggregate,
      estimated_cost_usd_upper_bound: 2.2,
      estimated_cost_usd_all_input_uncached_upper_bound: 3.23,
      long_context_pricing_may_apply: true,
    }).success,
    false
  )
})

test("allows the all-input-uncached counterfactual below cache-write cost", () => {
  const cacheWriteHeavy = {
    ...validUsage,
    uncached_input_tokens: 0,
    cached_input_tokens: 0,
    cache_write_tokens: 100_000,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    estimated_cost_usd: 0.625,
    estimated_cost_usd_all_input_uncached: 0.5,
  }

  assert.equal(parseTakeoffProcessorUsage(cacheWriteHeavy).success, true)
  assert.ok(
    cacheWriteHeavy.estimated_cost_usd_all_input_uncached <
      cacheWriteHeavy.estimated_cost_usd
  )
})

test("summarizes all processor attempts and preserves an upper range", () => {
  const attempts = [
    row(validUsage, "11111111-1111-4111-8111-111111111111"),
    row(
      {
        ...validUsage,
        input_tokens: 300_000,
        uncached_input_tokens: 270_000,
        estimated_cost_usd: 1.5725,
        estimated_cost_usd_upper_bound: 3.07,
        estimated_cost_usd_all_input_uncached: 1.65,
        estimated_cost_usd_all_input_uncached_upper_bound: 3.225,
        long_context_pricing_may_apply: true,
      },
      "22222222-2222-4222-8222-222222222222"
    ),
  ]

  assert.deepEqual(summarizeTakeoffProcessorUsage(attempts), {
    usageTurns: 2,
    inputTokens: 400_000,
    cachedInputTokens: 40_000,
    cacheWriteTokens: 20_000,
    outputTokens: 10_000,
    reasoningOutputTokens: 2_000,
    estimatedCostUsd: 2.145,
    estimatedCostUsdUpperBound: 3.6425,
    estimatedCostUsdAllInputUncached: 2.3,
    estimatedCostUsdAllInputUncachedUpperBound: 3.875,
    hasLongContextRange: true,
    models: ["gpt-5.6-sol"],
    pricingDates: ["2026-08-06"],
    attemptCount: 2,
  })
})

test("keeps API economics out of the customer-visible result summary", async () => {
  const route = await readFile(
    fileURLToPath(
      new URL(
        "../src/app/api/internal/worker/takeoff/jobs/[id]/complete/route.ts",
        import.meta.url
      )
    ),
    "utf8"
  )
  const persistence = await readFile(
    fileURLToPath(
      new URL(
        "../src/lib/internal-takeoff-processor-usage.ts",
        import.meta.url
      )
    ),
    "utf8"
  )
  const failureRoute = await readFile(
    fileURLToPath(
      new URL(
        "../src/app/api/internal/worker/takeoff/jobs/[id]/fail/route.ts",
        import.meta.url
      )
    ),
    "utf8"
  )
  const adminPage = await readFile(
    fileURLToPath(
      new URL("../src/app/admin/jobs/[id]/page.tsx", import.meta.url)
    ),
    "utf8"
  )
  const customerPage = await readFile(
    fileURLToPath(
      new URL("../src/app/dashboard/jobs/[id]/page.tsx", import.meta.url)
    ),
    "utf8"
  )
  const migration = await readFile(
    fileURLToPath(
      new URL(
        "../supabase/migrations/20260806120000_takeoff_processor_usage.sql",
        import.meta.url
      )
    ),
    "utf8"
  )
  const adminData = await readFile(
    fileURLToPath(new URL("../src/lib/admin-data.ts", import.meta.url)),
    "utf8"
  )
  const resultSummary = route.match(/p_result_summary:\s*\{([\s\S]*?)\n\s*\},/)

  assert.ok(resultSummary)
  assert.doesNotMatch(resultSummary[1], /processorUsage|estimated_cost|tokens/)
  assert.match(route, /persistAndAuditTakeoffProcessorUsage/)
  assert.match(route, /usageRequired:\s*true/)
  assert.match(persistence, /\.from\("takeoff_processor_usage"\)/)
  assert.match(persistence, /\.from\("admin_alerts"\)/)
  assert.match(persistence, /\.from\("service_health"\)/)
  assert.match(persistence, /status:\s*"degraded"/)
  assert.match(persistence, /console\.error/)
  assert.match(persistence, /try\s*\{/)
  assert.match(persistence, /catch\s*\{/)
  assert.match(failureRoute, /persistAndAuditTakeoffProcessorUsage/)
  assert.match(failureRoute, /usageRequired:\s*false/)
  assert.doesNotMatch(route, /processorUsage\.status/)
  assert.doesNotMatch(route, /Invalid processor usage payload/)
  assert.doesNotMatch(route, /Could not record processor usage/)
  assert.match(adminPage, /Estimated API cost \(all input uncached\)/)
  assert.match(
    adminData,
    /level:\s*processorUsageReady\s*\?\s*"ok"\s*:\s*"warning"/
  )
  assert.equal(migration.match(/numeric\(18,\s*8\)/g)?.length, 4)
  assert.doesNotMatch(
    customerPage,
    /estimated_cost_usd_all_input_uncached|Estimated API cost \(all input uncached\)/
  )
})

test("worker carries terminal processor usage through artifact failures", async () => {
  process.env.CUADRABOT_API_URL = "http://127.0.0.1:1"
  process.env.WORKER_SHARED_SECRET = "test-worker-secret"
  process.env.TAKEOFF_SERVICE_URL = "http://127.0.0.1:2"
  process.env.TAKEOFF_SERVICE_API_TOKEN = "test-service-secret"
  process.env.CODEX_API_KEY = "test-codex-key"

  const { TakeoffServiceError, withProcessorUsage } = await import(
    "../worker/src/takeoff"
  )
  const processorUsage = {
    estimated_cost_usd: 1.25,
    estimated_cost_usd_all_input_uncached: 2.5,
  }
  const wrapped = withProcessorUsage(
    new Error("artifact hash mismatch"),
    processorUsage,
    "artifact_download"
  )
  assert.ok(wrapped instanceof TakeoffServiceError)
  assert.equal(wrapped.stage, "artifact_download")
  assert.equal(wrapped.retryable, false)
  assert.equal(wrapped.processorUsage, processorUsage)

  const existing = withProcessorUsage(
    new TakeoffServiceError("network timeout", "artifact_download", true),
    processorUsage,
    "ignored"
  )
  assert.equal(existing.stage, "artifact_download")
  assert.equal(existing.retryable, true)
  assert.equal(existing.processorUsage, processorUsage)

  const workerSource = await readFile(
    fileURLToPath(new URL("../worker/src/takeoff.ts", import.meta.url)),
    "utf8"
  )
  assert.ok(
    workerSource.indexOf("const processorUsage = job.processor_usage ?? null") <
      workerSource.indexOf("const artifacts = await downloadArtifacts")
  )
})

function row(
  usage: TakeoffProcessorUsage,
  claimToken: string
): TakeoffProcessorUsageRow {
  return {
    ...usage,
    id: crypto.randomUUID(),
    job_id: "33333333-3333-4333-8333-333333333333",
    claim_token: claimToken,
    worker_id: "worker-test",
    processor_job_id: "processor-test",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  }
}
