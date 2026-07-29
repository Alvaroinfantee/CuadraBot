import path from "node:path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.worker", quiet: true })
dotenv.config({ quiet: true })

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required worker environment variable: ${name}`)
  }
  return value
}

function requiredUrl(name: string) {
  const raw = required(name)
  const value = new URL(raw)
  if (!["http:", "https:"].includes(value.protocol)) {
    throw new Error(`${name} must use http or https`)
  }
  return value.toString().replace(/\/$/, "")
}

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

function booleanValue(name: string, fallback: boolean) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  if (/^(1|true|yes)$/i.test(raw)) return true
  if (/^(0|false|no)$/i.test(raw)) return false
  throw new Error(`${name} must be true or false`)
}

export const workerConfig = Object.freeze({
  apiUrl: requiredUrl("CUADRABOT_API_URL"),
  sharedSecret: required("WORKER_SHARED_SECRET"),
  workerId: process.env.WORKER_ID?.trim() || "takeoff-worker-01",
  takeoffServiceUrl: requiredUrl("TAKEOFF_SERVICE_URL"),
  takeoffServiceToken: required("TAKEOFF_SERVICE_API_TOKEN"),
  codexApiKey: required("CODEX_API_KEY"),
  codexModel: process.env.TAKEOFF_CODEX_MODEL?.trim() || "",
  localJobsDir: path.resolve(
    process.env.LOCAL_JOBS_DIR ?? "cuadrabot-takeoff-worker-jobs"
  ),
  pollIntervalMs: positiveInteger("POLL_INTERVAL_MS", 30_000),
  takeoffPollIntervalMs: positiveInteger(
    "TAKEOFF_POLL_INTERVAL_MS",
    5_000
  ),
  heartbeatIntervalMs: positiveInteger(
    "WORKER_HEARTBEAT_INTERVAL_MS",
    60_000
  ),
  takeoffJobTimeoutMs: positiveInteger(
    "TAKEOFF_JOB_TIMEOUT_MS",
    6 * 60 * 60 * 1_000 + 15 * 60 * 1_000
  ),
  apiTimeoutMs: positiveInteger("WORKER_API_TIMEOUT_MS", 60_000),
  artifactUploadTimeoutMs: positiveInteger(
    "ARTIFACT_UPLOAD_TIMEOUT_MS",
    10 * 60 * 1_000
  ),
  maxFileBytes: positiveInteger(
    "WORKER_MAX_FILE_BYTES",
    250 * 1024 * 1024
  ),
  keepLocalJobFiles: booleanValue("KEEP_LOCAL_JOB_FILES", false),
})
