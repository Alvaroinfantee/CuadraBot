import path from "node:path"
import {
  DEFAULT_IMAGE_PATCH_TOKEN_MULTIPLIER,
  DEFAULT_MAX_DATA_IMAGE_BYTES,
  DEFAULT_MAX_DATA_IMAGES,
  MODEL_COST_RATES,
} from "./budget-policy.mjs"
import {
  parsePositiveInteger,
  requiredEnvironment,
} from "./util.mjs"

const DEFAULT_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]

export function createEgressConfig(environment = process.env) {
  const masterApiKey = requiredEnvironment(environment, "OPENAI_API_KEY")
  const controlToken = requiredEnvironment(environment, "EGRESS_CONTROL_TOKEN")
  if (masterApiKey.length < 20) throw new Error("OPENAI_API_KEY is too short")
  if (controlToken.length < 32) {
    throw new Error("EGRESS_CONTROL_TOKEN must contain at least 32 characters")
  }
  const allowedModels = (
    environment.EGRESS_ALLOWED_MODELS?.split(",") ?? DEFAULT_MODELS
  )
    .map((model) => model.trim().toLowerCase())
    .filter(Boolean)
  if (!allowedModels.length || new Set(allowedModels).size !== allowedModels.length) {
    throw new Error("EGRESS_ALLOWED_MODELS must contain unique model identifiers")
  }
  if (!allowedModels.every((model) => /^[a-z0-9][a-z0-9.-]{1,80}$/.test(model))) {
    throw new Error("EGRESS_ALLOWED_MODELS contains an invalid model")
  }
  if (!allowedModels.every((model) => MODEL_COST_RATES[model])) {
    throw new Error("EGRESS_ALLOWED_MODELS contains a model without cost rates")
  }
  const maxRequestBytes = boundedPositiveInteger(
    environment.EGRESS_MAX_REQUEST_BYTES,
    16 * 1024 * 1024,
    24 * 1024 * 1024,
    "EGRESS_MAX_REQUEST_BYTES"
  )
  const maxDataImageBytes = boundedPositiveInteger(
    environment.EGRESS_MAX_DATA_IMAGE_BYTES,
    DEFAULT_MAX_DATA_IMAGE_BYTES,
    16 * 1024 * 1024,
    "EGRESS_MAX_DATA_IMAGE_BYTES"
  )
  if (Math.ceil((maxDataImageBytes * 4) / 3) + 1024 > maxRequestBytes) {
    throw new Error(
      "EGRESS_MAX_DATA_IMAGE_BYTES cannot fit in EGRESS_MAX_REQUEST_BYTES"
    )
  }
  return Object.freeze({
    masterApiKey,
    controlToken,
    stateFile: path.resolve(
      environment.EGRESS_STATE_DIR ?? "/state",
      "tokens.json"
    ),
    dataHost: environment.EGRESS_DATA_HOST?.trim() || "0.0.0.0",
    dataPort: port(environment.EGRESS_DATA_PORT, 8091, "EGRESS_DATA_PORT"),
    controlHost: environment.EGRESS_CONTROL_HOST?.trim() || "127.0.0.1",
    controlPort: port(
      environment.EGRESS_CONTROL_PORT,
      8092,
      "EGRESS_CONTROL_PORT"
    ),
    allowedModels,
    maxRequestBytes,
    maxResponseBytes: boundedPositiveInteger(
      environment.EGRESS_MAX_RESPONSE_BYTES,
      16 * 1024 * 1024,
      32 * 1024 * 1024,
      "EGRESS_MAX_RESPONSE_BYTES"
    ),
    maxDataImageBytes,
    maxDataImagesPerRequest: boundedPositiveInteger(
      environment.EGRESS_MAX_DATA_IMAGES_PER_REQUEST,
      DEFAULT_MAX_DATA_IMAGES,
      16,
      "EGRESS_MAX_DATA_IMAGES_PER_REQUEST"
    ),
    imagePatchTokenMultiplier: DEFAULT_IMAGE_PATCH_TOKEN_MULTIPLIER,
    maxInFlightRequests: boundedPositiveInteger(
      environment.EGRESS_MAX_IN_FLIGHT_REQUESTS,
      1,
      2,
      "EGRESS_MAX_IN_FLIGHT_REQUESTS"
    ),
    maxInFlightRequestsPerToken: 1,
    upstreamTimeoutMs: parsePositiveInteger(
      environment.EGRESS_UPSTREAM_TIMEOUT_MS,
      30 * 60 * 1_000,
      "EGRESS_UPSTREAM_TIMEOUT_MS"
    ),
    upstreamIdleTimeoutMs: parsePositiveInteger(
      environment.EGRESS_UPSTREAM_IDLE_TIMEOUT_MS,
      5 * 60 * 1_000,
      "EGRESS_UPSTREAM_IDLE_TIMEOUT_MS"
    ),
    serverRequestTimeoutMs: parsePositiveInteger(
      environment.EGRESS_SERVER_REQUEST_TIMEOUT_MS,
      35 * 60 * 1_000,
      "EGRESS_SERVER_REQUEST_TIMEOUT_MS"
    ),
    maxRequestsPerToken: parsePositiveInteger(
      environment.EGRESS_MAX_REQUESTS_PER_TOKEN,
      512,
      "EGRESS_MAX_REQUESTS_PER_TOKEN"
    ),
    maxRequestBytesPerToken: parsePositiveInteger(
      environment.EGRESS_MAX_REQUEST_BYTES_PER_TOKEN,
      2 * 1024 * 1024 * 1024,
      "EGRESS_MAX_REQUEST_BYTES_PER_TOKEN"
    ),
    maxOutputTokensPerRequest: boundedPositiveInteger(
      environment.EGRESS_MAX_OUTPUT_TOKENS_PER_REQUEST,
      32_000,
      32_000,
      "EGRESS_MAX_OUTPUT_TOKENS_PER_REQUEST"
    ),
    maxOutputTokensPerToken: parsePositiveInteger(
      environment.EGRESS_MAX_OUTPUT_TOKENS_PER_TOKEN,
      1_000_000,
      "EGRESS_MAX_OUTPUT_TOKENS_PER_TOKEN"
    ),
    maxTokenTtlMs:
      parsePositiveInteger(
        environment.EGRESS_MAX_TOKEN_TTL_SECONDS,
        8 * 60 * 60,
        "EGRESS_MAX_TOKEN_TTL_SECONDS"
      ) * 1_000,
    openaiOrganization: environment.OPENAI_ORGANIZATION?.trim() || "",
    openaiProject: environment.OPENAI_PROJECT?.trim() || "",
    upstreamOrigin: new URL("https://api.openai.com"),
  })
}

function boundedPositiveInteger(value, fallback, ceiling, name) {
  const parsed = parsePositiveInteger(value, fallback, name)
  if (parsed > ceiling) throw new Error(`${name} exceeds its hard safety limit`)
  return parsed
}

function port(value, fallback, name) {
  const parsed = parsePositiveInteger(value, fallback, name)
  if (parsed > 65_535) throw new Error(`${name} must be a valid TCP port`)
  return parsed
}
