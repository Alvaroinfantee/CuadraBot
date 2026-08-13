import crypto from "node:crypto"
import http from "node:http"
import { isBudgetClass } from "./budget-policy.mjs"
import {
  assertSafeId,
  assertSafeProcessorJobId,
  assertUuid,
  derivedSecret,
  hmacHex,
  safetyIdentifier,
} from "./util.mjs"

export class BrokerController {
  #queue = Promise.resolve()

  constructor({ config, state, docker, egress, fetchImpl = fetch, clock = () => Date.now() }) {
    this.config = config
    this.state = state
    this.docker = docker
    this.egress = egress
    this.fetchImpl = fetchImpl
    this.clock = clock
  }

  async assertReady() {
    if (!this.state.ready) throw new Error("Broker state is not ready")
    const [, , egressInstanceId] = await Promise.all([
      this.state.verifyWritable(),
      this.docker.assertReady(),
      this.egress.assertReady(),
    ])
    for (const record of Object.values(this.state.snapshot().executions)) {
      if (record.status !== "running" || !record.processorJobId) continue
      if (
        record.egressInstanceId !== egressInstanceId ||
        !(await this.docker.attest(record))
      ) {
        throw new Error("An active execution failed runtime attestation")
      }
    }
  }

  async reconcileStartup() {
    const records = Object.values(this.state.snapshot().executions)
    const egressInstanceId = await this.egress.assertReady()
    const failures = []
    for (const record of records) {
      let mustClean =
        record.status === "starting" ||
        record.status === "cleaning" ||
        (record.status === "running" && record.processorJobId === null) ||
        record.expiresAt <= this.clock() ||
        record.egressInstanceId !== egressInstanceId
      if (!mustClean) {
        try {
          mustClean = !(await this.docker.attest(record))
        } catch {
          mustClean = true
        }
      }
      if (mustClean) {
        try {
          await this.cleanupExecution(record.executionId)
        } catch (error) {
          failures.push(error)
        }
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, "Startup reconciliation failed")
    }
  }

  async startExecution({ sourceJobId, userId, budgetClass }) {
    assertUuid(sourceJobId, "source job identifier")
    assertUuid(userId, "user identifier")
    if (!isBudgetClass(budgetClass)) {
      const error = new Error("Invalid executor budget class")
      error.statusCode = 400
      throw error
    }
    return this.#locked(async () => {
      if (
        Object.values(this.state.snapshot().executions).some(
          (record) => record.sourceJobId === sourceJobId
        )
      ) {
        const error = new Error("Source job already has an executor")
        error.statusCode = 409
        throw error
      }
      const active = Object.keys(this.state.snapshot().executions).length
      if (active >= this.config.maxConcurrentJobs) {
        const error = new Error("Executor concurrency limit reached")
        error.statusCode = 503
        throw error
      }
      const executionId = crypto.randomBytes(16).toString("hex")
      const createdAt = this.clock()
      const expiresAt = createdAt + this.config.jobTtlMs
      const registration = await this.egress.register({
        jobId: executionId,
        ledgerId: hmacHex(
          this.config.safetySecret,
          `budget:${sourceJobId}`
        ),
        models: [this.config.defaultModel],
        budgetClass,
        safetyIdentifier: safetyIdentifier(this.config.safetySecret, userId),
        expiresAt,
      })
      const record = {
        executionId,
        sourceJobId,
        containerName: `cuadrabot-takeoff-${executionId}`,
        networkName: `cuadrabot-job-${executionId}`,
        tokenId: registration.tokenId,
        egressInstanceId: registration.egressInstanceId,
        budgetClass,
        userFingerprint: hmacHex(
          this.config.safetySecret,
          `user:${userId}`
        ),
        processorJobId: null,
        status: "starting",
        createdAt,
        expiresAt,
      }
      try {
        await this.state.mutate((draft) => {
          draft.executions[executionId] = record
        })
        const jobDirectory = await this.docker.prepareJobDirectory(executionId)
        const processorToken = derivedSecret(
          this.config.processorKeySecret,
          "processor",
          executionId
        )
        const endpoint = await this.docker.start(record, {
          jobDirectory,
          processorToken,
        })
        await this.#waitUntilReady(endpoint)
        await this.state.mutate((draft) => {
          const current = draft.executions[executionId]
          if (!current) throw new Error("Execution disappeared during startup")
          current.status = "running"
        })
        return {
          record: { ...record, status: "running" },
          endpoint,
          egressToken: registration.token,
          processorToken,
        }
      } catch (error) {
        await this.#cleanupRecord(record).catch((cleanupError) => {
          console.error(`[${executionId}] failed-start cleanup failed`, cleanupError)
        })
        throw error
      }
    })
  }

  recoverProcessorJob({ sourceJobId, userId, budgetClass }) {
    assertUuid(sourceJobId, "source job identifier")
    assertUuid(userId, "user identifier")
    if (!isBudgetClass(budgetClass)) {
      const error = new Error("Invalid executor budget class")
      error.statusCode = 400
      throw error
    }
    const record = Object.values(this.state.snapshot().executions).find(
      (candidate) => candidate.sourceJobId === sourceJobId
    )
    if (!record) return null
    const expectedFingerprint = hmacHex(
      this.config.safetySecret,
      `user:${userId}`
    )
    if (
      record.userFingerprint !== expectedFingerprint ||
      record.budgetClass !== budgetClass
    ) {
      const error = new Error("Source job executor identity does not match")
      error.statusCode = 409
      throw error
    }
    if (record.status === "running" && record.processorJobId) {
      return record.processorJobId
    }
    const error = new Error("Source job executor is not recoverable yet")
    error.statusCode = 409
    throw error
  }

  async bindProcessorJob(executionId, processorJobId) {
    assertSafeId(executionId, "execution identifier")
    assertSafeProcessorJobId(processorJobId)
    await this.state.mutate((draft) => {
      const record = draft.executions[executionId]
      if (!record || record.status !== "running") {
        throw new Error("Execution is not available")
      }
      if (record.processorJobId && record.processorJobId !== processorJobId) {
        throw new Error("Execution is already bound to another processor job")
      }
      record.processorJobId = processorJobId
    })
  }

  recordForProcessorJob(processorJobId) {
    assertSafeProcessorJobId(processorJobId)
    const record = Object.values(this.state.snapshot().executions).find(
      (candidate) => candidate.processorJobId === processorJobId
    )
    return record ? structuredClone(record) : null
  }

  async runtimeForProcessorJob(processorJobId) {
    const record = this.recordForProcessorJob(processorJobId)
    if (!record || record.status !== "running") return null
    const endpoint = await this.docker.processorEndpoint(record)
    const processorToken = derivedSecret(
      this.config.processorKeySecret,
      "processor",
      record.executionId
    )
    return { record, endpoint, processorToken }
  }

  async cleanupProcessorJob(processorJobId) {
    const record = this.recordForProcessorJob(processorJobId)
    if (!record) return false
    await this.cleanupExecution(record.executionId)
    return true
  }

  async cleanupExecution(executionId) {
    assertSafeId(executionId, "execution identifier")
    return this.#locked(async () => {
      const record = this.state.snapshot().executions[executionId]
      if (!record) return false
      await this.state.mutate((draft) => {
        if (draft.executions[executionId]) {
          draft.executions[executionId].status = "cleaning"
        }
      })
      await this.#cleanupRecord(record)
      return true
    })
  }

  async sweepExpired() {
    const now = this.clock()
    const expired = Object.values(this.state.snapshot().executions).filter(
      (record) => record.expiresAt <= now
    )
    const failures = []
    for (const record of expired) {
      try {
        await this.cleanupExecution(record.executionId)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length) throw new AggregateError(failures, "TTL cleanup failed")
    return expired.length
  }

  async sweepUnhealthy() {
    const egressInstanceId = await this.egress.assertReady()
    const unhealthy = []
    for (const record of Object.values(this.state.snapshot().executions)) {
      if (record.status === "cleaning") {
        unhealthy.push(record)
        continue
      }
      if (record.status !== "running" || !record.processorJobId) continue
      if (record.egressInstanceId !== egressInstanceId) {
        unhealthy.push(record)
        continue
      }
      if (!(await this.docker.attest(record))) unhealthy.push(record)
    }
    const failures = []
    for (const record of unhealthy) {
      try {
        await this.cleanupExecution(record.executionId)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, "Runtime cleanup failed")
    }
    return unhealthy.length
  }

  async #cleanupRecord(record) {
    const failures = []
    for (const operation of [
      () => this.egress.revoke(record.tokenId),
      () => this.docker.remove(record),
      () => this.docker.removeJobDirectory(record.executionId),
    ]) {
      try {
        await operation()
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, "Execution cleanup was incomplete")
    }
    await this.state.mutate((draft) => {
      delete draft.executions[record.executionId]
    })
  }

  async #waitUntilReady(endpoint) {
    const deadline = this.clock() + this.config.processorReadyTimeoutMs
    let lastError
    while (this.clock() < deadline) {
      try {
        const status = endpoint.socketPath
          ? await unixSocketStatus(endpoint.socketPath, "/readyz", 5_000)
          : (
              await this.fetchImpl(new URL("/readyz", endpoint.origin), {
                signal: AbortSignal.timeout(5_000),
              })
            ).status
        if (status >= 200 && status < 300) return
        lastError = new Error(`Processor readiness returned ${status}`)
      } catch (error) {
        lastError = error
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(
      `Processor did not become ready: ${lastError?.message ?? "timeout"}`
    )
  }

  #locked(operation) {
    const pending = this.#queue.then(operation, operation)
    this.#queue = pending.catch(() => undefined)
    return pending
  }
}

function unixSocketStatus(socketPath, requestPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { socketPath, path: requestPath, method: "GET", timeout: timeoutMs },
      (response) => {
        response.resume()
        response.once("end", () => resolve(response.statusCode ?? 502))
      }
    )
    request.once("timeout", () =>
      request.destroy(new Error("Processor readiness timed out"))
    )
    request.once("error", reject)
    request.end()
  })
}
