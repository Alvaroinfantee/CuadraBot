import "server-only"

import { timingSafeEqual } from "node:crypto"
import { getBearerToken } from "@/lib/http"

export function requireWorker(request: Request) {
  const token = getBearerToken(request)
  const expected =
    process.env.WORKER_SHARED_SECRET ?? process.env.WORKER_API_KEY ?? null

  if (!token || !expected || !safeEqual(token, expected)) {
    return null
  }

  const workerId = request.headers.get("x-worker-id")?.trim()
  if (!workerId) {
    return null
  }

  return { workerId }
}

function safeEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}
