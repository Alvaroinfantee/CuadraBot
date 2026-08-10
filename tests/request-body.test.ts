import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  readRequestBytesWithLimit,
  readRequestJsonWithLimit,
  readRequestTextWithLimit,
  requestBodyLimits,
} from "../src/lib/request-body"
import { takeoffDraftSchema } from "../src/lib/takeoff-schemas"

test("reads exact raw webhook bytes without text normalization", async () => {
  const payload = Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d])
  const { request } = chunkedRequest([
    payload.subarray(0, 3),
    payload.subarray(3),
  ])

  const result = await readRequestBytesWithLimit(request, payload.byteLength)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value, payload)
})

test("rejects a chunked oversized body without trusting Content-Length", async () => {
  const { request, wasCancelled } = chunkedRequest([
    Buffer.from("1234"),
    Buffer.from("56789"),
    Buffer.from("should-not-be-read"),
  ])
  assert.equal(request.headers.has("content-length"), false)

  assert.deepEqual(await readRequestBytesWithLimit(request, 8), {
    ok: false,
    reason: "too_large",
  })
  assert.equal(wasCancelled(), true)
})

test("counts UTF-8 bytes and parses JSON split across stream chunks", async () => {
  const payload = Buffer.from(JSON.stringify({ label: "plano eléctrico" }))
  const splitInsideMultibyteCharacter = payload.indexOf(0xc3) + 1
  const { request } = chunkedRequest([
    payload.subarray(0, splitInsideMultibyteCharacter),
    payload.subarray(splitInsideMultibyteCharacter),
  ])

  const result = await readRequestJsonWithLimit(request, payload.byteLength)
  assert.deepEqual(result, {
    ok: true,
    value: { label: "plano eléctrico" },
  })
})

test("the draft cap accommodates the largest normal UTF-8 schema fields", () => {
  const draft = JSON.stringify({
    projectName: "電".repeat(120),
    mode: "standard",
    trades: ["fixture_device_counts", "cable_conduit_runs"],
    notes: "電".repeat(4_000),
    filename: `${"電".repeat(216)}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 25 * 1024 * 1024,
  })
  assert.equal(takeoffDraftSchema.safeParse(JSON.parse(draft)).success, true)
  assert.ok(Buffer.byteLength(draft) < requestBodyLimits.takeoffDraftJson)
})

test("rejects oversized declarations and malformed UTF-8", async () => {
  const declared = new Request("https://cuadrabot.com/api/locale", {
    method: "POST",
    headers: { "content-length": "1025" },
    body: "{}",
  })
  assert.deepEqual(await readRequestBytesWithLimit(declared, 1024), {
    ok: false,
    reason: "too_large",
  })

  const { request } = chunkedRequest([Buffer.from([0xc3, 0x28])])
  assert.deepEqual(await readRequestTextWithLimit(request, 2), {
    ok: false,
    reason: "invalid",
  })

  const malformedJson = chunkedRequest([Buffer.from("{not-json")]).request
  assert.deepEqual(await readRequestJsonWithLimit(malformedJson, 32), {
    ok: false,
    reason: "invalid",
  })
})

test("every API request body is streamed through an explicit byte cap", () => {
  const routes = [
    ["src/app/api/admin/bootstrap/route.ts", "maxAdminBootstrapRequestBytes"],
    ["src/app/api/billing/checkout/route.ts", "requestBodyLimits.billingJson"],
    ["src/app/api/billing/portal/route.ts", "requestBodyLimits.billingJson"],
    ["src/app/api/locale/route.ts", "requestBodyLimits.localeJson"],
    [
      "src/app/api/marketing/events/route.ts",
      "requestBodyLimits.marketingEventJson",
    ],
    ["src/app/api/stripe/webhook/route.ts", "requestBodyLimits.stripeWebhook"],
    ["src/app/api/takeoff/jobs/route.ts", "requestBodyLimits.takeoffDraftJson"],
    [
      "src/app/api/takeoff/jobs/[id]/submit/route.ts",
      "requestBodyLimits.takeoffSubmitJson",
    ],
    [
      "src/app/api/internal/worker/takeoff/health/route.ts",
      "requestBodyLimits.workerStatusJson",
    ],
    [
      "src/app/api/internal/worker/takeoff/jobs/[id]/artifacts/route.ts",
      "requestBodyLimits.workerResultJson",
    ],
    [
      "src/app/api/internal/worker/takeoff/jobs/[id]/claim/route.ts",
      "requestBodyLimits.workerClaimJson",
    ],
    [
      "src/app/api/internal/worker/takeoff/jobs/[id]/complete/route.ts",
      "requestBodyLimits.workerResultJson",
    ],
    [
      "src/app/api/internal/worker/takeoff/jobs/[id]/fail/route.ts",
      "requestBodyLimits.workerResultJson",
    ],
    [
      "src/app/api/internal/worker/takeoff/jobs/[id]/progress/route.ts",
      "requestBodyLimits.workerStatusJson",
    ],
  ] as const

  for (const [route, expectedLimit] of routes) {
    const source = read(route)
    assert.doesNotMatch(
      source,
      /request\.(?:json|text|arrayBuffer|blob|formData)\(/,
      `${route} must not buffer an unbounded request body`
    )
    assert.match(
      source,
      /readRequest(?:Bytes|Json|Text)WithLimit\(/,
      `${route} must use the shared bounded reader`
    )
    assert.ok(
      source.includes(expectedLimit),
      `${route} must use ${expectedLimit}`
    )
  }

  assert.deepEqual(requestBodyLimits, {
    localeJson: 1024,
    marketingEventJson: 8 * 1024,
    takeoffDraftJson: 32 * 1024,
    takeoffSubmitJson: 4 * 1024,
    billingJson: 4 * 1024,
    workerClaimJson: 4 * 1024,
    workerStatusJson: 16 * 1024,
    workerResultJson: 64 * 1024,
    stripeWebhook: 1024 * 1024,
  })

  const portal = read("src/app/api/billing/portal/route.ts")
  assert.ok(
    portal.indexOf("await getActiveUser()") <
      portal.indexOf("readRequestJsonWithLimit("),
    "billing portal must authenticate before reading its request body"
  )

  const webhook = read("src/app/api/stripe/webhook/route.ts")
  assert.ok(
    webhook.indexOf('request.headers.get("stripe-signature")') <
      webhook.indexOf("readRequestBytesWithLimit(") &&
      webhook.indexOf("readRequestBytesWithLimit(") <
        webhook.indexOf("stripe.webhooks.constructEvent("),
    "Stripe must reject a missing signature before its bounded exact-byte read"
  )
})

function chunkedRequest(chunks: readonly Uint8Array[]) {
  let index = 0
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index]
      index += 1
      if (chunk) controller.enqueue(chunk)
      else controller.close()
    },
    cancel() {
      cancelled = true
    },
  })
  const request = new Request("https://cuadrabot.com/test", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" })
  return { request, wasCancelled: () => cancelled }
}

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
