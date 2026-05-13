import "server-only"

import { getBearerToken } from "@/lib/http"
import { getRequiredEnv } from "@/lib/config"

export function requireWorker(request: Request) {
  const token = getBearerToken(request)
  const expected = getRequiredEnv("WORKER_API_KEY")

  if (!token || token !== expected) {
    return null
  }

  const workerId = request.headers.get("x-worker-id")?.trim()
  if (!workerId) {
    return null
  }

  return { workerId }
}
