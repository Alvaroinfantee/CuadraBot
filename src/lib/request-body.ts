export const requestBodyLimits = Object.freeze({
  localeJson: 1 * 1024,
  takeoffDraftJson: 32 * 1024,
  takeoffSubmitJson: 4 * 1024,
  billingJson: 4 * 1024,
  workerClaimJson: 4 * 1024,
  workerStatusJson: 16 * 1024,
  workerResultJson: 64 * 1024,
  stripeWebhook: 1 * 1024 * 1024,
})

export type BoundedRequestBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "invalid" | "too_large" }

export async function readRequestBytesWithLimit(
  request: Request,
  maxBytes: number
): Promise<BoundedRequestBodyResult<Buffer>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer.")
  }

  const contentLength = request.headers.get("content-length")
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength)
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      await request.body?.cancel().catch(() => undefined)
      return { ok: false, reason: "invalid" }
    }
    if (declaredBytes > maxBytes) {
      await request.body?.cancel().catch(() => undefined)
      return { ok: false, reason: "too_large" }
    }
  }

  if (!request.body) return { ok: true, value: Buffer.alloc(0) }

  const reader = request.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array) || value.byteLength === 0) continue

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, reason: "too_large" }
      }
      chunks.push(Buffer.from(value))
    }
  } catch {
    await reader.cancel().catch(() => undefined)
    return { ok: false, reason: "invalid" }
  } finally {
    reader.releaseLock()
  }

  return { ok: true, value: Buffer.concat(chunks, totalBytes) }
}

export async function readRequestTextWithLimit(
  request: Request,
  maxBytes: number
): Promise<BoundedRequestBodyResult<string>> {
  const result = await readRequestBytesWithLimit(request, maxBytes)
  if (!result.ok) return result

  try {
    return {
      ok: true,
      value: new TextDecoder("utf-8", { fatal: true }).decode(result.value),
    }
  } catch {
    return { ok: false, reason: "invalid" }
  }
}

export async function readRequestJsonWithLimit(
  request: Request,
  maxBytes: number
): Promise<BoundedRequestBodyResult<unknown>> {
  const result = await readRequestTextWithLimit(request, maxBytes)
  if (!result.ok) return result

  try {
    return { ok: true, value: JSON.parse(result.value) }
  } catch {
    return { ok: false, reason: "invalid" }
  }
}
