import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

export const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/
export const SAFE_PROCESSOR_JOB_ID = /^[a-f0-9]{32}$/
export const SAFE_FILENAME = /^[A-Za-z0-9_.-]{1,180}$/
export const SAFE_TOKEN_ID = /^[a-f0-9]{32}$/
export const SAFE_SAFETY_IDENTIFIER = /^cb_[a-f0-9]{48}$/
export const SAFE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertSafeId(value, label = "identifier") {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

export function assertSafeProcessorJobId(value) {
  if (typeof value !== "string" || !SAFE_PROCESSOR_JOB_ID.test(value)) {
    throw new Error("Invalid processor job identifier")
  }
  return value
}

export function assertUuid(value, label = "UUID") {
  if (typeof value !== "string" || !SAFE_UUID.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return value.toLowerCase()
}

export function assertSafeFilename(value) {
  if (
    typeof value !== "string" ||
    !SAFE_FILENAME.test(value) ||
    value === "." ||
    value === ".." ||
    path.basename(value) !== value
  ) {
    throw new Error("Invalid artifact filename")
  }
  return value
}

export function safeChild(root, child, label = "path") {
  assertSafeId(child, label)
  const resolvedRoot = path.resolve(root)
  const destination = path.resolve(resolvedRoot, child)
  if (path.dirname(destination) !== resolvedRoot) {
    throw new Error(`Resolved ${label} escaped its root`)
  }
  return destination
}

export function bearerToken(request) {
  const header = request.headers.authorization
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null
  const value = header.slice("Bearer ".length)
  return value && value === value.trim() ? value : null
}

export function secretEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return (
    leftBytes.length === rightBytes.length &&
    crypto.timingSafeEqual(leftBytes, rightBytes)
  )
}

export function requireBearer(request, expected) {
  if (!secretEqual(bearerToken(request), expected)) {
    const error = new Error("Unauthorized")
    error.statusCode = 401
    throw error
  }
}

export function hmacHex(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex")
}

export function safetyIdentifier(secret, sourceJobId) {
  assertSafeId(sourceJobId, "source job identifier")
  return `cb_${hmacHex(secret, `safety:${sourceJobId}`).slice(0, 48)}`
}

export function derivedSecret(secret, purpose, identifier) {
  assertSafeId(identifier)
  return crypto
    .createHmac("sha256", secret)
    .update(`${purpose}:${identifier}`)
    .digest("base64url")
}

export async function readBody(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Invalid request body limit")
  }
  const declared = request.headers["content-length"]
  if (declared !== undefined) {
    const parsed = Number(declared)
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maxBytes) {
      const error = new Error("Request body is too large")
      error.statusCode = 413
      throw error
    }
  }
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > maxBytes) {
      const error = new Error("Request body is too large")
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, bytes)
}

export async function readJsonBody(request, maxBytes) {
  const body = await readBody(request, maxBytes)
  try {
    return JSON.parse(body.toString("utf8"))
  } catch {
    const error = new Error("Request body must be valid JSON")
    error.statusCode = 400
    throw error
  }
}

export function sendJson(response, statusCode, value) {
  const body = Buffer.from(JSON.stringify(value))
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  response.end(body)
}

export function sendError(response, error) {
  if (response.headersSent) {
    response.destroy()
    return
  }
  const statusCode = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : 500
  const message = statusCode >= 500 ? "Internal server error" : error.message
  sendJson(response, statusCode, { detail: message })
}

export async function ensurePrivateDirectory(directory) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  const metadata = await fs.lstat(directory)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Unsafe directory: ${directory}`)
  }
  if (process.platform !== "win32") await fs.chmod(directory, 0o700)
  return path.resolve(directory)
}

export function parsePositiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

export function requiredEnvironment(environment, name) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function strictHttpUrl(raw, name, { loopback = false } = {}) {
  const value = new URL(raw)
  if (value.protocol !== "http:" && value.protocol !== "https:") {
    throw new Error(`${name} must use http or https`)
  }
  if (value.username || value.password || value.search || value.hash) {
    throw new Error(`${name} must not contain credentials, query, or fragment`)
  }
  if (
    loopback &&
    !["127.0.0.1", "::1", "localhost"].includes(value.hostname)
  ) {
    throw new Error(`${name} must use a loopback host`)
  }
  return value
}
