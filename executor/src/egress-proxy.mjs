import crypto from "node:crypto"
import http from "node:http"
import {
  estimateRequestInputTokens,
  forceBoundedImageDetail,
} from "./budget-policy.mjs"
import {
  SAFE_TOKEN_ID,
  bearerToken,
  readBody,
  readJsonBody,
  requireBearer,
  sendError,
  sendJson,
} from "./util.mjs"

const RESPONSE_PATH = "/v1/responses"
const EPHEMERAL_TOKEN = /^cbe_[A-Za-z0-9_-]{43}$/
const STATEFUL_FIELDS = [
  "previous_response_id",
  "conversation",
  "prompt",
  "prompt_cache_options",
  "prompt_cache_retention",
]

export function createEgressServers(options) {
  options.activeRequests ??= new Map()
  options.admission ??= { total: 0, byToken: new Map() }
  const dataServer = http.createServer((request, response) => {
    let release
    try {
      release = acquireAdmissionSlot(request, options)
    } catch (error) {
      sendError(response, error)
      return
    }
    void handleDataRequest(request, response, options)
      .catch((error) => sendError(response, error))
      .finally(release)
  })
  const controlServer = http.createServer((request, response) => {
    void handleControlRequest(request, response, options).catch((error) => {
      sendError(response, error)
    })
  })

  for (const server of [dataServer, controlServer]) {
    server.requestTimeout = options.serverRequestTimeoutMs
    server.headersTimeout = Math.min(options.serverRequestTimeoutMs, 60_000)
    server.keepAliveTimeout = 5_000
    server.maxRequestsPerSocket = 100
  }
  return { dataServer, controlServer }
}

export async function handleDataRequest(request, response, options) {
  const url = requestUrl(request)
  if (request.method !== "POST" || url.pathname !== RESPONSE_PATH || url.search) {
    const error = new Error("Only POST /v1/responses is allowed")
    error.statusCode = 404
    throw error
  }
  const contentType = request.headers["content-type"] ?? ""
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    const error = new Error("Responses requests must use application/json")
    error.statusCode = 415
    throw error
  }

  const rawBody = await readBody(request, options.maxRequestBytes)
  let body
  try {
    body = JSON.parse(rawBody.toString("utf8"))
  } catch {
    const error = new Error("Request body must be valid JSON")
    error.statusCode = 400
    throw error
  }
  if (!body || Array.isArray(body) || typeof body !== "object") {
    const error = new Error("Responses request must be a JSON object")
    error.statusCode = 400
    throw error
  }
  if (typeof body.model !== "string") {
    const error = new Error("Responses request must select an allowed model")
    error.statusCode = 400
    throw error
  }
  if (body.background === true) {
    const error = new Error("Background Responses requests are not allowed")
    error.statusCode = 400
    throw error
  }
  for (const field of STATEFUL_FIELDS) {
    if (Object.hasOwn(body, field)) {
      const error = new Error(`${field} is not allowed for isolated jobs`)
      error.statusCode = 400
      throw error
    }
  }
  // Codex adds an opaque cache key to Responses requests. Isolated jobs do not
  // need it, so remove it before admission and forwarding to keep every request
  // stateless and billed as uncached input.
  delete body.prompt_cache_key
  validateToolPolicy(body.tools)
  if (
    body.service_tier !== undefined &&
    body.service_tier !== "default" &&
    body.service_tier !== "auto"
  ) {
    const error = new Error("Requested service tier is not allowed")
    error.statusCode = 400
    throw error
  }
  const requestedOutputTokens =
    body.max_output_tokens === undefined ? null : body.max_output_tokens
  if (
    requestedOutputTokens !== null &&
    (!Number.isSafeInteger(requestedOutputTokens) ||
      requestedOutputTokens < 1 ||
      requestedOutputTokens > options.maxOutputTokensPerRequest)
  ) {
    const error = new Error("max_output_tokens exceeds the job policy")
    error.statusCode = 400
    throw error
  }

  forceBoundedImageDetail(body)
  const admission = estimateRequestInputTokens(body, rawBody.length, {
    imagePatchTokenMultiplier: options.imagePatchTokenMultiplier,
    maxDataImages: options.maxDataImagesPerRequest,
    maxDataImageBytes: options.maxDataImageBytes,
  })
  const authorization = await options.registry.authorizeAndReserve(
    bearerToken(request),
    body.model,
    {
      requestBytes: rawBody.length,
      estimatedInputTokens: admission.estimatedInputTokens,
      maxOutputTokens: requestedOutputTokens,
    }
  )
  const upstreamBody = Buffer.from(
    JSON.stringify({
      ...body,
      store: false,
      service_tier: "default",
      max_output_tokens: authorization.maxOutputTokens,
      safety_identifier: authorization.safetyIdentifier,
    })
  )
  if (upstreamBody.length > options.maxRequestBytes) {
    await options.registry.releaseReservation(
      authorization.tokenId,
      authorization.reservationId
    )
    const error = new Error("Responses request is too large after validation")
    error.statusCode = 413
    throw error
  }

  let result
  try {
    result = await forwardToOpenAI(
      response,
      upstreamBody,
      options,
      authorization.tokenId
    )
  } catch (error) {
    await options.registry
      .markAccountingFailed(
        authorization.tokenId,
        authorization.reservationId
      )
      .catch(() => undefined)
    throw error
  }

  if (result.status < 200 || result.status >= 300) {
    if (result.usage) {
      await options.registry.recordUsage(
        authorization.tokenId,
        authorization.reservationId,
        result.usage
      )
    } else {
      await options.registry.releaseReservation(
        authorization.tokenId,
        authorization.reservationId
      )
    }
    response.end()
    return
  }
  if (!result.usage) {
    await options.registry.markAccountingFailed(
      authorization.tokenId,
      authorization.reservationId
    )
    throw new Error("OpenAI response usage was unavailable")
  }
  try {
    await options.registry.recordUsage(
      authorization.tokenId,
      authorization.reservationId,
      result.usage
    )
  } catch (error) {
    await options.registry
      .markAccountingFailed(
        authorization.tokenId,
        authorization.reservationId
      )
      .catch(() => undefined)
    throw error
  }
  // Do not tell Codex that the response is complete until its token usage has
  // been durably settled. Otherwise Codex can issue the next turn while the
  // previous reservation still exists and receive a false 409 rejection.
  response.end()
}

function validateToolPolicy(tools) {
  if (tools === undefined) return
  if (!Array.isArray(tools) || tools.length > 128) {
    const error = new Error("Responses tools must be a bounded array")
    error.statusCode = 400
    throw error
  }
  for (const tool of tools) {
    if (
      !tool ||
      Array.isArray(tool) ||
      typeof tool !== "object" ||
      (tool.type !== "function" && tool.type !== "custom")
    ) {
      const error = new Error(
        "Only custom and function tools are allowed through the egress proxy"
      )
      error.statusCode = 400
      throw error
    }
  }
}

export async function handleControlRequest(request, response, options) {
  const url = requestUrl(request)
  if (request.method === "GET" && url.pathname === "/healthz" && !url.search) {
    sendJson(response, 200, { status: "ok" })
    return
  }
  if (request.method === "GET" && url.pathname === "/readyz" && !url.search) {
    if (!options.registry.state.ready || !options.masterApiKey) {
      sendJson(response, 503, { status: "not_ready" })
      return
    }
    try {
      await options.registry.state.verifyWritable()
      sendJson(response, 200, {
        status: "ready",
        instanceId: options.instanceId,
      })
    } catch {
      sendJson(response, 503, { status: "not_ready" })
    }
    return
  }

  requireBearer(request, options.controlToken)
  if (request.method === "POST" && url.pathname === "/control/tokens" && !url.search) {
    const body = await readJsonBody(request, 16 * 1024)
    const registration = await options.registry.register(body)
    sendJson(response, 201, {
      ...registration,
      egressInstanceId: options.instanceId,
    })
    return
  }
  const revoke = url.pathname.match(/^\/control\/tokens\/([a-f0-9]{32})$/)
  if (request.method === "DELETE" && revoke && !url.search) {
    if (!SAFE_TOKEN_ID.test(revoke[1])) {
      const error = new Error("Invalid token identifier")
      error.statusCode = 400
      throw error
    }
    abortActiveRequests(options.activeRequests, revoke[1])
    await options.registry.revoke(revoke[1])
    response.writeHead(204, { "cache-control": "no-store" })
    response.end()
    return
  }
  const error = new Error("Control route not found")
  error.statusCode = 404
  throw error
}

async function forwardToOpenAI(response, body, options, tokenId) {
  const controller = new AbortController()
  const active = options.activeRequests.get(tokenId) ?? new Set()
  active.add(controller)
  options.activeRequests.set(tokenId, active)
  const downstreamClosed = () => {
    if (!response.writableEnded) controller.abort()
  }
  response.once("close", downstreamClosed)
  const overall = setTimeout(() => controller.abort(), options.upstreamTimeoutMs)
  let idle
  const resetIdle = () => {
    clearTimeout(idle)
    idle = setTimeout(() => controller.abort(), options.upstreamIdleTimeoutMs)
  }
  try {
    resetIdle()
    const upstream = await options.fetchImpl(
      new URL(RESPONSE_PATH, options.upstreamOrigin),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.masterApiKey}`,
          "content-type": "application/json",
          "content-length": String(body.length),
          accept: "text/event-stream, application/json",
          ...(options.openaiOrganization
            ? { "openai-organization": options.openaiOrganization }
            : {}),
          ...(options.openaiProject
            ? { "openai-project": options.openaiProject }
            : {}),
        },
        body,
        redirect: "error",
        signal: controller.signal,
      }
    )
    const contentType = upstream.headers.get("content-type") ?? ""
    const forwardedHeaders = {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    }
    for (const name of [
      "content-type",
      "x-request-id",
      "openai-processing-ms",
      "retry-after",
    ]) {
      const value = upstream.headers.get(name)
      if (value) forwardedHeaders[name] = value
    }
    response.writeHead(upstream.status, forwardedHeaders)
    let bytes = 0
    const captured = []
    if (upstream.body) {
      for await (const chunk of upstream.body) {
        resetIdle()
        const buffered = Buffer.from(chunk)
        bytes += buffered.length
        if (bytes > options.maxResponseBytes) {
          controller.abort()
          throw new Error("OpenAI response exceeded the proxy limit")
        }
        captured.push(buffered)
        if (!response.write(buffered)) {
          await new Promise((resolve, reject) => {
            response.once("drain", resolve)
            response.once("error", reject)
          })
        }
      }
    }
    return {
      status: upstream.status,
      usage: extractUsage(Buffer.concat(captured, bytes), contentType),
    }
  } catch (error) {
    if (response.headersSent) response.destroy(error)
    const wrapped = new Error(
      error?.name === "AbortError"
        ? "OpenAI request timed out"
        : "OpenAI request failed"
    )
    wrapped.statusCode = error?.name === "AbortError" ? 504 : 502
    throw wrapped
  } finally {
    response.off("close", downstreamClosed)
    active.delete(controller)
    if (!active.size) options.activeRequests.delete(tokenId)
    clearTimeout(overall)
    clearTimeout(idle)
  }
}

function extractUsage(payload, contentType) {
  if (!payload.length) return null
  if (/text\/event-stream/i.test(contentType)) {
    let usage = null
    for (const line of payload.toString("utf8").split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (!data || data === "[DONE]") continue
      try {
        usage = usageFromObject(JSON.parse(data)) ?? usage
      } catch {
        // A malformed/multiline event cannot be trusted for accounting. If no
        // later valid completed event exists the token is failed closed.
      }
    }
    return usage
  }
  try {
    return usageFromObject(JSON.parse(payload.toString("utf8")))
  } catch {
    return null
  }
}

function usageFromObject(value) {
  const candidate = value?.response?.usage ?? value?.usage
  if (
    !candidate ||
    !Number.isSafeInteger(candidate.input_tokens) ||
    candidate.input_tokens < 0 ||
    !Number.isSafeInteger(candidate.output_tokens) ||
    candidate.output_tokens < 0
  ) {
    return null
  }
  return {
    input_tokens: candidate.input_tokens,
    output_tokens: candidate.output_tokens,
  }
}

function acquireAdmissionSlot(request, options) {
  const token = bearerToken(request)
  if (!EPHEMERAL_TOKEN.test(token ?? "")) {
    const error = new Error("Unauthorized")
    error.statusCode = 401
    throw error
  }
  const admission = options.admission
  const key = crypto.createHash("sha256").update(token).digest("hex")
  const tokenCount = admission.byToken.get(key) ?? 0
  if (
    admission.total >= options.maxInFlightRequests ||
    tokenCount >= options.maxInFlightRequestsPerToken
  ) {
    const error = new Error("Egress request concurrency limit reached")
    error.statusCode = 429
    throw error
  }
  admission.total += 1
  admission.byToken.set(key, tokenCount + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    admission.total -= 1
    const current = admission.byToken.get(key) ?? 1
    if (current <= 1) admission.byToken.delete(key)
    else admission.byToken.set(key, current - 1)
  }
}

function abortActiveRequests(activeRequests, tokenId) {
  const active = activeRequests?.get(tokenId)
  if (!active) return
  for (const controller of active) controller.abort()
  activeRequests.delete(tokenId)
}

function requestUrl(request) {
  try {
    return new URL(request.url, "http://executor.invalid")
  } catch {
    const error = new Error("Invalid request URL")
    error.statusCode = 400
    throw error
  }
}
