import { openAsBlob } from "node:fs"
import type { LocalTakeoffArtifact } from "./takeoff"
import { workerConfig } from "./config"

export const TAKEOFF_WORKER_ENDPOINTS = {
  health: "/api/internal/worker/takeoff/health",
  next: "/api/internal/worker/takeoff/jobs/next",
  claim: (jobId: string) => `/api/internal/worker/takeoff/jobs/${jobId}/claim`,
  input: (jobId: string) => `/api/internal/worker/takeoff/jobs/${jobId}/input`,
  progress: (jobId: string) => `/api/internal/worker/takeoff/jobs/${jobId}/progress`,
  artifacts: (jobId: string) => `/api/internal/worker/takeoff/jobs/${jobId}/artifacts`,
  complete: (jobId: string) => `/api/internal/worker/takeoff/jobs/${jobId}/complete`,
  fail: (jobId: string) => `/api/internal/worker/takeoff/jobs/${jobId}/fail`,
} as const

export type WorkerJob = {
  id: string
  status: string
  created_at?: string
  claimed_by?: string | null
  claim_token?: string | null
}

export type WorkerInputJob = WorkerJob & {
  source_sha256: string
  original_filename: string
  instructions: string | null
  page_count: number | null
  free_sample: boolean
}

export type WorkerProgress = {
  stage: string
  progress: number
  message?: string
  microserviceJobId?: string
}

export type WorkerFailure = {
  stage: string
  message: string
  retryable: boolean
}

export type WorkerHealthReport = {
  workerStatus: "healthy" | "degraded" | "down"
  workerMessage?: string
  processorStatus: "healthy" | "degraded" | "down"
  processorMessage?: string
  ttlSeconds: number
}

export type UploadedArtifactsResponse = {
  artifacts: unknown[]
}

type ArtifactDescriptor = {
  filename: string
  mediaType: string
  bytes: number
  sha256: string
}

type ArtifactUploadDestination = ArtifactDescriptor & {
  storagePath: string
  state: "upload_required" | "already_uploaded" | "registered"
  signedUrl: string | null
}

export class WorkerApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "WorkerApiError"
    this.status = status
  }

  get retryable() {
    return this.status === 408 || this.status === 429 || this.status >= 500
  }
}

function workerHeaders(extra?: HeadersInit, claimToken?: string) {
  const headers = new Headers(extra)
  headers.set("authorization", `Bearer ${workerConfig.sharedSecret}`)
  headers.set("x-worker-id", workerConfig.workerId)
  if (claimToken) headers.set("x-claim-token", claimToken)
  return headers
}

async function apiJson<T>(
  pathName: string,
  init?: RequestInit,
  timeoutMs = workerConfig.apiTimeoutMs,
  claimToken?: string
): Promise<T> {
  const response = await fetch(`${workerConfig.apiUrl}${pathName}`, {
    ...init,
    cache: "no-store",
    headers: workerHeaders(init?.headers, claimToken),
    signal: AbortSignal.timeout(timeoutMs),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : `Request failed: ${response.status}`
    throw new WorkerApiError(message, response.status)
  }

  return body as T
}

export async function getNextJob() {
  const data = await apiJson<{ job: WorkerJob | null }>(
    TAKEOFF_WORKER_ENDPOINTS.next
  )
  return data.job
}

export async function reportWorkerHealth(report: WorkerHealthReport) {
  return apiJson<{ reported: true; expiresAt: string }>(
    TAKEOFF_WORKER_ENDPOINTS.health,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    }
  )
}

export async function claimJob(jobId: string) {
  const data = await apiJson<{ job: WorkerJob }>(
    TAKEOFF_WORKER_ENDPOINTS.claim(jobId),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workerId: workerConfig.workerId }),
    }
  )
  return data.job
}

export async function getJobInput(jobId: string, claimToken: string) {
  return apiJson<{ job: WorkerInputJob; signedUrl: string }>(
    TAKEOFF_WORKER_ENDPOINTS.input(jobId),
    undefined,
    workerConfig.apiTimeoutMs,
    claimToken
  )
}

export async function updateJobProgress(
  jobId: string,
  claimToken: string,
  progress: WorkerProgress
) {
  return apiJson<{ job: WorkerJob }>(
    TAKEOFF_WORKER_ENDPOINTS.progress(jobId),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(progress),
    },
    workerConfig.apiTimeoutMs,
    claimToken
  )
}

export async function uploadArtifacts(
  jobId: string,
  claimToken: string,
  microserviceJobId: string,
  artifacts: LocalTakeoffArtifact[]
) {
  const descriptors: ArtifactDescriptor[] = artifacts.map((artifact) => ({
    filename: artifact.filename,
    mediaType: artifact.mediaType,
    bytes: artifact.bytes,
    sha256: artifact.sha256,
  }))

  const prepared = await apiJson<{ uploads: ArtifactUploadDestination[] }>(
    TAKEOFF_WORKER_ENDPOINTS.artifacts(jobId),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "prepare",
        microserviceJobId,
        artifacts: descriptors,
      }),
    },
    workerConfig.apiTimeoutMs,
    claimToken
  )
  const destinations = validateUploadDestinations(
    jobId,
    claimToken,
    descriptors,
    prepared.uploads
  )

  const directUploadFailures: string[] = []
  for (const artifact of artifacts) {
    const destination = destinations.get(artifact.filename)
    if (!destination) {
      throw new Error(
        `Application did not prepare an upload for ${artifact.filename}`
      )
    }
    if (destination.state !== "upload_required") continue
    const failure = await uploadArtifactDirectly(artifact, destination)
    if (failure) directUploadFailures.push(failure)
  }

  let finalized: UploadedArtifactsResponse
  try {
    finalized = await apiJson<UploadedArtifactsResponse>(
      TAKEOFF_WORKER_ENDPOINTS.artifacts(jobId),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          microserviceJobId,
          artifacts: descriptors,
        }),
      },
      workerConfig.artifactUploadTimeoutMs,
      claimToken
    )
  } catch (error) {
    if (directUploadFailures.length) {
      throw new WorkerApiError(
        `Direct artifact upload could not be verified: ${directUploadFailures.join("; ")}`,
        503
      )
    }
    throw error
  }

  if (
    !Array.isArray(finalized.artifacts) ||
    finalized.artifacts.length !== descriptors.length
  ) {
    throw new Error("Application returned an invalid finalized artifact list")
  }
  return finalized
}

function validateUploadDestinations(
  jobId: string,
  claimToken: string,
  descriptors: ArtifactDescriptor[],
  value: unknown
) {
  if (!Array.isArray(value) || value.length !== descriptors.length) {
    throw new Error("Application returned an invalid upload destination list")
  }

  const expected = new Map(
    descriptors.map((descriptor) => [descriptor.filename, descriptor])
  )
  const destinations = new Map<string, ArtifactUploadDestination>()

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") {
      throw new Error("Application returned an invalid upload destination")
    }
    const destination = candidate as ArtifactUploadDestination
    const descriptor = expected.get(destination.filename)
    if (
      !descriptor ||
      destinations.has(destination.filename) ||
      destination.mediaType !== descriptor.mediaType ||
      destination.bytes !== descriptor.bytes ||
      destination.sha256 !== descriptor.sha256 ||
      typeof destination.storagePath !== "string" ||
      !destination.storagePath.endsWith(
        `/${jobId}/results/${claimToken}/${descriptor.filename}`
      ) ||
      !["upload_required", "already_uploaded", "registered"].includes(
        destination.state
      )
    ) {
      throw new Error("Application returned a mismatched upload destination")
    }

    if (destination.state === "upload_required") {
      assertSignedUploadUrl(destination)
    } else if (destination.signedUrl !== null) {
      throw new Error(
        "Application returned a signed URL for a completed upload destination"
      )
    }
    destinations.set(destination.filename, destination)
  }

  return destinations
}

function assertSignedUploadUrl(destination: ArtifactUploadDestination) {
  if (typeof destination.signedUrl !== "string") {
    throw new Error("Application omitted a required signed upload URL")
  }
  const url = new URL(destination.signedUrl)
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Application returned an unsafe signed upload URL")
  }

  const decodedPath = decodeURIComponent(url.pathname)
  const expectedSuffix =
    `/storage/v1/object/upload/sign/takeoff-results/` +
    destination.storagePath
  if (!decodedPath.endsWith(expectedSuffix)) {
    throw new Error("Signed upload URL does not match its storage path")
  }
}

async function uploadArtifactDirectly(
  artifact: LocalTakeoffArtifact,
  destination: ArtifactUploadDestination
) {
  const blob = await openAsBlob(artifact.localPath, {
    type: artifact.mediaType,
  })
  try {
    const response = await fetch(destination.signedUrl!, {
      method: "PUT",
      headers: {
        "cache-control": "max-age=3600",
        "content-type": artifact.mediaType,
        "x-upsert": "false",
      },
      body: blob,
      redirect: "error",
      signal: AbortSignal.timeout(workerConfig.artifactUploadTimeoutMs),
    })

    if (!response.ok) {
      // A duplicate or an ambiguous response can still be a successful
      // identical retry. Finalization is authoritative because the app
      // streams the stored object and verifies its exact size and SHA-256.
      await response.body?.cancel().catch(() => undefined)
      return `${artifact.filename} returned HTTP ${response.status}`
    }
    return null
  } catch (error) {
    return `${artifact.filename}: ${
      error instanceof Error ? error.message : String(error)
    }`
  }
}

export async function completeJob(
  jobId: string,
  claimToken: string,
  metrics: Record<string, unknown>,
  artifacts: unknown
) {
  return apiJson<{ job: WorkerJob }>(
    TAKEOFF_WORKER_ENDPOINTS.complete(jobId),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metrics, artifacts }),
    },
    workerConfig.apiTimeoutMs,
    claimToken
  )
}

export async function failJob(
  jobId: string,
  claimToken: string,
  failure: WorkerFailure
) {
  return apiJson<{ job: WorkerJob }>(
    TAKEOFF_WORKER_ENDPOINTS.fail(jobId),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(failure),
    },
    workerConfig.apiTimeoutMs,
    claimToken
  )
}
