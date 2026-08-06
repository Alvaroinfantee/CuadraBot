import path from "node:path"
import {
  SAFE_ID,
  parsePositiveInteger,
  requiredEnvironment,
  strictHttpUrl,
} from "./util.mjs"

const DEFAULT_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]

export function createBrokerConfig(environment = process.env) {
  const brokerToken = strongSecret(environment, "EXECUTOR_BROKER_TOKEN")
  const egressControlToken = strongSecret(
    environment,
    "EXECUTOR_EGRESS_CONTROL_TOKEN"
  )
  const processorKeySecret = strongSecret(
    environment,
    "EXECUTOR_PROCESSOR_KEY_SECRET"
  )
  const safetySecret = strongSecret(environment, "EXECUTOR_SAFETY_SECRET")
  const processorImage = requiredEnvironment(
    environment,
    "EXECUTOR_PROCESSOR_IMAGE"
  )
  if (
    !/^(?:sha256:[a-f0-9]{64}|[^\s@]+@sha256:[a-f0-9]{64})$/.test(
      processorImage
    )
  ) {
    throw new Error("EXECUTOR_PROCESSOR_IMAGE must use an immutable SHA-256 reference")
  }
  const stateRoot = path.resolve(
    environment.EXECUTOR_STATE_DIR ?? "/var/lib/cuadrabot-executor"
  )
  const egressControlUrl = strictHttpUrl(
    environment.EXECUTOR_EGRESS_CONTROL_URL ?? "http://127.0.0.1:8092",
    "EXECUTOR_EGRESS_CONTROL_URL",
    { loopback: true }
  )
  if (egressControlUrl.pathname !== "/") {
    throw new Error("EXECUTOR_EGRESS_CONTROL_URL must not include a path")
  }
  const jobTtlSeconds = parsePositiveInteger(
    environment.EXECUTOR_JOB_TTL_SECONDS,
    8 * 60 * 60,
    "EXECUTOR_JOB_TTL_SECONDS"
  )
  if (jobTtlSeconds < 7 * 60 * 60 + 15 * 60) {
    throw new Error("EXECUTOR_JOB_TTL_SECONDS is shorter than the worker deadline")
  }
  const processorMemory = memoryValue(
    environment.EXECUTOR_PROCESSOR_MEMORY ?? "6g",
    "EXECUTOR_PROCESSOR_MEMORY"
  )
  const processorMemorySwap = memoryValue(
    environment.EXECUTOR_PROCESSOR_MEMORY_SWAP ?? processorMemory,
    "EXECUTOR_PROCESSOR_MEMORY_SWAP"
  )
  if (processorMemorySwap !== processorMemory) {
    throw new Error(
      "EXECUTOR_PROCESSOR_MEMORY_SWAP must equal EXECUTOR_PROCESSOR_MEMORY"
    )
  }
  const processorCpus = Number(environment.EXECUTOR_PROCESSOR_CPUS ?? 2)
  if (!Number.isFinite(processorCpus) || processorCpus < 0.25 || processorCpus > 64) {
    throw new Error("EXECUTOR_PROCESSOR_CPUS is outside the safe range")
  }
  const allowedModels = (
    environment.EXECUTOR_ALLOWED_MODELS?.split(",") ?? DEFAULT_MODELS
  )
    .map((model) => model.trim().toLowerCase())
    .filter(Boolean)
  if (
    !allowedModels.length ||
    new Set(allowedModels).size !== allowedModels.length ||
    !allowedModels.every((model) => /^[a-z0-9][a-z0-9.-]{1,80}$/.test(model))
  ) {
    throw new Error("EXECUTOR_ALLOWED_MODELS is invalid")
  }
  const defaultModel = (
    environment.TAKEOFF_CODEX_MODEL ?? "gpt-5.6-sol"
  )
    .trim()
    .toLowerCase()
  if (!allowedModels.includes(defaultModel)) {
    throw new Error("TAKEOFF_CODEX_MODEL must be in EXECUTOR_ALLOWED_MODELS")
  }

  const host = environment.EXECUTOR_BROKER_HOST?.trim() || "127.0.0.1"
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) {
    throw new Error("EXECUTOR_BROKER_HOST must be loopback")
  }
  const egressContainer =
    environment.EXECUTOR_EGRESS_CONTAINER?.trim() ||
    "cuadrabot-openai-egress"
  if (!SAFE_ID.test(egressContainer)) {
    throw new Error("EXECUTOR_EGRESS_CONTAINER is invalid")
  }

  return Object.freeze({
    brokerToken,
    egressControlToken,
    processorKeySecret,
    safetySecret,
    processorImage,
    stateRoot,
    stateFile: path.join(stateRoot, "broker.json"),
    jobsRoot: path.join(stateRoot, "jobs"),
    host,
    port: port(environment.EXECUTOR_BROKER_PORT, 8090, "EXECUTOR_BROKER_PORT"),
    egressControlUrl,
    egressContainer,
    dockerBin: environment.EXECUTOR_DOCKER_BIN?.trim() || "docker",
    processorUid: boundedInteger(
      environment.EXECUTOR_PROCESSOR_UID,
      10_001,
      1,
      2_147_483_647,
      "EXECUTOR_PROCESSOR_UID"
    ),
    processorGid: boundedInteger(
      environment.EXECUTOR_PROCESSOR_GID,
      10_001,
      1,
      2_147_483_647,
      "EXECUTOR_PROCESSOR_GID"
    ),
    processorPids: boundedInteger(
      environment.EXECUTOR_PROCESSOR_PIDS,
      256,
      32,
      4_096,
      "EXECUTOR_PROCESSOR_PIDS"
    ),
    processorCpus,
    processorMemory,
    processorMemorySwap,
    processorTmpfs: memoryValue(
      environment.EXECUTOR_PROCESSOR_TMPFS ?? "512m",
      "EXECUTOR_PROCESSOR_TMPFS"
    ),
    maxConcurrentJobs: boundedInteger(
      environment.EXECUTOR_MAX_CONCURRENT_JOBS,
      1,
      1,
      16,
      "EXECUTOR_MAX_CONCURRENT_JOBS"
    ),
    jobTtlMs: jobTtlSeconds * 1_000,
    allowedModels,
    defaultModel,
    maxUploadBytes: parsePositiveInteger(
      environment.EXECUTOR_MAX_UPLOAD_BYTES,
      250 * 1024 * 1024,
      "EXECUTOR_MAX_UPLOAD_BYTES"
    ),
    maxJsonBytes: parsePositiveInteger(
      environment.EXECUTOR_MAX_JSON_BYTES,
      2 * 1024 * 1024,
      "EXECUTOR_MAX_JSON_BYTES"
    ),
    processorReadyTimeoutMs: parsePositiveInteger(
      environment.EXECUTOR_PROCESSOR_READY_TIMEOUT_MS,
      120_000,
      "EXECUTOR_PROCESSOR_READY_TIMEOUT_MS"
    ),
    processorRequestTimeoutMs: parsePositiveInteger(
      environment.EXECUTOR_PROCESSOR_REQUEST_TIMEOUT_MS,
      15 * 60 * 1_000,
      "EXECUTOR_PROCESSOR_REQUEST_TIMEOUT_MS"
    ),
    cleanupIntervalMs: parsePositiveInteger(
      environment.EXECUTOR_CLEANUP_INTERVAL_MS,
      60_000,
      "EXECUTOR_CLEANUP_INTERVAL_MS"
    ),
  })
}

function strongSecret(environment, name) {
  const value = requiredEnvironment(environment, name)
  if (value.length < 32 || /[\r\n\0]/.test(value)) {
    throw new Error(`${name} must contain at least 32 safe characters`)
  }
  return value
}

function port(value, fallback, name) {
  return boundedInteger(value, fallback, 1, 65_535, name)
}

function boundedInteger(value, fallback, minimum, maximum, name) {
  const parsed = parsePositiveInteger(value, fallback, name)
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`${name} is outside the safe range`)
  }
  return parsed
}

function memoryValue(value, name) {
  const normalized = String(value).trim().toLowerCase()
  if (!/^[1-9][0-9]*(?:[bkmg])?$/.test(normalized)) {
    throw new Error(`${name} must be a Docker memory quantity`)
  }
  return normalized
}
