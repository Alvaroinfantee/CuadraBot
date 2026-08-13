import * as tus from "tus-js-client"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export const SUPABASE_TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024
export const SUPABASE_TUS_RETRY_DELAYS_MS = [
  0,
  3_000,
  5_000,
  10_000,
  20_000,
] as const

export type SignedResumableUploadGrant = {
  endpoint: string
  bucket: string
  path: string
  token: string
}

export class ResumableUploadCancelledError extends Error {
  constructor() {
    super("The upload was paused by the user.")
    this.name = "ResumableUploadCancelledError"
  }
}

export type ResumableUploadTask = {
  upload: tus.Upload
  start: () => Promise<void>
  cancel: () => Promise<void>
}

type TusErrorResponse = {
  getStatus?: () => number
  getBody?: () => string
}

export function resumableUploadFingerprint(
  file: Pick<File, "name" | "size" | "type" | "lastModified">,
  grant: Pick<SignedResumableUploadGrant, "bucket" | "path">
) {
  return [
    "cuadrabot-supabase-tus-v1",
    grant.bucket,
    grant.path,
    file.name,
    file.type,
    file.size,
    file.lastModified,
  ].join("::")
}

export function createSignedResumableUploadTask(options: {
  file: File
  grant: SignedResumableUploadGrant
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void
}): ResumableUploadTask {
  const { file, grant, onProgress } = options
  let cancelled = false
  let settled = false
  let resolveCompletion!: () => void
  let rejectCompletion!: (error: Error) => void

  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve
    rejectCompletion = reject
  })

  function resolveOnce() {
    if (settled) return
    settled = true
    resolveCompletion()
  }

  function rejectOnce(error: Error) {
    if (settled) return
    settled = true
    rejectCompletion(error)
  }

  const upload = new tus.Upload(file, {
    endpoint: grant.endpoint,
    retryDelays: [...SUPABASE_TUS_RETRY_DELAYS_MS],
    headers: {
      "x-signature": grant.token,
    },
    uploadDataDuringCreation: true,
    chunkSize: SUPABASE_TUS_CHUNK_SIZE_BYTES,
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: true,
    fingerprint: async () => resumableUploadFingerprint(file, grant),
    metadata: {
      bucketName: grant.bucket,
      objectName: grant.path,
      contentType: "application/pdf",
      cacheControl: "3600",
    },
    onProgress,
    onError(error) {
      if (!cancelled) rejectOnce(error)
    },
    onSuccess() {
      resolveOnce()
    },
  })

  return {
    upload,
    async start() {
      if (!tus.isSupported) {
        throw new Error(
          "This browser does not support resumable uploads. Use a current browser."
        )
      }

      const previousUploads = await upload.findPreviousUploads()
      if (cancelled) return completion

      const previousUpload = [...previousUploads].sort(
        (left, right) =>
          previousUploadTimestamp(right.creationTime) -
          previousUploadTimestamp(left.creationTime)
      )[0]
      if (previousUpload) upload.resumeFromPreviousUpload(previousUpload)

      upload.start()
      return completion
    },
    async cancel() {
      if (settled || cancelled) return
      cancelled = true
      try {
        await upload.abort(false)
      } finally {
        rejectOnce(new ResumableUploadCancelledError())
      }
    },
  }
}

export async function uploadSmallFileToSignedUrl(options: {
  file: File
  grant: SignedResumableUploadGrant
}) {
  const { file, grant } = options
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.storage
    .from(grant.bucket)
    .uploadToSignedUrl(grant.path, grant.token, file, {
      contentType: "application/pdf",
      cacheControl: "3600",
    })

  if (error) throw error
}

export function signedTusNeedsStandardFallback(error: unknown) {
  if (!(error instanceof Error)) return false

  const response = (
    error as Error & { originalResponse?: TusErrorResponse | null }
  ).originalResponse
  const status = response?.getStatus?.()
  const body = response?.getBody?.() ?? error.message

  return status === 400 && body.includes("Invalid Compact JWS")
}

function previousUploadTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : 0
}
