import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { getRequiredEnv } from "@/lib/config"

const TOKEN_LIFETIME_SECONDS = 120 * 24 * 60 * 60

function secret() {
  const value = getRequiredEnv("DRYWALL_PORTAL_SECRET")
  if (value.length < 32) {
    throw new Error("DRYWALL_PORTAL_SECRET must contain at least 32 characters.")
  }
  return value
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url")
}

export function hashDrywallDraftToken(token: string) {
  return signature(`draft:${token}`)
}

export function verifyDrywallDraftToken(storedHash: string, token: string) {
  const provided = Buffer.from(hashDrywallDraftToken(token))
  const expected = Buffer.from(storedHash)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export function createDrywallPortalToken(
  projectId: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const expiresAt = nowSeconds + TOKEN_LIFETIME_SECONDS
  const payload = `${projectId}.${expiresAt}`
  return `${expiresAt}.${signature(`portal:${payload}`)}`
}

export function verifyDrywallPortalToken(
  projectId: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const [expiresRaw, provided] = token.split(".")
  const expiresAt = Number(expiresRaw)
  if (!Number.isSafeInteger(expiresAt) || expiresAt < nowSeconds || !provided) {
    return false
  }
  const expected = signature(`portal:${projectId}.${expiresAt}`)
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}
