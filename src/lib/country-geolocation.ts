import { isIP } from "node:net"

const countryLookupOrigin = "https://api.country.is/"
const countryLookupTimeoutMs = 1_500
const countryLookupResponseLimitBytes = 1_024

export async function lookupCountryCode(
  ip: string,
  fetchImplementation: typeof fetch = fetch
) {
  if (isIP(ip) === 0) return null

  try {
    const response = await fetchImplementation(
      new URL(encodeURIComponent(ip), countryLookupOrigin),
      {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(countryLookupTimeoutMs),
      }
    )
    if (!response.ok) return null

    const raw = await readBoundedResponse(
      response,
      countryLookupResponseLimitBytes
    )
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }

    const country = (parsed as Record<string, unknown>).country
    if (typeof country !== "string") return null
    const normalized = country.trim().toUpperCase()
    return /^[A-Z]{2}$/.test(normalized) ? normalized : null
  } catch {
    return null
  }
}

async function readBoundedResponse(response: Response, limit: number) {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > limit) return null
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(joined)
}
