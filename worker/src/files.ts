import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

type DownloadOptions = {
  url: string
  destination: string
  expectedSha256: string
  expectedBytes?: number
  expectedMagic?: string
  maxBytes: number
  headers?: HeadersInit
  timeoutMs: number
}

export type VerifiedDownload = {
  path: string
  bytes: number
  sha256: string
}

export async function downloadVerifiedFile(
  options: DownloadOptions
): Promise<VerifiedDownload> {
  const expectedHash = options.expectedSha256.toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error("The application did not provide a valid SHA-256 digest")
  }

  await fs.mkdir(path.dirname(options.destination), { recursive: true })
  const temporary = `${options.destination}.part-${randomUUID()}`
  let handle: fs.FileHandle | undefined

  try {
    const response = await fetch(options.url, {
      headers: options.headers,
      signal: AbortSignal.timeout(options.timeoutMs),
    })
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status}`)
    }
    if (!response.body) {
      throw new Error("Download response did not contain a body")
    }

    const declaredLength = Number(response.headers.get("content-length"))
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > options.maxBytes
    ) {
      throw new Error("Download exceeds the configured worker file limit")
    }

    handle = await fs.open(temporary, "wx")
    const digest = createHash("sha256")
    const reader = response.body.getReader()
    let bytes = 0

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      bytes += value.byteLength
      if (bytes > options.maxBytes) {
        await reader.cancel()
        throw new Error("Download exceeds the configured worker file limit")
      }
      digest.update(value)
      let offset = 0
      while (offset < value.byteLength) {
        const { bytesWritten } = await handle.write(
          value,
          offset,
          value.byteLength - offset,
          null
        )
        if (bytesWritten < 1) {
          throw new Error("Download file write made no progress")
        }
        offset += bytesWritten
      }
    }

    await handle.close()
    handle = undefined

    const sha256 = digest.digest("hex")
    if (sha256 !== expectedHash) {
      throw new Error(
        `Downloaded file SHA-256 mismatch: expected ${expectedHash}, got ${sha256}`
      )
    }
    if (
      options.expectedBytes !== undefined &&
      bytes !== options.expectedBytes
    ) {
      throw new Error(
        `Downloaded file size mismatch: expected ${options.expectedBytes}, got ${bytes}`
      )
    }
    if (options.expectedMagic) {
      const magicHandle = await fs.open(temporary, "r")
      try {
        const prefix = Buffer.alloc(
          Buffer.byteLength(options.expectedMagic, "ascii")
        )
        await magicHandle.read(prefix, 0, prefix.length, 0)
        if (prefix.toString("ascii") !== options.expectedMagic) {
          throw new Error(
            `Downloaded file is missing ${options.expectedMagic} signature`
          )
        }
      } finally {
        await magicHandle.close()
      }
    }

    await fs.unlink(options.destination).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error
    })
    await fs.rename(temporary, options.destination)
    return { path: options.destination, bytes, sha256 }
  } catch (error) {
    await handle?.close().catch(() => undefined)
    await fs.unlink(temporary).catch(() => undefined)
    throw error
  }
}

export function safeFilename(value: string, fallback: string) {
  const basename = path.basename(value)
  const cleaned = basename.replace(/[^\w.-]+/g, "_").replace(/^\.+/, "")
  return cleaned || fallback
}
