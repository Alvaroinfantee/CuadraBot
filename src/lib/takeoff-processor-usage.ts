import { z } from "zod"

const tokenCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const usdAmount = z.number().finite().nonnegative().max(1_000_000)
const rate = z.number().finite().positive().max(10_000)
const usdRoundingFactor = 100_000_000
const usdComparisonTolerance = 0.5 / usdRoundingFactor
const longContextInputThreshold = 272_000

const canonicalTakeoffPricing = {
  "gpt-5.6-sol": {
    pricingAsOf: "2026-08-06",
    input: 5,
    cached_input: 0.5,
    cache_write: 6.25,
    output: 30,
  },
  "gpt-5.6-terra": {
    pricingAsOf: "2026-08-06",
    input: 2,
    cached_input: 0.2,
    cache_write: 2.5,
    output: 12,
  },
  "gpt-5.6-luna": {
    pricingAsOf: "2026-08-06",
    input: 0.2,
    cached_input: 0.02,
    cache_write: 0.25,
    output: 1.2,
  },
} as const

function roundedUsd(value: number) {
  return Math.round(value * usdRoundingFactor) / usdRoundingFactor
}

function sameUsd(left: number, right: number) {
  return Math.abs(left - right) <= usdComparisonTolerance
}

export const takeoffProcessorUsageSchema = z
  .object({
    schema_version: z.literal(1),
    provider: z.literal("openai"),
    model: z.enum(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]),
    pricing_as_of: z.iso.date(),
    currency: z.literal("USD"),
    usage_turns: tokenCount.positive(),
    input_tokens: tokenCount,
    uncached_input_tokens: tokenCount,
    cached_input_tokens: tokenCount,
    cache_write_tokens: tokenCount,
    output_tokens: tokenCount,
    reasoning_output_tokens: tokenCount,
    estimated_cost_usd: usdAmount,
    estimated_cost_usd_upper_bound: usdAmount.nullable(),
    estimated_cost_usd_all_input_uncached: usdAmount,
    estimated_cost_usd_all_input_uncached_upper_bound: usdAmount.nullable(),
    long_context_pricing_may_apply: z.boolean(),
    rate_snapshot_usd_per_million: z
      .object({
        input: rate,
        cached_input: rate,
        cache_write: rate,
        output: rate,
      })
      .strict(),
  })
  .strict()
  .superRefine((usage, context) => {
    const canonical = canonicalTakeoffPricing[usage.model]
    if (usage.pricing_as_of !== canonical.pricingAsOf) {
      context.addIssue({
        code: "custom",
        path: ["pricing_as_of"],
        message: "Pricing date does not match the canonical model snapshot.",
      })
    }
    for (const field of [
      "input",
      "cached_input",
      "cache_write",
      "output",
    ] as const) {
      if (usage.rate_snapshot_usd_per_million[field] !== canonical[field]) {
        context.addIssue({
          code: "custom",
          path: ["rate_snapshot_usd_per_million", field],
          message: "Rate does not match the canonical model snapshot.",
        })
      }
    }

    if (
      usage.uncached_input_tokens +
        usage.cached_input_tokens +
        usage.cache_write_tokens !==
      usage.input_tokens
    ) {
      context.addIssue({
        code: "custom",
        path: ["uncached_input_tokens"],
        message: "Input token categories must reconcile to input_tokens.",
      })
    }
    if (usage.reasoning_output_tokens > usage.output_tokens) {
      context.addIssue({
        code: "custom",
        path: ["reasoning_output_tokens"],
        message: "Reasoning output is included in output_tokens.",
      })
    }

    const expectedBaseCost = roundedUsd(
      (usage.uncached_input_tokens * canonical.input +
        usage.cached_input_tokens * canonical.cached_input +
        usage.cache_write_tokens * canonical.cache_write +
        usage.output_tokens * canonical.output) /
        1_000_000
    )
    if (!sameUsd(usage.estimated_cost_usd, expectedBaseCost)) {
      context.addIssue({
        code: "custom",
        path: ["estimated_cost_usd"],
        message: "Base cost does not reconcile to tokens and canonical rates.",
      })
    }

    const expectedAllInputUncachedCost = roundedUsd(
      (usage.input_tokens * canonical.input +
        usage.output_tokens * canonical.output) /
        1_000_000
    )
    if (
      !sameUsd(
        usage.estimated_cost_usd_all_input_uncached,
        expectedAllInputUncachedCost
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["estimated_cost_usd_all_input_uncached"],
        message:
          "All-input-uncached cost does not reconcile to total input tokens and canonical rates.",
      })
    }

    if (
      usage.long_context_pricing_may_apply !==
      (usage.estimated_cost_usd_upper_bound !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["estimated_cost_usd_upper_bound"],
        message: "Long-context estimates require an upper bound.",
      })
    }
    if (
      usage.estimated_cost_usd_upper_bound !== null &&
      usage.estimated_cost_usd_upper_bound < usage.estimated_cost_usd
    ) {
      context.addIssue({
        code: "custom",
        path: ["estimated_cost_usd_upper_bound"],
        message: "The upper bound cannot be below the base estimate.",
      })
    }
    if (
      usage.long_context_pricing_may_apply !==
      (usage.estimated_cost_usd_all_input_uncached_upper_bound !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["estimated_cost_usd_all_input_uncached_upper_bound"],
        message:
          "Long-context all-input-uncached estimates require an upper bound.",
      })
    }
    if (
      usage.estimated_cost_usd_all_input_uncached_upper_bound !== null &&
      usage.estimated_cost_usd_all_input_uncached_upper_bound <
        usage.estimated_cost_usd_all_input_uncached
    ) {
      context.addIssue({
        code: "custom",
        path: ["estimated_cost_usd_all_input_uncached_upper_bound"],
        message:
          "The all-input-uncached upper bound cannot be below its base estimate.",
      })
    }

    if (usage.long_context_pricing_may_apply) {
      if (usage.input_tokens <= longContextInputThreshold) {
        context.addIssue({
          code: "custom",
          path: ["long_context_pricing_may_apply"],
          message: "Long-context pricing requires a turn above 272K input tokens.",
        })
      }
      if (usage.estimated_cost_usd_upper_bound !== null) {
        const fullPremiumCost = roundedUsd(
          (usage.uncached_input_tokens * canonical.input * 2 +
            usage.cached_input_tokens * canonical.cached_input * 2 +
            usage.cache_write_tokens * canonical.cache_write * 2 +
            usage.output_tokens * canonical.output * 1.5) /
            1_000_000
        )
        const exactSingleTurnMismatch =
          usage.usage_turns === 1 &&
          !sameUsd(usage.estimated_cost_usd_upper_bound, fullPremiumCost)
        const multiTurnAboveMaximum =
          usage.usage_turns > 1 &&
          usage.estimated_cost_usd_upper_bound - fullPremiumCost >
            usdComparisonTolerance
        if (exactSingleTurnMismatch || multiTurnAboveMaximum) {
          context.addIssue({
            code: "custom",
            path: ["estimated_cost_usd_upper_bound"],
            message:
              "Long-context upper cost does not reconcile to canonical premiums.",
          })
        }
      }
      if (
        usage.estimated_cost_usd_all_input_uncached_upper_bound !== null
      ) {
        const fullPremiumAllInputUncachedCost = roundedUsd(
          (usage.input_tokens * canonical.input * 2 +
            usage.output_tokens * canonical.output * 1.5) /
            1_000_000
        )
        const exactSingleTurnMismatch =
          usage.usage_turns === 1 &&
          !sameUsd(
            usage.estimated_cost_usd_all_input_uncached_upper_bound,
            fullPremiumAllInputUncachedCost
          )
        const multiTurnAboveMaximum =
          usage.usage_turns > 1 &&
          usage.estimated_cost_usd_all_input_uncached_upper_bound -
            fullPremiumAllInputUncachedCost >
            usdComparisonTolerance
        if (exactSingleTurnMismatch || multiTurnAboveMaximum) {
          context.addIssue({
            code: "custom",
            path: ["estimated_cost_usd_all_input_uncached_upper_bound"],
            message:
              "Long-context all-input-uncached upper cost does not reconcile to canonical premiums.",
          })
        }
      }
    } else if (
      usage.usage_turns === 1 &&
      usage.input_tokens > longContextInputThreshold
    ) {
      context.addIssue({
        code: "custom",
        path: ["long_context_pricing_may_apply"],
        message: "A single turn above 272K input tokens requires a cost range.",
      })
    }
  })

export type TakeoffProcessorUsage = z.infer<
  typeof takeoffProcessorUsageSchema
>

export type TakeoffProcessorUsageRow = TakeoffProcessorUsage & {
  id: string
  job_id: string
  claim_token: string
  worker_id: string
  processor_job_id: string | null
  created_at: string
  updated_at: string
}

export function parseTakeoffProcessorUsage(value: unknown) {
  return takeoffProcessorUsageSchema.safeParse(value)
}

export function summarizeTakeoffProcessorUsage(
  attempts: TakeoffProcessorUsageRow[]
) {
  const totals = attempts.reduce(
    (sum, attempt) => ({
      usageTurns: sum.usageTurns + attempt.usage_turns,
      inputTokens: sum.inputTokens + attempt.input_tokens,
      cachedInputTokens:
        sum.cachedInputTokens + attempt.cached_input_tokens,
      cacheWriteTokens: sum.cacheWriteTokens + attempt.cache_write_tokens,
      outputTokens: sum.outputTokens + attempt.output_tokens,
      reasoningOutputTokens:
        sum.reasoningOutputTokens + attempt.reasoning_output_tokens,
      estimatedCostUsd: sum.estimatedCostUsd + attempt.estimated_cost_usd,
      estimatedCostUsdUpperBound:
        sum.estimatedCostUsdUpperBound +
        (attempt.estimated_cost_usd_upper_bound ??
          attempt.estimated_cost_usd),
      estimatedCostUsdAllInputUncached:
        sum.estimatedCostUsdAllInputUncached +
        attempt.estimated_cost_usd_all_input_uncached,
      estimatedCostUsdAllInputUncachedUpperBound:
        sum.estimatedCostUsdAllInputUncachedUpperBound +
        (attempt.estimated_cost_usd_all_input_uncached_upper_bound ??
          attempt.estimated_cost_usd_all_input_uncached),
      hasLongContextRange:
        sum.hasLongContextRange || attempt.long_context_pricing_may_apply,
    }),
    {
      usageTurns: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      estimatedCostUsd: 0,
      estimatedCostUsdUpperBound: 0,
      estimatedCostUsdAllInputUncached: 0,
      estimatedCostUsdAllInputUncachedUpperBound: 0,
      hasLongContextRange: false,
    }
  )

  return {
    ...totals,
    models: [...new Set(attempts.map((attempt) => attempt.model))],
    pricingDates: [
      ...new Set(attempts.map((attempt) => attempt.pricing_as_of)),
    ].sort(),
    attemptCount: attempts.length,
  }
}
