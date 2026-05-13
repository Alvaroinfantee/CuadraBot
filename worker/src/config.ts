import path from "node:path"
import dotenv from "dotenv"

dotenv.config({ path: ".env.worker" })
dotenv.config()

function required(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required worker environment variable: ${name}`)
  }
  return value
}

export const workerConfig = {
  apiUrl: required("CUADRABOT_API_URL").replace(/\/$/, ""),
  apiKey: required("WORKER_API_KEY"),
  workerId: process.env.WORKER_ID ?? "owner-pc-01",
  localJobsDir: path.resolve(process.env.LOCAL_JOBS_DIR ?? "cuadrabot-worker-jobs"),
  blenderCommand: process.env.BLENDER_COMMAND ?? "",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "30000"),
}
