import fs from "node:fs/promises"
import path from "node:path"
import {
  claimJob,
  downloadSignedFile,
  getJobFiles,
  getNextJob,
  updateJobStatus,
  uploadFinalFiles,
} from "./api"
import { workerConfig } from "./config"
import { runBlenderRender } from "./render"

async function processOnce() {
  const nextJob = await getNextJob()

  if (!nextJob) {
    return false
  }

  const job = await claimJob(nextJob.id)
  const jobDir = path.join(workerConfig.localJobsDir, job.order_number)
  const inputDir = path.join(jobDir, "input")
  const outputDir = path.join(jobDir, "output")

  try {
    await fs.mkdir(inputDir, { recursive: true })
    await fs.mkdir(outputDir, { recursive: true })
    await updateJobStatus(job.id, "processing", {
      logs: `Worker ${workerConfig.workerId} started ${job.order_number}.`,
    })

    const files = await getJobFiles(job.id)
    for (const file of files) {
      await downloadSignedFile(file, inputDir)
    }

    const outputFiles = await runBlenderRender({ job, inputDir, outputDir })
    await uploadFinalFiles(job.id, outputFiles)
    await updateJobStatus(job.id, "needs_review", {
      logs: `Uploaded ${outputFiles.length} final file(s). Awaiting owner review.`,
    })

    console.log(`[${job.order_number}] completed worker pass, awaiting review`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[${job.order_number}] failed`, message)
    await updateJobStatus(job.id, "failed", {
      error_message: message,
      logs: `Worker ${workerConfig.workerId} failed while processing ${job.order_number}.`,
    }).catch((statusError) => {
      console.error("Failed to report worker failure", statusError)
    })
    return true
  }
}

async function main() {
  await fs.mkdir(workerConfig.localJobsDir, { recursive: true })
  console.log(`Cuadrabot worker ${workerConfig.workerId} polling ${workerConfig.apiUrl}`)

  for (;;) {
    try {
      const processed = await processOnce()
      if (!processed) {
        await sleep(workerConfig.pollIntervalMs)
      }
    } catch (error) {
      console.error("Worker poll failed", error)
      await sleep(workerConfig.pollIntervalMs)
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
