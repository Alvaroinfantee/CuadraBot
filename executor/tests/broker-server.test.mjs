import assert from "node:assert/strict"
import http from "node:http"
import test from "node:test"
import {
  createBrokerServer,
  processorConnectionOptions,
} from "../src/broker-server.mjs"

const BROKER_TOKEN = "broker-token-that-is-at-least-32-characters"
const PROCESSOR_TOKEN = "processor-token-distinct-from-egress"
const EGRESS_TOKEN = "cbe_ephemeral-submit-only-token"
const PROCESSOR_JOB_ID = "e".repeat(32)

test("broker prefers a private Unix socket and retains TCP test compatibility", () => {
  assert.deepEqual(processorConnectionOptions({ socketPath: "/private/job.sock" }), {
    socketPath: "/private/job.sock",
  })
  assert.deepEqual(processorConnectionOptions({ host: "127.0.0.1", port: 49152 }), {
    host: "127.0.0.1",
    port: 49152,
  })
})

test("broker authenticates, sends the egress token only on processor submit, and binds the job", async (t) => {
  const processorRequests = []
  const processor = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    processorRequests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      bytes: Buffer.concat(chunks).length,
    })
    response.writeHead(202, { "content-type": "application/json" })
    response.end(
      JSON.stringify({
        job_id: PROCESSOR_JOB_ID,
        status: "queued",
        status_url: `/v1/jobs/${PROCESSOR_JOB_ID}`,
      })
    )
  })
  const processorUrl = new URL(await listen(processor))
  t.after(() => close(processor))

  const calls = { starts: [], binds: [], cleanups: [] }
  const runtime = {
    record: { executionId: "a".repeat(32) },
    endpoint: {
      host: processorUrl.hostname,
      port: Number(processorUrl.port),
      origin: processorUrl.origin,
    },
    processorToken: PROCESSOR_TOKEN,
    egressToken: EGRESS_TOKEN,
  }
  const controller = {
    async assertReady() {},
    recoverProcessorJob() {
      return calls.binds.length ? PROCESSOR_JOB_ID : null
    },
    async startExecution(input) {
      calls.starts.push(input)
      return runtime
    },
    async bindProcessorJob(...input) {
      calls.binds.push(input)
    },
    async cleanupExecution(id) {
      calls.cleanups.push(id)
    },
    async cleanupProcessorJob(id) {
      calls.cleanups.push(id)
    },
  }
  const broker = createBrokerServer({ config: brokerConfig(), controller })
  const brokerUrl = await listen(broker)
  t.after(() => close(broker))

  const unauthorized = await fetch(`${brokerUrl}/v1/jobs`, { method: "POST" })
  assert.equal(unauthorized.status, 401)
  assert.equal(calls.starts.length, 0)

  const form = new FormData()
  form.append("drawings_pdf", new Blob(["%PDF-test"], { type: "application/pdf" }), "plans.pdf")
  form.append("workflowKind", "legend_fixture_takeoff_v1")
  const submitted = await fetch(`${brokerUrl}/v1/jobs`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${BROKER_TOKEN}`,
      "x-cuadrabot-job-id": "11111111-1111-4111-8111-111111111111",
      "x-cuadrabot-user-id": "22222222-2222-4222-8222-222222222222",
      "x-cuadrabot-budget-class": "essential",
    },
    body: form,
  })
  assert.equal(submitted.status, 202)
  assert.equal((await submitted.json()).job_id, PROCESSOR_JOB_ID)
  assert.deepEqual(calls.starts, [
    {
      sourceJobId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      budgetClass: "essential",
    },
  ])
  assert.deepEqual(calls.binds, [["a".repeat(32), PROCESSOR_JOB_ID]])
  assert.equal(processorRequests.length, 1)
  assert.equal(processorRequests[0].method, "POST")
  assert.equal(processorRequests[0].url, "/v1/jobs")
  assert.equal(
    processorRequests[0].headers.authorization,
    `Bearer ${PROCESSOR_TOKEN}`
  )
  assert.equal(
    processorRequests[0].headers["x-codex-api-key"],
    EGRESS_TOKEN
  )
  assert.equal(processorRequests[0].headers["x-cuadrabot-user-id"], undefined)
  assert.ok(processorRequests[0].bytes > 9)

  const retryForm = new FormData()
  retryForm.append("drawings_pdf", new Blob(["%PDF-test"]), "plans.pdf")
  const recovered = await fetch(`${brokerUrl}/v1/jobs`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${BROKER_TOKEN}`,
      "x-cuadrabot-job-id": "11111111-1111-4111-8111-111111111111",
      "x-cuadrabot-user-id": "22222222-2222-4222-8222-222222222222",
      "x-cuadrabot-budget-class": "essential",
    },
    body: retryForm,
  })
  assert.equal(recovered.status, 202)
  assert.equal((await recovered.json()).job_id, PROCESSOR_JOB_ID)
  assert.equal(calls.starts.length, 1)
  assert.equal(processorRequests.length, 1)

  const deleted = await fetch(`${brokerUrl}/v1/jobs/${PROCESSOR_JOB_ID}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${BROKER_TOKEN}` },
  })
  assert.equal(deleted.status, 204)
  assert.equal(calls.cleanups.at(-1), PROCESSOR_JOB_ID)
})

test("invalid identity and traversal fail before an execution is created", async (t) => {
  let starts = 0
  const broker = createBrokerServer({
    config: brokerConfig(),
    controller: {
      async assertReady() {},
      recoverProcessorJob() { return null },
      async startExecution() { starts += 1 },
    },
  })
  const brokerUrl = await listen(broker)
  t.after(() => close(broker))
  const form = new FormData()
  form.append("drawings_pdf", new Blob(["%PDF-test"]), "plans.pdf")
  const invalid = await fetch(`${brokerUrl}/v1/jobs`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${BROKER_TOKEN}`,
      "x-cuadrabot-job-id": "../escape",
      "x-cuadrabot-user-id": "user",
    },
    body: form,
  })
  assert.equal(invalid.status, 400)
  assert.equal(starts, 0)

  const traversal = await fetch(
    `${brokerUrl}/v1/jobs/${PROCESSOR_JOB_ID}/artifacts/..%2Fsecret`,
    { headers: { authorization: `Bearer ${BROKER_TOKEN}` } }
  )
  assert.equal(traversal.status, 404)
  assert.equal(starts, 0)
})

function brokerConfig() {
  return {
    brokerToken: BROKER_TOKEN,
    maxUploadBytes: 1024 * 1024,
    maxJsonBytes: 1024 * 1024,
    processorRequestTimeoutMs: 5_000,
  }
}

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
