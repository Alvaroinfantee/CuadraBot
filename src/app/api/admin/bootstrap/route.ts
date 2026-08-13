import { NextResponse, type NextRequest } from "next/server"
import {
  adminBootstrapKeyPattern,
  digestAdminBootstrapKey,
  digestAdminBootstrapRequestFingerprint,
  isAdminBootstrapRedemptionResult,
  maxAdminBootstrapRequestBytes,
} from "@/lib/admin-bootstrap"
import { getCurrentAuthContext } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { getRequestIp } from "@/lib/request-rate-limit"
import { readRequestTextWithLimit } from "@/lib/request-body"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const genericRejection = "The one-time administrator key is not valid."
const invalidKeySentinel = "invalid-admin-bootstrap-key"

export async function POST(request: NextRequest) {
  const { user, profile } = await getCurrentAuthContext()

  if (!user || !profile) return jsonError("Log in to continue.", 401)
  if (profile.status !== "active") {
    return jsonError("This workspace is not active.", 403)
  }
  const requestText = await readRequestTextWithLimit(
    request,
    maxAdminBootstrapRequestBytes
  )
  const body = requestText.ok ? parseJsonObject(requestText.value) : null
  const candidateKey = typeof body?.key === "string" ? body.key : ""
  const rawKey = adminBootstrapKeyPattern.test(candidateKey)
    ? candidateKey
    : invalidKeySentinel

  const rateLimitSecret = process.env.RATE_LIMIT_SECRET
  if (!rateLimitSecret || rateLimitSecret.length < 32) {
    return jsonError("Administrator recovery is temporarily unavailable.", 503)
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc("redeem_admin_bootstrap", {
    p_user_id: user.id,
    p_key_digest: digestAdminBootstrapKey(rawKey),
    p_request_fingerprint: digestAdminBootstrapRequestFingerprint(
      getRequestIp(request),
      rateLimitSecret
    ),
  })

  if (error || !isAdminBootstrapRedemptionResult(data)) {
    return jsonError("Administrator recovery is temporarily unavailable.", 503)
  }

  if (data.throttled) {
    const response = jsonError(genericRejection, 429)
    response.headers.set(
      "Retry-After",
      String(Math.max(1, data.retry_after_seconds))
    )
    return response
  }

  if (!data.redeemed) return jsonError(genericRejection, 403)

  return NextResponse.json({ ok: true, redirectTo: "/admin" })
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
