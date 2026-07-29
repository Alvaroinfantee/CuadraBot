import { openAsBlob } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { workerConfig } from "./config"
import { downloadVerifiedFile } from "./files"

type TakeoffSubmission = {
  job_id: string
  status: "queued"
  status_url: string
}

type TakeoffArtifact = {
  name: string
  filename: string
  media_type: string
  bytes: number
  sha256: string
  download_url: string
}

type TakeoffJobRecord = {
  id: string
  status: "queued" | "running" | "completed" | "failed"
  stage: string
  progress: number
  artifacts: Record<string, TakeoffArtifact>
  error: string | null
  metrics: Record<string, unknown>
}

export type LocalTakeoffArtifact = {
  filename: string
  mediaType: string
  bytes: number
  sha256: string
  localPath: string
}

export type TakeoffProgressEvent = {
  stage: string
  progress: number
  message: string
  microserviceJobId: string
}

export class TakeoffServiceError extends Error {
  readonly stage: string
  readonly retryable: boolean

  constructor(message: string, stage: string, retryable: boolean) {
    super(message)
    this.name = "TakeoffServiceError"
    this.stage = stage
    this.retryable = retryable
  }
}

type RunTakeoffOptions = {
  sourcePdf: string
  outputDir: string
  instructions: string
  freeSample: boolean
  onProgress: (event: TakeoffProgressEvent) => Promise<void>
}

export async function assertTakeoffServiceReady() {
  const response = await fetch(`${workerConfig.takeoffServiceUrl}/readyz`, {
    signal: AbortSignal.timeout(workerConfig.apiTimeoutMs),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new TakeoffServiceError(
      `Takeoff service is not ready (${response.status}): ${detail.slice(0, 500)}`,
      "service_readiness",
      true
    )
  }
}

export async function runTakeoff({
  sourcePdf,
  outputDir,
  instructions,
  freeSample,
  onProgress,
}: RunTakeoffOptions) {
  await assertTakeoffServiceReady()
  const submission = await submitTakeoff(sourcePdf, instructions, freeSample)

  await onProgress({
    stage: "takeoff_queued",
    progress: 10,
    message: "Drawing package accepted by the takeoff service.",
    microserviceJobId: submission.job_id,
  })

  const job = await waitForTakeoff(submission, onProgress)
  const artifacts = await downloadArtifacts(job, outputDir)
  return {
    microserviceJobId: submission.job_id,
    metrics: job.metrics,
    artifacts,
  }
}

async function submitTakeoff(
  sourcePdf: string,
  instructions: string,
  freeSample: boolean
): Promise<TakeoffSubmission> {
  const form = new FormData()
  const source = await openAsBlob(sourcePdf, { type: "application/pdf" })
  form.append("drawings_pdf", source, path.basename(sourcePdf))
  if (instructions.trim()) {
    form.append("instructions", instructions.trim().slice(0, 20_000))
  }
  form.append("freeSample", freeSample ? "true" : "false")
  if (workerConfig.codexModel) {
    form.append("model", workerConfig.codexModel)
  }

  return takeoffJson<TakeoffSubmission>("/v1/jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${workerConfig.takeoffServiceToken}`,
      "x-codex-api-key": workerConfig.codexApiKey,
    },
    body: form,
  })
}

async function waitForTakeoff(
  submission: TakeoffSubmission,
  onProgress: (event: TakeoffProgressEvent) => Promise<void>
) {
  const deadline = Date.now() + workerConfig.takeoffJobTimeoutMs
  let lastState = ""
  let lastReportAt = 0

  while (Date.now() < deadline) {
    const job = await takeoffJson<TakeoffJobRecord>(submission.status_url, {
      headers: takeoffServiceHeaders(),
    })
    const state = `${job.status}:${job.stage}:${job.progress}`
    const now = Date.now()

    if (
      state !== lastState ||
      now - lastReportAt >= workerConfig.heartbeatIntervalMs
    ) {
      lastState = state
      lastReportAt = now
      await onProgress({
        stage: `takeoff_${job.stage}`,
        progress: Math.max(10, Math.min(84, 10 + Math.round(job.progress * 0.74))),
        message: `Takeoff service: ${job.stage}.`,
        microserviceJobId: submission.job_id,
      })
    }

    if (job.status === "completed") {
      return job
    }
    if (job.status === "failed") {
      throw new TakeoffServiceError(
        job.error || "The takeoff service reported a failed job",
        job.stage || "takeoff_failed",
        false
      )
    }
    await sleep(workerConfig.takeoffPollIntervalMs)
  }

  throw new TakeoffServiceError(
    "The takeoff service exceeded the configured job timeout",
    "takeoff_timeout",
    true
  )
}

async function downloadArtifacts(
  job: TakeoffJobRecord,
  outputDir: string
): Promise<LocalTakeoffArtifact[]> {
  await fs.mkdir(outputDir, { recursive: true })
  const artifacts = Object.values(job.artifacts).sort((left, right) =>
    left.filename.localeCompare(right.filename)
  )
  if (!artifacts.length) {
    throw new TakeoffServiceError(
      "Completed takeoff job did not expose any artifacts",
      "artifact_download",
      false
    )
  }

  const downloaded: LocalTakeoffArtifact[] = []
  for (const artifact of artifacts) {
    const filename = safeArtifactFilename(artifact.filename)
    const downloadUrl = takeoffArtifactUrl(
      artifact.download_url,
      job.id,
      filename
    )
    const localPath = path.join(outputDir, filename)
    const result = await downloadVerifiedFile({
      url: downloadUrl,
      destination: localPath,
      expectedSha256: artifact.sha256,
      expectedBytes: artifact.bytes,
      maxBytes: workerConfig.maxFileBytes,
      headers: takeoffServiceHeaders(),
      timeoutMs: workerConfig.artifactUploadTimeoutMs,
    })
    downloaded.push({
      filename,
      mediaType: artifact.media_type || "application/octet-stream",
      bytes: result.bytes,
      sha256: result.sha256,
      localPath: result.path,
    })
  }
  return downloaded
}

async function takeoffJson<T>(
  pathName: string,
  init: RequestInit
): Promise<T> {
  const url = new URL(pathName, `${workerConfig.takeoffServiceUrl}/`)
  if (url.origin !== new URL(workerConfig.takeoffServiceUrl).origin) {
    throw new TakeoffServiceError(
      "Takeoff service returned a cross-origin URL",
      "service_protocol",
      false
    )
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(workerConfig.artifactUploadTimeoutMs),
    })
  } catch (error) {
    throw new TakeoffServiceError(
      error instanceof Error ? error.message : String(error),
      "service_request",
      true
    )
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String(body.detail)
        : `HTTP ${response.status}`
    throw new TakeoffServiceError(
      `Takeoff service request failed: ${detail}`,
      "service_request",
      response.status === 408 || response.status === 429 || response.status >= 500
    )
  }
  return body as T
}

function takeoffServiceHeaders() {
  return {
    authorization: `Bearer ${workerConfig.takeoffServiceToken}`,
  }
}

function safeArtifactFilename(filename: string) {
  if (path.basename(filename) !== filename || !/^[\w.-]{1,180}$/.test(filename)) {
    throw new TakeoffServiceError(
      "Takeoff service returned an unsafe artifact filename",
      "service_protocol",
      false
    )
  }
  return filename
}

function takeoffArtifactUrl(
  downloadUrl: string,
  microserviceJobId: string,
  filename: string
) {
  const url = new URL(downloadUrl, `${workerConfig.takeoffServiceUrl}/`)
  const service = new URL(workerConfig.takeoffServiceUrl)
  const expectedPath = `/v1/jobs/${microserviceJobId}/artifacts/${filename}`
  if (url.origin !== service.origin || url.pathname !== expectedPath) {
    throw new TakeoffServiceError(
      "Takeoff service returned an unexpected artifact URL",
      "service_protocol",
      false
    )
  }
  return url.toString()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
