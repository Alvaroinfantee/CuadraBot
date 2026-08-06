import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import http from "node:http"
import test from "node:test"

test("worker retries authenticated broker cleanup and requires no OpenAI master key", async (t) => {
  const requests = []
  const broker = http.createServer((request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers })
    response.statusCode = requests.length < 3 ? 500 : 204
    response.end(requests.length < 3 ? "retry" : undefined)
  })
  const brokerUrl = await listen(broker)
  t.after(() => close(broker))

  const jobId = "f".repeat(32)
  const result = await runWorkerCleanupChild(brokerUrl, jobId)
  assert.deepEqual(result, {
    invalidStage: "takeoff_cleanup",
    invalidRetryable: false,
  })
  assert.equal(requests.length, 3)
  assert.ok(requests.every((request) => request.method === "DELETE"))
  assert.ok(requests.every((request) => request.url === `/v1/jobs/${jobId}`))
  assert.ok(
    requests.every(
      (request) =>
        request.headers.authorization === "Bearer test-broker-secret"
    )
  )
  assert.equal(requests.length, 3)
})

test("worker cleanup is in the per-attempt finally block and direct keys are absent", async () => {
  const indexSource = await fs.readFile(
    new URL("../../worker/src/index.ts", import.meta.url),
    "utf8"
  )
  const configSource = await fs.readFile(
    new URL("../../worker/src/config.ts", import.meta.url),
    "utf8"
  )
  const takeoffSource = await fs.readFile(
    new URL("../../worker/src/takeoff.ts", import.meta.url),
    "utf8"
  )
  assert.match(
    indexSource,
    /finally\s*\{[\s\S]*cleanupTakeoffJob\(microserviceJobId\)[\s\S]*removeLocalJobDirectory/
  )
  assert.doesNotMatch(configSource, /CODEX_API_KEY|codexApiKey/)
  assert.doesNotMatch(takeoffSource, /workerConfig\.codexApiKey/)
  assert.match(takeoffSource, /"x-cuadrabot-user-id": userId/)
  assert.match(takeoffSource, /"x-cuadrabot-budget-class": budgetClass/)
  assert.match(indexSource, /executorBudgetClassForJob\(job\)/)
})

test("worker derives executor budgets only from consistent server pricing fields", async () => {
  const result = await runWorkerBudgetChild()
  assert.deepEqual(result.valid, [
    "free_sample",
    "first_verified",
    "essential",
    "professional",
    "multi_trade",
    "large_set",
  ])
  assert.equal(result.invalidStage, "service_protocol")
})

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject)
      resolve(`http://127.0.0.1:${server.address().port}`)
    })
  })
}

function close(server) {
  if (!server.listening) return Promise.resolve()
  return new Promise((resolve) => server.close(resolve))
}

function runWorkerCleanupChild(brokerUrl, jobId) {
  const source = `
    const loaded = await import("./worker/src/takeoff.ts")
    const cleanupTakeoffJob =
      loaded.cleanupTakeoffJob ?? loaded.default?.cleanupTakeoffJob
    await cleanupTakeoffJob(${JSON.stringify(jobId)})
    let invalid
    try {
      await cleanupTakeoffJob("../escape")
    } catch (error) {
      invalid = {
        invalidStage: error.stage,
        invalidRetryable: error.retryable,
      }
    }
    console.log(JSON.stringify(invalid))
  `
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", source],
      {
        cwd: process.cwd(),
        windowsHide: true,
        env: {
          ...process.env,
          CUADRABOT_API_URL: "http://127.0.0.1:1",
          WORKER_SHARED_SECRET: "test-worker-secret",
          TAKEOFF_SERVICE_URL: brokerUrl,
          TAKEOFF_SERVICE_API_TOKEN: "test-broker-secret",
          CODEX_API_KEY: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    const stdout = []
    const stderr = []
    child.stdout.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.once("error", reject)
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8")))
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString("utf8").trim()))
      } catch (error) {
        reject(error)
      }
    })
  })
}

function runWorkerBudgetChild() {
  const source = `
    const loaded = await import("./worker/src/takeoff.ts")
    const derive = loaded.executorBudgetClassForJob ?? loaded.default?.executorBudgetClassForJob
    const tiers = [
      ["free_sample", 0, true],
      ["first_verified", 49, false],
      ["essential", 99, false],
      ["professional", 179, false],
      ["multi_trade", 299, false],
      ["large_set", 499, false],
    ]
    const valid = tiers.map(([scope, quoted_credits, free_sample]) =>
      derive({ scope, quoted_credits, free_sample })
    )
    let invalidStage
    try {
      derive({ scope: "essential", quoted_credits: 0, free_sample: false })
    } catch (error) {
      invalidStage = error.stage
    }
    console.log(JSON.stringify({ valid, invalidStage }))
  `
  return spawnWorkerChild(source)
}

function spawnWorkerChild(source) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", source],
      {
        cwd: process.cwd(),
        windowsHide: true,
        env: {
          ...process.env,
          CUADRABOT_API_URL: "http://127.0.0.1:1",
          WORKER_SHARED_SECRET: "test-worker-secret",
          TAKEOFF_SERVICE_URL: "http://127.0.0.1:2",
          TAKEOFF_SERVICE_API_TOKEN: "test-broker-secret",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    const stdout = []
    const stderr = []
    child.stdout.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.once("error", reject)
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8")))
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString("utf8").trim()))
      } catch (error) {
        reject(error)
      }
    })
  })
}
