import fs from "node:fs/promises"
import path from "node:path"
import {
  claimJob,
  completeJob,
  failJob,
  getJobInput,
  getNextJob,
  reportWorkerHealth,
  updateJobProgress,
  uploadArtifacts,
  WorkerApiError,
} from "./api"
import { workerConfig } from "./config"
import { downloadVerifiedFile, safeFilename } from "./files"
import {
  assertTakeoffServiceReady,
  runTakeoff,
  TakeoffServiceError,
} from "./takeoff"

let stopping = false
let healthReportRunning = false

process.once("SIGINT", () => {
  stopping = true
})
process.once("SIGTERM", () => {
  stopping = true
})

async function processOnce() {
  const nextJob = await getNextJob()
  if (!nextJob) return false

  let job
  try {
    job = await claimJob(nextJob.id)
  } catch (error) {
    if (error instanceof WorkerApiError && error.status === 409) {
      return true
    }
    throw error
  }
  const claimToken = job.claim_token
  if (
    typeof claimToken !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(claimToken)
  ) {
    throw new Error("Application did not return a valid worker claim token")
  }

  const jobDir = localJobDirectory(job.id)
  const inputDir = path.join(jobDir, "input")
  const outputDir = path.join(jobDir, "output")
  let stage = "claimed"

  try {
    await fs.mkdir(inputDir, { recursive: true })
    await fs.mkdir(outputDir, { recursive: true })

    stage = "input_download"
    await updateJobProgress(job.id, claimToken, {
      stage,
      progress: 2,
      message: `Worker ${workerConfig.workerId} is downloading the source PDF.`,
    })

    const input = await getJobInput(job.id, claimToken)
    if (input.job.id !== job.id) {
      throw new Error("Input endpoint returned a different job")
    }
    const filename = ensurePdfFilename(input.job.original_filename)
    const sourcePdf = path.join(inputDir, filename)
    await downloadVerifiedFile({
      url: input.signedUrl,
      destination: sourcePdf,
      expectedSha256: input.job.source_sha256,
      expectedMagic: "%PDF-",
      maxBytes: workerConfig.maxFileBytes,
      timeoutMs: workerConfig.artifactUploadTimeoutMs,
    })

    stage = "takeoff_processing"
    const result = await runTakeoff({
      sourcePdf,
      outputDir,
      workflowKind: input.job.workflow_kind,
      requestedScopes: input.job.requested_scopes,
      customerInstructions: input.job.customer_instructions,
      freeSample: input.job.free_sample === true,
      onProgress: (progress) => {
        stage = progress.stage
        return updateJobProgress(job.id, claimToken, progress).then(
          () => undefined
        )
      },
    })

    stage = "artifact_upload"
    await updateJobProgress(job.id, claimToken, {
      stage,
      progress: 88,
      message: `Uploading ${result.artifacts.length} verified takeoff artifacts.`,
      microserviceJobId: result.microserviceJobId,
    })
    const uploaded = await uploadArtifacts(
      job.id,
      claimToken,
      result.microserviceJobId,
      result.artifacts
    )

    stage = "delivery"
    await updateJobProgress(job.id, claimToken, {
      stage,
      progress: 99,
      message: "Takeoff artifacts uploaded; completing self-serve delivery.",
      microserviceJobId: result.microserviceJobId,
    })
    await completeJob(job.id, claimToken, result.metrics, uploaded.artifacts)

    console.log(
      `[${job.id}] takeoff complete; ${result.artifacts.length} artifact(s) delivered`
    )
    return true
  } catch (error) {
    const failure = classifyFailure(error, stage)
    console.error(`[${job.id}] ${failure.stage} failed: ${failure.message}`)
    await reportFailure(job.id, claimToken, failure)
    return true
  } finally {
    if (!workerConfig.keepLocalJobFiles) {
      await removeLocalJobDirectory(jobDir).catch((error) => {
        console.error(`[${job.id}] failed to clean local files`, error)
      })
    }
  }
}

async function reportFailure(
  jobId: string,
  claimToken: string,
  failure: { stage: string; message: string; retryable: boolean }
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await failJob(jobId, claimToken, failure)
      return
    } catch (error) {
      console.error(
        `[${jobId}] failure report attempt ${attempt} failed`,
        error
      )
      if (attempt < 3) await sleep(attempt * 1_000)
    }
  }
  console.error(
    `[${jobId}] CRITICAL: application was not notified; reserved credits may require reconciliation`
  )
}

function classifyFailure(error: unknown, fallbackStage: string) {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof TakeoffServiceError) {
    return {
      stage: error.stage || fallbackStage,
      message: message.slice(0, 2_000),
      retryable: error.retryable,
    }
  }
  if (error instanceof WorkerApiError) {
    return {
      stage: fallbackStage,
      message: message.slice(0, 2_000),
      retryable: error.retryable,
    }
  }
  const retryable =
    error instanceof TypeError ||
    (error instanceof Error && error.name === "TimeoutError")
  return {
    stage: fallbackStage,
    message: message.slice(0, 2_000),
    retryable,
  }
}

function localJobDirectory(jobId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) {
    throw new Error("Application returned an unsafe job identifier")
  }
  const root = path.resolve(workerConfig.localJobsDir)
  const destination = path.resolve(root, jobId)
  if (path.dirname(destination) !== root) {
    throw new Error("Resolved job directory escaped the worker root")
  }
  return destination
}

async function removeLocalJobDirectory(jobDir: string) {
  const root = path.resolve(workerConfig.localJobsDir)
  const destination = path.resolve(jobDir)
  if (path.dirname(destination) !== root) {
    throw new Error("Refusing to remove a directory outside the worker root")
  }
  await fs.rm(destination, { recursive: true, force: true })
}

function ensurePdfFilename(filename: string) {
  const safe = safeFilename(filename, "source.pdf")
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`
}

async function main() {
  await fs.mkdir(workerConfig.localJobsDir, { recursive: true })
  console.log(
    `CuadraBot takeoff worker ${workerConfig.workerId} polling ${workerConfig.apiUrl}`
  )

  const healthTimer = setInterval(() => {
    void reportHealthSnapshot().catch((error) => {
      console.error("Worker health report failed", error)
    })
  }, workerConfig.heartbeatIntervalMs)
  healthTimer.unref()

  await reportHealthSnapshot().catch((error) => {
    console.error("Initial worker health report failed", error)
  })

  try {
    while (!stopping) {
      try {
        const processed = await processOnce()
        if (!processed) await sleep(workerConfig.pollIntervalMs)
      } catch (error) {
        console.error("Worker poll failed", error)
        await reportHealthSnapshot(
          "degraded",
          `The worker poll loop failed: ${safeMessage(error)}`
        ).catch((reportError) => {
          console.error("Degraded worker health report failed", reportError)
        })
        await sleep(workerConfig.pollIntervalMs)
      }
    }
  } finally {
    clearInterval(healthTimer)
  }

  console.log("Worker stopped")
}

async function reportHealthSnapshot(
  workerStatus: "healthy" | "degraded" | "down" = "healthy",
  workerMessage = "The takeoff worker poll loop is running."
) {
  if (healthReportRunning) return
  healthReportRunning = true
  try {
    let processorStatus: "healthy" | "degraded" | "down" = "healthy"
    let processorMessage = "The takeoff processor readiness check passed."
    try {
      await assertTakeoffServiceReady()
    } catch (error) {
      processorStatus =
        error instanceof TakeoffServiceError && error.retryable
          ? "degraded"
          : "down"
      processorMessage = `The takeoff processor readiness check failed: ${safeMessage(error)}`
    }

    await reportWorkerHealth({
      workerStatus,
      workerMessage,
      processorStatus,
      processorMessage,
      ttlSeconds: Math.min(
        900,
        Math.max(60, Math.ceil((workerConfig.heartbeatIntervalMs * 3) / 1_000))
      ),
    })
  } finally {
    healthReportRunning = false
  }
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 800)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
