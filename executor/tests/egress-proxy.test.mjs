import assert from "node:assert/strict"
import fs from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { createEgressServers } from "../src/egress-proxy.mjs"
import { AtomicJsonState } from "../src/state.mjs"
import { TokenRegistry, validateTokenState } from "../src/token-registry.mjs"

const CONTROL_TOKEN = "control-secret-that-is-at-least-32-characters"
const MASTER_KEY = "fixture-master-credential-that-never-leaves-the-proxy"
const MODEL = "gpt-5.6-sol"
const SAFETY_ID = `cb_${"a".repeat(48)}`

test("control auth, Responses-only routing, header stripping, and safety injection", async (t) => {
  const upstreamRequests = []
  const upstream = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    upstreamRequests.push({
      url: request.url,
      headers: request.headers,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    })
    response.writeHead(200, { "content-type": "application/json", "x-request-id": "req_test" })
    response.end('{"id":"resp_test","status":"completed","usage":{"input_tokens":120,"output_tokens":40}}')
  })
  const upstreamUrl = await listen(upstream)
  t.after(() => close(upstream))
  const fixture = await egressFixture(t, { upstreamOrigin: new URL(upstreamUrl) })

  const unauthorized = await fetch(`${fixture.controlUrl}/control/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(registration()),
  })
  assert.equal(unauthorized.status, 401)

  const registered = await fetch(`${fixture.controlUrl}/control/tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${CONTROL_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(registration()),
  })
  assert.equal(registered.status, 201)
  const credential = await registered.json()

  const wrongPath = await fetch(`${fixture.dataUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL }),
  })
  assert.equal(wrongPath.status, 404)

  const allowed = await fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
      "openai-organization": "attacker-org",
      "openai-project": "attacker-project",
      "idempotency-key": "attacker-key",
    },
    body: JSON.stringify({
      model: MODEL,
      input: "Count fixtures",
      tools: [{ type: "function", name: "inspect_page" }],
      service_tier: "auto",
      max_output_tokens: 4_096,
      prompt_cache_key: "codex-generated-cache-key",
      store: true,
      safety_identifier: "attacker-selected",
    }),
  })
  assert.equal(allowed.status, 200)
  assert.equal(upstreamRequests.length, 1)
  const forwarded = upstreamRequests[0]
  assert.equal(forwarded.url, "/v1/responses")
  assert.equal(forwarded.headers.authorization, `Bearer ${MASTER_KEY}`)
  assert.equal(forwarded.headers["openai-organization"], undefined)
  assert.equal(forwarded.headers["openai-project"], undefined)
  assert.equal(forwarded.headers["idempotency-key"], undefined)
  assert.equal(forwarded.body.safety_identifier, SAFETY_ID)
  assert.equal(forwarded.body.store, false)
  assert.equal(forwarded.body.service_tier, "default")
  assert.equal(forwarded.body.max_output_tokens, 4_096)
  assert.equal(forwarded.body.prompt_cache_key, undefined)
})

test("a multi-MiB plan image is admitted as vision input and SSE usage is debited", async (t) => {
  let forwarded
  const upstream = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    forwarded = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    response.writeHead(200, { "content-type": "text/event-stream" })
    response.end(
      `data: ${JSON.stringify({
        type: "response.completed",
        response: {
          usage: { input_tokens: 2_000, output_tokens: 100 },
        },
      })}\n\n`
    )
  })
  const upstreamUrl = await listen(upstream)
  t.after(() => close(upstream))
  const fixture = await egressFixture(t, { upstreamOrigin: new URL(upstreamUrl) })
  const credential = await fixture.registry.register({
    ...registration(),
    budgetClass: "free_sample",
  })
  const planImage = Buffer.alloc(1024 * 1024, 9)
  Buffer.from("89504e470d0a1a0a", "hex").copy(planImage, 0)
  planImage.writeUInt32BE(13, 8)
  planImage.write("IHDR", 12, "ascii")
  planImage.writeUInt32BE(6_000, 16)
  planImage.writeUInt32BE(4_000, 20)
  const imageUrl = `data:image/png;base64,${planImage.toString("base64")}`
  const response = await fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_output_tokens: 1_000,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Count fixtures on this plan." },
            { type: "input_image", image_url: imageUrl, detail: "original" },
          ],
        },
      ],
    }),
  })
  assert.equal(response.status, 200)
  await response.text()
  assert.equal(forwarded.input[0].content[1].image_url.length, imageUrl.length)
  assert.equal(forwarded.input[0].content[1].detail, "high")
  assert.equal(forwarded.service_tier, "priority")
  await waitFor(() => {
    const record = fixture.state.snapshot().tokens[credential.tokenId]
    return record.spentCostMicros > 0 && !Object.keys(record.reservations).length
  })
  const record = fixture.state.snapshot().tokens[credential.tokenId]
  assert.equal(record.accountingFailed, false)
  assert.equal(record.actualOutputTokens, 100)
})

test("free samples use priority processing with priority cost enforcement", async (t) => {
  let forwarded
  const upstream = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    forwarded = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    response.writeHead(200, { "content-type": "application/json" })
    response.end(
      '{"id":"resp_priority","status":"completed","usage":{"input_tokens":120,"output_tokens":40}}'
    )
  })
  const upstreamUrl = await listen(upstream)
  t.after(() => close(upstream))
  const fixture = await egressFixture(t, {
    upstreamOrigin: new URL(upstreamUrl),
  })
  const credential = await fixture.registry.register({
    ...registration(),
    budgetClass: "free_sample",
  })

  const response = await fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: "priority sample" }),
  })
  assert.equal(response.status, 200)
  await response.text()
  assert.equal(forwarded.service_tier, "priority")

  const record = fixture.state.snapshot().tokens[credential.tokenId]
  assert.equal(record.spentCostMicros, 5_400)
  assert.equal(record.accountingFailed, false)
})

test("a response is not completed downstream before usage is settled", async (t) => {
  const upstream = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(
      '{"id":"resp_test","status":"completed","usage":{"input_tokens":120,"output_tokens":40}}'
    )
  })
  const upstreamUrl = await listen(upstream)
  t.after(() => close(upstream))
  const fixture = await egressFixture(t, {
    upstreamOrigin: new URL(upstreamUrl),
  })
  const credential = await fixture.registry.register(registration())
  const originalRecordUsage = fixture.registry.recordUsage.bind(
    fixture.registry
  )
  let markAccountingStarted
  const accountingStarted = new Promise((resolve) => {
    markAccountingStarted = resolve
  })
  let releaseAccounting
  const accountingReleased = new Promise((resolve) => {
    releaseAccounting = resolve
  })
  fixture.registry.recordUsage = async (...arguments_) => {
    markAccountingStarted()
    await accountingReleased
    return originalRecordUsage(...arguments_)
  }

  let responseCompleted = false
  const first = fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: "first" }),
  })
    .then(async (response) => {
      await response.text()
      responseCompleted = true
      return response
    })
  await accountingStarted
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(responseCompleted, false)

  releaseAccounting()
  assert.equal((await first).status, 200)
  assert.equal(fixture.options.admission.total, 0)
  const second = await fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: "second" }),
  })
  assert.equal(second.status, 200)
  await second.text()
})

test("client close after a tool call still captures completed usage", async (t) => {
  let requestCount = 0
  const upstream = http.createServer(async (_request, response) => {
    requestCount += 1
    response.writeHead(200, { "content-type": "text/event-stream" })
    response.write(
      `data: ${JSON.stringify({
        type: "response.output_item.done",
        item: { type: "custom_tool_call", name: "shell" },
      })}\n\n`
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    response.end(
      `data: ${JSON.stringify({
        type: "response.completed",
        response: {
          usage: { input_tokens: 2_000, output_tokens: 100 },
        },
      })}\n\n`
    )
  })
  const upstreamUrl = await listen(upstream)
  t.after(() => close(upstream))
  const fixture = await egressFixture(t, {
    upstreamOrigin: new URL(upstreamUrl),
  })
  const credential = await fixture.registry.register(registration())

  const first = await fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: "first" }),
  })
  const reader = first.body.getReader()
  const chunk = await reader.read()
  assert.equal(chunk.done, false)
  await reader.cancel()

  await waitFor(() => {
    const record = fixture.state.snapshot().tokens[credential.tokenId]
    return (
      record.actualOutputTokens === 100 &&
      !Object.keys(record.reservations).length
    )
  })
  const settled = fixture.state.snapshot().tokens[credential.tokenId]
  assert.equal(settled.accountingFailed, false)
  assert.ok(settled.spentCostMicros > 0)

  const second = await fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: "second" }),
  })
  assert.equal(second.status, 200)
  await second.text()
  assert.equal(requestCount, 2)
})

test("model, built-in tools, service tier, and output ceiling fail closed", async (t) => {
  const fixture = await egressFixture(t)
  const token = (await fixture.registry.register(registration())).token

  for (const [payload, expectedMessage] of [
    [{ model: "gpt-5.6-terra", input: "x" }, "model"],
    [
      { model: MODEL, input: "x", tools: [{ type: "web_search" }] },
      "custom and function",
    ],
    [{ model: MODEL, input: "x", service_tier: "priority" }, "service tier"],
    [{ model: MODEL, input: "x", max_output_tokens: 65_537 }, "max_output_tokens"],
    [{ model: MODEL, input: "x", prompt_cache_options: { mode: "explicit" } }, "prompt_cache_options"],
    [
      {
        model: MODEL,
        input: [{ role: "user", content: [{ type: "input_file", file_id: "file-secret" }] }],
      },
      "input files",
    ],
  ]) {
    const response = await fetch(`${fixture.dataUrl}/v1/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    })
    assert.ok([400, 403].includes(response.status))
    assert.match((await response.json()).detail, new RegExp(expectedMessage, "i"))
  }
})

test("token expiry, revocation, request count, and aggregate budgets are durable", async (t) => {
  let now = 1_000_000
  const fixture = await egressFixture(t, {
    clock: () => now,
    maxRequestsPerToken: 2,
    maxRequestBytesPerToken: 20,
    maxOutputTokensPerToken: 10,
  })
  const first = await fixture.registry.register({
    ...registration(),
    expiresAt: now + 10_000,
  })
  const reservation = await fixture.registry.authorizeAndReserve(first.token, MODEL, {
    requestBytes: 10,
    estimatedInputTokens: 10,
    maxOutputTokens: 5,
  })
  await fixture.registry.recordUsage(first.tokenId, reservation.reservationId, {
    input_tokens: 10,
    output_tokens: 5,
  })
  await assert.rejects(
    fixture.registry.authorizeAndReserve(first.token, MODEL, {
      requestBytes: 11,
      estimatedInputTokens: 11,
      maxOutputTokens: 1,
    }),
    /budget/i
  )

  const revoked = await fixture.registry.register({
    ...registration(),
    expiresAt: now + 10_000,
  })
  assert.equal(await fixture.registry.revoke(revoked.tokenId), true)
  assert.equal(await fixture.registry.revoke(revoked.tokenId), false)
  await assert.rejects(
    fixture.registry.authorizeAndReserve(revoked.token, MODEL, {
      requestBytes: 1,
      estimatedInputTokens: 1,
      maxOutputTokens: 1,
    }),
    /unauthorized/i
  )

  const expired = await fixture.registry.register({
    ...registration(),
    expiresAt: now + 100,
  })
  now += 101
  await assert.rejects(
    fixture.registry.authorizeAndReserve(expired.token, MODEL, {
      requestBytes: 1,
      estimatedInputTokens: 1,
      maxOutputTokens: 1,
    }),
    /unauthorized/i
  )
  const persisted = fixture.state.snapshot()
  assert.equal(JSON.stringify(persisted).includes("cbe_"), false)
  assert.ok(persisted.tokens[first.tokenId].spentCostMicros > 0)
})

test("control-plane revocation aborts an in-flight upstream request", async (t) => {
  let markStarted
  const started = new Promise((resolve) => {
    markStarted = resolve
  })
  const stalled = http.createServer(() => markStarted())
  const upstreamUrl = await listen(stalled)
  t.after(() => close(stalled))
  const fixture = await egressFixture(t, {
    upstreamOrigin: new URL(upstreamUrl),
    upstreamTimeoutMs: 5_000,
    upstreamIdleTimeoutMs: 5_000,
  })
  const credential = await fixture.registry.register(registration())
  const pending = fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: "x" }),
  })
  await started
  const revoked = await fetch(
    `${fixture.controlUrl}/control/tokens/${credential.tokenId}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${CONTROL_TOKEN}` },
    }
  )
  assert.equal(revoked.status, 204)
  const aborted = await pending
  assert.equal(aborted.status, 504)
})

test("request, response-stream, and upstream time limits are enforced", async (t) => {
  const oversizedUpstream = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" })
    response.write("x".repeat(64))
    response.end()
  })
  const upstreamUrl = await listen(oversizedUpstream)
  t.after(() => close(oversizedUpstream))
  const fixture = await egressFixture(t, {
    upstreamOrigin: new URL(upstreamUrl),
    maxRequestBytes: 128,
    maxResponseBytes: 16,
  })
  const token = (await fixture.registry.register(registration())).token
  const tooLarge = await fetch(`${fixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: "x".repeat(200) }),
  })
  assert.equal(tooLarge.status, 413)

  let boundedStream = false
  try {
    const response = await fetch(`${fixture.dataUrl}/v1/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: "x" }),
    })
    boundedStream = (await response.text()).length < 64
  } catch {
    boundedStream = true
  }
  assert.equal(boundedStream, true)

  const stalled = http.createServer(() => undefined)
  const stalledUrl = await listen(stalled)
  t.after(() => close(stalled))
  const timeoutFixture = await egressFixture(t, {
    upstreamOrigin: new URL(stalledUrl),
    upstreamTimeoutMs: 50,
    upstreamIdleTimeoutMs: 50,
  })
  const timeoutToken = (
    await timeoutFixture.registry.register(registration())
  ).token
  const timedOut = await fetch(`${timeoutFixture.dataUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${timeoutToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: "x" }),
  })
  assert.equal(timedOut.status, 504)
})

test("global and per-token in-flight gates reject before buffering oversized bodies", async (t) => {
  for (const mode of ["global", "per-token"]) {
    let markStarted
    const started = new Promise((resolve) => {
      markStarted = resolve
    })
    const stalled = http.createServer(() => markStarted())
    const upstreamUrl = await listen(stalled)
    t.after(() => close(stalled))
    const fixture = await egressFixture(t, {
      upstreamOrigin: new URL(upstreamUrl),
      maxRequestBytes: 256,
      maxInFlightRequests: mode === "global" ? 1 : 2,
      maxInFlightRequestsPerToken: 1,
    })
    const first = await fixture.registry.register(registration())
    const second =
      mode === "global"
        ? await fixture.registry.register({
            ...registration(),
            jobId: "execution-2",
          })
        : first
    const pending = fetch(`${fixture.dataUrl}/v1/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${first.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: "x", max_output_tokens: 10 }),
    })
    await started

    const rejected = await fetch(`${fixture.dataUrl}/v1/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${second.token}`,
        "content-type": "application/json",
      },
      // This exceeds maxRequestBytes. A 429 proves admission happened before
      // readBody's content-length/byte check, keeping peak buffered bodies at 1.
      body: JSON.stringify({ model: MODEL, input: "x".repeat(1_000) }),
    })
    assert.equal(rejected.status, 429)

    const revoked = await fetch(
      `${fixture.controlUrl}/control/tokens/${first.tokenId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${CONTROL_TOKEN}` },
      }
    )
    assert.equal(revoked.status, 204)
    assert.equal((await pending).status, 504)
    assert.equal(fixture.options.admission.total, 0)
  }
})

async function egressFixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cuadrabot-egress-test-"))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const state = await new AtomicJsonState(path.join(directory, "tokens.json"), {
    initialState: { version: 1, tokens: {}, ledgers: {} },
    validate: validateTokenState,
  }).init()
  const registry = new TokenRegistry(state, {
    allowedModels: [MODEL, "gpt-5.6-terra"],
    maxRequestsPerToken: overrides.maxRequestsPerToken ?? 512,
    maxRequestBytesPerToken:
      overrides.maxRequestBytesPerToken ?? 2 * 1024 * 1024 * 1024,
    maxOutputTokensPerRequest: 32_000,
    maxOutputTokensPerToken:
      overrides.maxOutputTokensPerToken ?? 1_000_000,
    maxTokenTtlMs: 8 * 60 * 60 * 1_000,
    clock: overrides.clock ?? (() => Date.now()),
  })
  const options = {
    registry,
    masterApiKey: MASTER_KEY,
    controlToken: CONTROL_TOKEN,
    maxRequestBytes: overrides.maxRequestBytes ?? 16 * 1024 * 1024,
    maxResponseBytes: overrides.maxResponseBytes ?? 16 * 1024 * 1024,
    maxDataImageBytes: 11 * 1024 * 1024,
    maxDataImagesPerRequest: 8,
    imagePatchTokenMultiplier: 4,
    maxInFlightRequests: overrides.maxInFlightRequests ?? 1,
    maxInFlightRequestsPerToken:
      overrides.maxInFlightRequestsPerToken ?? 1,
    maxOutputTokensPerRequest: 32_000,
    upstreamTimeoutMs: overrides.upstreamTimeoutMs ?? 5_000,
    upstreamIdleTimeoutMs: overrides.upstreamIdleTimeoutMs ?? 5_000,
    serverRequestTimeoutMs: 10_000,
    upstreamOrigin:
      overrides.upstreamOrigin ?? new URL("http://127.0.0.1:1"),
    openaiOrganization: "",
    openaiProject: "",
    fetchImpl: fetch,
    instanceId: "7".repeat(32),
  }
  const { dataServer, controlServer } = createEgressServers(options)
  const dataUrl = await listen(dataServer)
  const controlUrl = await listen(controlServer)
  t.after(() => Promise.all([close(dataServer), close(controlServer)]))
  return { state, registry, dataUrl, controlUrl, options }
}

function registration() {
  return {
    jobId: "execution-1",
    ledgerId: "c".repeat(64),
    models: [MODEL],
    budgetClass: "essential",
    safetyIdentifier: SAFETY_ID,
    expiresAt: Date.now() + 60_000,
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

async function waitFor(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail("Timed out waiting for asynchronous accounting")
}
