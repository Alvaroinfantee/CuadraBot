import { createHmac } from "node:crypto"
import type { createSupabaseAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createSupabaseAdminClient>
type RateLimitAction = "create_takeoff" | "verify_takeoff"

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retry_after_seconds: number
}

const policies: Record<
  RateLimitAction,
  { userLimit: number; ipLimit: number; windowSeconds: number }
> = {
  create_takeoff: {
    userLimit: 10,
    ipLimit: 30,
    windowSeconds: 60 * 60,
  },
  verify_takeoff: {
    userLimit: 12,
    ipLimit: 40,
    windowSeconds: 60 * 60,
  },
}

export class RateLimitConfigurationError extends Error {}

export async function consumeTakeoffRateLimit(options: {
  supabase: AdminClient
  request: Request
  userId: string
  action: RateLimitAction
}) {
  const { supabase, request, userId, action } = options
  const policy = policies[action]
  const ip = getRequestIp(request)
  const ipDigest = digestRequestIp(ip, getRateLimitSecret())

  const [userBucket, ipBucket] = await Promise.all([
    consumeBucket(
      supabase,
      `takeoff:${action}:user:${userId}`,
      policy.userLimit,
      policy.windowSeconds
    ),
    consumeBucket(
      supabase,
      `takeoff:${action}:ip:${ipDigest}`,
      policy.ipLimit,
      policy.windowSeconds
    ),
  ])

  return {
    allowed: userBucket.allowed && ipBucket.allowed,
    retryAfterSeconds: Math.max(
      userBucket.retry_after_seconds,
      ipBucket.retry_after_seconds
    ),
  }
}

export function getRequestIp(request: Request) {
  const platformForwarded = request.headers.get("x-vercel-forwarded-for")
  const standardForwarded = request.headers.get("x-forwarded-for")
  const direct =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip")

  const candidate = platformForwarded ?? standardForwarded ?? direct ?? "unknown"
  const first = candidate.split(",")[0]?.trim()
  return (first || "unknown").slice(0, 200)
}

export function digestRequestIp(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip).digest("hex")
}

function getRateLimitSecret() {
  const secret = process.env.RATE_LIMIT_SECRET
  if (!secret || secret.length < 32) {
    throw new RateLimitConfigurationError(
      "RATE_LIMIT_SECRET must contain at least 32 characters."
    )
  }
  return secret
}

async function consumeBucket(
  supabase: AdminClient,
  bucketKey: string,
  limit: number,
  windowSeconds: number
) {
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    throw new RateLimitConfigurationError(
      `The request limiter is unavailable: ${error.message}`
    )
  }

  if (!isRateLimitResult(data)) {
    throw new RateLimitConfigurationError(
      "The request limiter returned an invalid response."
    )
  }

  return data
}

function isRateLimitResult(value: unknown): value is RateLimitResult {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<RateLimitResult>
  return (
    typeof candidate.allowed === "boolean" &&
    typeof candidate.remaining === "number" &&
    Number.isFinite(candidate.remaining) &&
    typeof candidate.retry_after_seconds === "number" &&
    Number.isFinite(candidate.retry_after_seconds)
  )
}
