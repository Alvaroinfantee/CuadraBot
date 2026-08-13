import http from "node:http"
import { Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import { isBudgetClass } from "./budget-policy.mjs"
import {
  assertSafeFilename,
  assertSafeProcessorJobId,
  assertUuid,
  requireBearer,
  sendError,
  sendJson,
} from "./util.mjs"

export function createBrokerServer({ config, controller }) {
  const server = http.createServer((request, response) => {
    void handleBrokerRequest(request, response, { config, controller }).catch(
      (error) => sendError(response, error)
    )
  })
  server.requestTimeout = config.processorRequestTimeoutMs
  server.headersTimeout = 60_000
  server.keepAliveTimeout = 5_000
  server.maxRequestsPerSocket = 100
  return server
}

export async function handleBrokerRequest(
  request,
  response,
  { config, controller }
) {
  const url = requestUrl(request)
  if (request.method === "GET" && url.pathname === "/healthz" && !url.search) {
    sendJson(response, 200, { status: "ok" })
    return
  }
  if (request.method === "GET" && url.pathname === "/readyz" && !url.search) {
    try {
      await controller.assertReady()
      sendJson(response, 200, { status: "ready" })
    } catch {
      sendJson(response, 503, { status: "not_ready" })
    }
    return
  }

  requireBearer(request, config.brokerToken)
  if (request.method === "POST" && url.pathname === "/v1/jobs" && !url.search) {
    await createProcessorJob(request, response, { config, controller })
    return
  }

  const artifactMatch = url.pathname.match(
    /^\/v1\/jobs\/([a-f0-9]{32})\/artifacts\/([A-Za-z0-9_.-]{1,180})$/
  )
  if (request.method === "GET" && artifactMatch && !url.search) {
    const jobId = assertSafeProcessorJobId(artifactMatch[1])
    const filename = assertSafeFilename(decodeURIComponent(artifactMatch[2]))
    const runtime = await requiredRuntime(controller, jobId)
    await proxyBufferedOrStreamed(request, response, {
      runtime,
      method: "GET",
      path: `/v1/jobs/${jobId}/artifacts/${filename}`,
      responseLimit: config.maxUploadBytes,
      streamResponse: true,
      timeoutMs: config.processorRequestTimeoutMs,
    })
    return
  }

  const jobMatch = url.pathname.match(/^\/v1\/jobs\/([a-f0-9]{32})$/)
  if (jobMatch && !url.search) {
    const jobId = assertSafeProcessorJobId(jobMatch[1])
    if (request.method === "DELETE") {
      await controller.cleanupProcessorJob(jobId)
      response.writeHead(204, { "cache-control": "no-store" })
      response.end()
      return
    }
    if (request.method === "GET") {
      const runtime = await requiredRuntime(controller, jobId)
      await proxyBufferedOrStreamed(request, response, {
        runtime,
        method: "GET",
        path: `/v1/jobs/${jobId}`,
        responseLimit: config.maxJsonBytes,
        streamResponse: false,
        timeoutMs: config.processorRequestTimeoutMs,
      })
      return
    }
  }
  const error = new Error("Broker route not found")
  error.statusCode = 404
  throw error
}

async function createProcessorJob(request, response, { config, controller }) {
  const contentType = request.headers["content-type"] ?? ""
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    const error = new Error("Takeoff submission must be multipart form data")
    error.statusCode = 415
    throw error
  }
  const sourceJobId = String(request.headers["x-cuadrabot-job-id"] ?? "")
  const userId = String(request.headers["x-cuadrabot-user-id"] ?? "")
  const budgetClass = String(
    request.headers["x-cuadrabot-budget-class"] ?? ""
  )
  try {
    assertUuid(sourceJobId, "source job identifier")
    assertUuid(userId, "user identifier")
    if (!isBudgetClass(budgetClass)) throw new Error("Invalid budget class")
  } catch {
    const error = new Error("Invalid trusted job identity headers")
    error.statusCode = 400
    throw error
  }

  const maxBodyBytes = config.maxUploadBytes + 1024 * 1024
  const declared = request.headers["content-length"]
  if (declared !== undefined) {
    const length = Number(declared)
    if (!Number.isSafeInteger(length) || length < 1 || length > maxBodyBytes) {
      const error = new Error("Takeoff submission exceeds the broker limit")
      error.statusCode = 413
      throw error
    }
  }

  const recovered = controller.recoverProcessorJob({
    sourceJobId,
    userId,
    budgetClass,
  })
  if (recovered) {
    request.resume()
    sendJson(response, 202, {
      job_id: recovered,
      status: "queued",
      status_url: `/v1/jobs/${recovered}`,
    })
    return
  }

  const runtime = await controller.startExecution({
    sourceJobId,
    userId,
    budgetClass,
  })
  try {
    const result = await proxyCreateRequest(request, {
      runtime,
      contentType,
      contentLength: declared,
      maxBodyBytes,
      responseLimit: config.maxJsonBytes,
      timeoutMs: config.processorRequestTimeoutMs,
    })
    if (result.statusCode !== 202) {
      await controller.cleanupExecution(runtime.record.executionId)
      forwardBufferedResponse(response, result)
      return
    }
    let submission
    try {
      submission = JSON.parse(result.body.toString("utf8"))
      assertSafeProcessorJobId(submission.job_id)
      if (
        submission.status !== "queued" ||
        submission.status_url !== `/v1/jobs/${submission.job_id}`
      ) {
        throw new Error("Unexpected processor submission response")
      }
    } catch {
      await controller.cleanupExecution(runtime.record.executionId)
      const protocolError = new Error("Processor returned an invalid job response")
      protocolError.statusCode = 502
      throw protocolError
    }
    await controller.bindProcessorJob(
      runtime.record.executionId,
      submission.job_id
    )
    forwardBufferedResponse(response, result)
  } catch (error) {
    await controller.cleanupExecution(runtime.record.executionId).catch(
      (cleanupError) => {
        console.error(
          `[${runtime.record.executionId}] submission cleanup failed`,
          cleanupError
        )
      }
    )
    throw error
  }
}

async function proxyCreateRequest(
  incoming,
  { runtime, contentType, contentLength, maxBodyBytes, responseLimit, timeoutMs }
) {
  const headers = {
    authorization: `Bearer ${runtime.processorToken}`,
    "x-codex-api-key": runtime.egressToken,
    "content-type": contentType,
  }
  if (contentLength !== undefined) headers["content-length"] = contentLength
  return new Promise((resolve, reject) => {
    const upstream = http.request(
      {
        ...processorConnectionOptions(runtime.endpoint),
        method: "POST",
        path: "/v1/jobs",
        headers,
        timeout: timeoutMs,
      },
      (upstreamResponse) => {
        void collectResponse(upstreamResponse, responseLimit).then(
          (body) =>
            resolve({
              statusCode: upstreamResponse.statusCode ?? 502,
              headers: upstreamResponse.headers,
              body,
            }),
          reject
        )
      }
    )
    upstream.once("timeout", () => upstream.destroy(new Error("Processor request timed out")))
    upstream.once("error", reject)
    const limiter = byteLimitTransform(maxBodyBytes)
    void pipeline(incoming, limiter, upstream).catch(reject)
  })
}

async function proxyBufferedOrStreamed(
  incoming,
  response,
  { runtime, method, path, responseLimit, streamResponse, timeoutMs }
) {
  await new Promise((resolve, reject) => {
    const upstream = http.request(
      {
        ...processorConnectionOptions(runtime.endpoint),
        method,
        path,
        headers: { authorization: `Bearer ${runtime.processorToken}` },
        timeout: timeoutMs,
      },
      (upstreamResponse) => {
        if (streamResponse) {
          response.writeHead(
            upstreamResponse.statusCode ?? 502,
            safeResponseHeaders(upstreamResponse.headers)
          )
          void pipeline(
            upstreamResponse,
            byteLimitTransform(responseLimit),
            response
          ).then(resolve, reject)
          return
        }
        void collectResponse(upstreamResponse, responseLimit).then(
          (body) => {
            forwardBufferedResponse(response, {
              statusCode: upstreamResponse.statusCode ?? 502,
              headers: upstreamResponse.headers,
              body,
            })
            resolve()
          },
          reject
        )
      }
    )
    upstream.once("timeout", () => upstream.destroy(new Error("Processor request timed out")))
    upstream.once("error", reject)
    upstream.end()
    incoming.resume()
  })
}

export function processorConnectionOptions(endpoint) {
  if (typeof endpoint?.socketPath === "string" && endpoint.socketPath) {
    return { socketPath: endpoint.socketPath }
  }
  return { host: endpoint.host, port: endpoint.port }
}

async function requiredRuntime(controller, jobId) {
  const runtime = await controller.runtimeForProcessorJob(jobId)
  if (!runtime) {
    const error = new Error("Job not found")
    error.statusCode = 404
    throw error
  }
  return runtime
}

function byteLimitTransform(maxBytes) {
  let bytes = 0
  return new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length
      if (bytes > maxBytes) {
        const error = new Error("Proxied body exceeded its byte limit")
        error.statusCode = 413
        callback(error)
        return
      }
      callback(null, chunk)
    },
  })
}

async function collectResponse(stream, maxBytes) {
  const chunks = []
  let bytes = 0
  for await (const chunk of stream) {
    bytes += chunk.length
    if (bytes > maxBytes) throw new Error("Processor response exceeded its limit")
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, bytes)
}

function forwardBufferedResponse(response, result) {
  response.writeHead(result.statusCode, {
    ...safeResponseHeaders(result.headers),
    "content-length": result.body.length,
  })
  response.end(result.body)
}

function safeResponseHeaders(headers) {
  const safe = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  }
  for (const name of ["content-type", "content-disposition", "content-length"] ) {
    const value = headers[name]
    if (typeof value === "string" && !/[\r\n]/.test(value)) safe[name] = value
  }
  return safe
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
