import { createHash, createHmac } from "node:crypto"

export const adminBootstrapKeyPattern = /^[a-f0-9]{64}$/
export const maxAdminBootstrapRequestBytes = 4_096

export type AdminBootstrapRedemptionResult = {
  redeemed: boolean
  throttled: boolean
  retry_after_seconds: number
}

export function digestAdminBootstrapKey(rawKey: string) {
  return createHash("sha256").update(rawKey, "utf8").digest("hex")
}

export function digestAdminBootstrapRequestFingerprint(
  requestIp: string,
  secret: string
) {
  if (secret.length < 32) {
    throw new Error("RATE_LIMIT_SECRET must contain at least 32 characters.")
  }

  return createHmac("sha256", secret)
    .update(`admin-bootstrap:${requestIp}`, "utf8")
    .digest("hex")
}

export function isAdminBootstrapRedemptionResult(
  value: unknown
): value is AdminBootstrapRedemptionResult {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<AdminBootstrapRedemptionResult>
  return (
    typeof candidate.redeemed === "boolean" &&
    typeof candidate.throttled === "boolean" &&
    typeof candidate.retry_after_seconds === "number" &&
    Number.isInteger(candidate.retry_after_seconds) &&
    candidate.retry_after_seconds >= 0
  )
}
