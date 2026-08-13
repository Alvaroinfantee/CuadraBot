import crypto from "node:crypto"
import {
  MODEL_COST_RATES,
  budgetProfile,
  enforcementUsageCostMicros,
  isBudgetClass,
  reservationCostMicros,
} from "./budget-policy.mjs"
import {
  SAFE_SAFETY_IDENTIFIER,
  SAFE_TOKEN_ID,
  assertSafeId,
} from "./util.mjs"

export function validateTokenState(state) {
  if (
    !state ||
    state.version !== 1 ||
    !state.tokens ||
    Array.isArray(state.tokens) ||
    typeof state.tokens !== "object" ||
    !state.ledgers ||
    Array.isArray(state.ledgers) ||
    typeof state.ledgers !== "object"
  ) {
    throw new Error("Invalid token registry state")
  }
  for (const [ledgerId, ledger] of Object.entries(state.ledgers)) {
    if (
      !/^[a-f0-9]{64}$/.test(ledgerId) ||
      !ledger ||
      ledger.id !== ledgerId ||
      !isBudgetClass(ledger.budgetClass) ||
      !Number.isSafeInteger(ledger.requestCount) ||
      ledger.requestCount < 0 ||
      !Number.isSafeInteger(ledger.requestBytes) ||
      ledger.requestBytes < 0 ||
      !Number.isSafeInteger(ledger.actualOutputTokens) ||
      ledger.actualOutputTokens < 0 ||
      !Number.isSafeInteger(ledger.spentCostMicros) ||
      ledger.spentCostMicros < 0 ||
      !Number.isSafeInteger(ledger.reservedCostMicros) ||
      ledger.reservedCostMicros < 0 ||
      !Number.isSafeInteger(ledger.reservedOutputTokens) ||
      ledger.reservedOutputTokens < 0 ||
      typeof ledger.accountingFailed !== "boolean" ||
      !Number.isSafeInteger(ledger.createdAt) ||
      !Number.isSafeInteger(ledger.updatedAt) ||
      ledger.updatedAt < ledger.createdAt
    ) {
      throw new Error("Invalid source-job budget ledger")
    }
  }
  const reservedByLedger = new Map()
  for (const [tokenId, record] of Object.entries(state.tokens)) {
    if (
      !SAFE_TOKEN_ID.test(tokenId) ||
      !record ||
      record.id !== tokenId ||
      !/^[a-f0-9]{64}$/.test(record.tokenHash) ||
      !Array.isArray(record.models) ||
      record.models.length < 1 ||
      !record.models.every(
        (model) => typeof model === "string" && MODEL_COST_RATES[model]
      ) ||
      !/^[a-f0-9]{64}$/.test(record.ledgerId) ||
      !state.ledgers[record.ledgerId] ||
      state.ledgers[record.ledgerId].budgetClass !== record.budgetClass ||
      !isBudgetClass(record.budgetClass) ||
      !SAFE_SAFETY_IDENTIFIER.test(record.safetyIdentifier) ||
      !Number.isSafeInteger(record.expiresAt) ||
      !Number.isSafeInteger(record.requestCount) ||
      record.requestCount < 0 ||
      !Number.isSafeInteger(record.requestBytes) ||
      record.requestBytes < 0 ||
      !Number.isSafeInteger(record.actualOutputTokens) ||
      record.actualOutputTokens < 0 ||
      !Number.isSafeInteger(record.spentCostMicros) ||
      record.spentCostMicros < 0 ||
      typeof record.accountingFailed !== "boolean" ||
      !record.reservations ||
      Array.isArray(record.reservations) ||
      typeof record.reservations !== "object" ||
      !Number.isSafeInteger(record.createdAt)
    ) {
      throw new Error("Invalid token registry record")
    }
    assertSafeId(record.jobId, "token job identifier")
    for (const [reservationId, reservation] of Object.entries(
      record.reservations
    )) {
      if (
        !SAFE_TOKEN_ID.test(reservationId) ||
        !reservation ||
        reservation.id !== reservationId ||
        !record.models.includes(reservation.model) ||
        !Number.isSafeInteger(reservation.estimatedInputTokens) ||
        reservation.estimatedInputTokens < 1 ||
        !Number.isSafeInteger(reservation.maxOutputTokens) ||
        reservation.maxOutputTokens < 1 ||
        !Number.isSafeInteger(reservation.costMicros) ||
        reservation.costMicros < 1 ||
        !["default", "priority"].includes(
          reservation.serviceTier ?? "default"
        ) ||
        !Number.isSafeInteger(reservation.createdAt)
      ) {
        throw new Error("Invalid token cost reservation")
      }
      const aggregate = reservedByLedger.get(record.ledgerId) ?? {
        costMicros: 0,
        outputTokens: 0,
      }
      aggregate.costMicros += reservation.costMicros
      aggregate.outputTokens += reservation.maxOutputTokens
      reservedByLedger.set(record.ledgerId, aggregate)
    }
  }
  for (const [ledgerId, ledger] of Object.entries(state.ledgers)) {
    const aggregate = reservedByLedger.get(ledgerId) ?? {
      costMicros: 0,
      outputTokens: 0,
    }
    if (
      ledger.reservedCostMicros !== aggregate.costMicros ||
      ledger.reservedOutputTokens !== aggregate.outputTokens
    ) {
      throw new Error("Source-job budget reservation totals do not reconcile")
    }
  }
}

export class TokenRegistry {
  constructor(
    state,
    {
      allowedModels,
      maxRequestsPerToken = 512,
      maxRequestBytesPerToken = 2 * 1024 * 1024 * 1024,
      maxOutputTokensPerRequest = 32_000,
      maxOutputTokensPerToken = 1_000_000,
      maxTokenTtlMs = 8 * 60 * 60 * 1_000,
      clock = () => Date.now(),
    }
  ) {
    if (!allowedModels.every((model) => MODEL_COST_RATES[model])) {
      throw new Error("Every allowed model must have a checked-in cost rate")
    }
    this.state = state
    this.allowedModels = new Set(allowedModels)
    this.maxRequestsPerToken = maxRequestsPerToken
    this.maxRequestBytesPerToken = maxRequestBytesPerToken
    this.maxOutputTokensPerRequest = maxOutputTokensPerRequest
    this.maxOutputTokensPerToken = maxOutputTokensPerToken
    this.maxTokenTtlMs = maxTokenTtlMs
    this.clock = clock
  }

  async register(payload) {
    if (
      !payload ||
      Array.isArray(payload) ||
      typeof payload !== "object" ||
      Object.keys(payload).some(
        (key) =>
          ![
            "jobId",
            "ledgerId",
            "models",
            "budgetClass",
            "safetyIdentifier",
            "expiresAt",
          ].includes(key)
      )
    ) {
      throw statusError(400, "Invalid token registration payload")
    }
    const {
      jobId,
      ledgerId,
      models,
      budgetClass,
      safetyIdentifier,
      expiresAt,
    } = payload
    assertSafeId(jobId, "token job identifier")
    if (!/^[a-f0-9]{64}$/.test(ledgerId ?? "")) {
      throw statusError(400, "Invalid source-job budget ledger identifier")
    }
    if (
      !Array.isArray(models) ||
      models.length < 1 ||
      models.length > this.allowedModels.size ||
      new Set(models).size !== models.length ||
      !models.every(
        (model) =>
          this.allowedModels.has(model) && Boolean(MODEL_COST_RATES[model])
      )
    ) {
      throw statusError(400, "Token models are not allowed")
    }
    if (!isBudgetClass(budgetClass)) {
      throw statusError(400, "Token budget class is not allowed")
    }
    if (!SAFE_SAFETY_IDENTIFIER.test(safetyIdentifier)) {
      throw statusError(400, "Invalid safety identifier")
    }
    if (
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= this.clock() ||
      expiresAt - this.clock() > this.maxTokenTtlMs
    ) {
      throw statusError(400, "Token expiry must be in the future")
    }
    const id = crypto.randomBytes(16).toString("hex")
    const token = `cbe_${crypto.randomBytes(32).toString("base64url")}`
    const record = {
      id,
      tokenHash: hashToken(token),
      jobId,
      ledgerId,
      models: [...models].sort(),
      budgetClass,
      safetyIdentifier,
      expiresAt,
      requestCount: 0,
      requestBytes: 0,
      actualOutputTokens: 0,
      spentCostMicros: 0,
      accountingFailed: false,
      reservations: {},
      createdAt: this.clock(),
    }
    await this.state.mutate((draft) => {
      const existing = draft.ledgers[ledgerId]
      if (existing && existing.budgetClass !== budgetClass) {
        throw statusError(409, "Source-job budget class changed across attempts")
      }
      if (!existing) {
        draft.ledgers[ledgerId] = {
          id: ledgerId,
          budgetClass,
          requestCount: 0,
          requestBytes: 0,
          actualOutputTokens: 0,
          spentCostMicros: 0,
          reservedCostMicros: 0,
          reservedOutputTokens: 0,
          accountingFailed: false,
          createdAt: this.clock(),
          updatedAt: this.clock(),
        }
      }
      draft.tokens[id] = record
    })
    return { tokenId: id, token, expiresAt, budgetClass }
  }

  async authorizeAndReserve(
    token,
    model,
    { requestBytes, estimatedInputTokens, maxOutputTokens } = {}
  ) {
    if (typeof token !== "string" || token.length > 256) {
      throw statusError(401, "Unauthorized")
    }
    if (!this.allowedModels.has(model) || !MODEL_COST_RATES[model]) {
      throw statusError(400, "Model is not allowed")
    }
    if (!Number.isSafeInteger(requestBytes) || requestBytes < 1) {
      throw statusError(400, "Invalid request byte reservation")
    }
    if (!Number.isSafeInteger(estimatedInputTokens) || estimatedInputTokens < 1) {
      throw statusError(400, "Invalid input token reservation")
    }
    if (
      maxOutputTokens !== undefined &&
      maxOutputTokens !== null &&
      (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1)
    ) {
      throw statusError(400, "Invalid output token reservation")
    }

    const digest = hashToken(token)
    const reservationId = crypto.randomBytes(16).toString("hex")
    let authorized
    let authorizationError
    await this.state.mutate((draft) => {
      const now = this.clock()
      for (const [id, record] of Object.entries(draft.tokens)) {
        if (record.expiresAt <= now) {
          settleOutstandingReservations(
            record,
            draft.ledgers[record.ledgerId],
            now
          )
          delete draft.tokens[id]
        }
      }
      const record = Object.values(draft.tokens).find(
        (candidate) => candidate.tokenHash === digest
      )
      if (!record) {
        authorizationError = statusError(401, "Unauthorized")
        return
      }
      if (!record.models.includes(model)) {
        authorizationError = statusError(
          403,
          "Token is not authorized for this model"
        )
        return
      }
      if (record.accountingFailed || Object.keys(record.reservations).length) {
        authorizationError = statusError(
          409,
          "Token has an unsettled cost reservation"
        )
        return
      }

      const profile = budgetProfile(record.budgetClass)
      const ledger = draft.ledgers[record.ledgerId]
      if (!ledger || ledger.budgetClass !== record.budgetClass) {
        authorizationError = statusError(503, "Source-job budget ledger is unavailable")
        return
      }
      if (ledger.accountingFailed) {
        authorizationError = statusError(
          409,
          "Source-job budget ledger failed accounting"
        )
        return
      }
      const perRequestOutputLimit = Math.min(
        profile.maxOutputTokensPerRequest,
        this.maxOutputTokensPerRequest
      )
      const effectiveOutputTokens =
        maxOutputTokens === undefined || maxOutputTokens === null
          ? perRequestOutputLimit
          : maxOutputTokens
      if (effectiveOutputTokens > perRequestOutputLimit) {
        authorizationError = statusError(
          400,
          "max_output_tokens exceeds the job policy"
        )
        return
      }
      if (
        ledger.requestCount >=
        Math.min(profile.maxRequests, this.maxRequestsPerToken)
      ) {
        authorizationError = statusError(403, "Token request limit exceeded")
        return
      }
      if (
        ledger.requestBytes + requestBytes >
        Math.min(profile.maxRequestBytes, this.maxRequestBytesPerToken)
      ) {
        authorizationError = statusError(403, "Token byte budget exceeded")
        return
      }
      if (
        ledger.actualOutputTokens +
          ledger.reservedOutputTokens +
          effectiveOutputTokens >
        Math.min(profile.maxOutputTokens, this.maxOutputTokensPerToken)
      ) {
        authorizationError = statusError(403, "Token output budget exceeded")
        return
      }
      const costMicros = reservationCostMicros({
        model,
        estimatedInputTokens,
        outputTokens: effectiveOutputTokens,
        serviceTier:
          record.budgetClass === "free_sample" ? "priority" : "default",
      })
      if (
        ledger.spentCostMicros + ledger.reservedCostMicros + costMicros >
        profile.maxCostMicros
      ) {
        authorizationError = statusError(403, "Token USD cost budget exceeded")
        return
      }

      record.requestCount += 1
      record.requestBytes += requestBytes
      ledger.requestCount += 1
      ledger.requestBytes += requestBytes
      ledger.reservedCostMicros += costMicros
      ledger.reservedOutputTokens += effectiveOutputTokens
      ledger.updatedAt = now
      record.reservations[reservationId] = {
        id: reservationId,
        model,
        estimatedInputTokens,
        maxOutputTokens: effectiveOutputTokens,
        costMicros,
        serviceTier:
          record.budgetClass === "free_sample" ? "priority" : "default",
        createdAt: now,
      }
      authorized = {
        tokenId: record.id,
        jobId: record.jobId,
        budgetClass: record.budgetClass,
        safetyIdentifier: record.safetyIdentifier,
        reservationId,
        maxOutputTokens: effectiveOutputTokens,
        reservedCostMicros: costMicros,
        serviceTier:
          record.budgetClass === "free_sample" ? "priority" : "default",
      }
    })
    if (authorizationError) throw authorizationError
    return authorized
  }

  // Compatibility alias for callers/tests that used the original name.
  async authorizeAndConsume(token, model, options) {
    return this.authorizeAndReserve(token, model, options)
  }

  async recordUsage(tokenId, reservationId, usage) {
    assertReservationIds(tokenId, reservationId)
    const { inputTokens, outputTokens } = normalizeUsage(usage)
    let result = null
    await this.state.mutate((draft) => {
      const record = draft.tokens[tokenId]
      const reservation = record?.reservations[reservationId]
      if (!record || !reservation) return
      const ledger = draft.ledgers[record.ledgerId]
      if (!ledger) throw new Error("Source-job budget ledger is unavailable")
      const costMicros = enforcementUsageCostMicros({
        model: reservation.model,
        inputTokens,
        outputTokens,
        serviceTier: reservation.serviceTier ?? "default",
      })
      delete record.reservations[reservationId]
      ledger.reservedCostMicros -= reservation.costMicros
      ledger.reservedOutputTokens -= reservation.maxOutputTokens
      record.spentCostMicros += costMicros
      record.actualOutputTokens += outputTokens
      ledger.spentCostMicros += costMicros
      ledger.actualOutputTokens += outputTokens
      ledger.updatedAt = this.clock()
      const profile = budgetProfile(record.budgetClass)
      if (
        costMicros > reservation.costMicros ||
        outputTokens > reservation.maxOutputTokens ||
        ledger.spentCostMicros > profile.maxCostMicros ||
        ledger.actualOutputTokens >
        Math.min(profile.maxOutputTokens, this.maxOutputTokensPerToken)
      ) {
        record.accountingFailed = true
        ledger.accountingFailed = true
      }
      result = {
        costMicros,
        spentCostMicros: ledger.spentCostMicros,
        maxCostMicros: profile.maxCostMicros,
      }
    })
    return result
  }

  async releaseReservation(tokenId, reservationId) {
    assertReservationIds(tokenId, reservationId)
    let released = false
    await this.state.mutate((draft) => {
      const reservations = draft.tokens[tokenId]?.reservations
      if (reservations?.[reservationId]) {
        const record = draft.tokens[tokenId]
        const ledger = draft.ledgers[record.ledgerId]
        if (!ledger) throw new Error("Source-job budget ledger is unavailable")
        ledger.reservedCostMicros -= reservations[reservationId].costMicros
        ledger.reservedOutputTokens -=
          reservations[reservationId].maxOutputTokens
        ledger.updatedAt = this.clock()
        delete reservations[reservationId]
        released = true
      }
    })
    return released
  }

  async markAccountingFailed(tokenId, reservationId) {
    assertReservationIds(tokenId, reservationId)
    let marked = false
    await this.state.mutate((draft) => {
      const record = draft.tokens[tokenId]
      if (record?.reservations[reservationId]) {
        record.accountingFailed = true
        const ledger = draft.ledgers[record.ledgerId]
        if (!ledger) throw new Error("Source-job budget ledger is unavailable")
        ledger.accountingFailed = true
        ledger.updatedAt = this.clock()
        marked = true
      }
    })
    return marked
  }

  async revoke(tokenId) {
    if (!SAFE_TOKEN_ID.test(tokenId)) {
      throw statusError(400, "Invalid token identifier")
    }
    let existed = false
    await this.state.mutate((draft) => {
      const record = draft.tokens[tokenId]
      existed = Boolean(record)
      if (record) {
        settleOutstandingReservations(
          record,
          draft.ledgers[record.ledgerId],
          this.clock()
        )
      }
      delete draft.tokens[tokenId]
    })
    return existed
  }

  async purgeExpired() {
    const observedAt = this.clock()
    if (
      !Object.values(this.state.snapshot().tokens).some(
        (record) => record.expiresAt <= observedAt
      )
    ) {
      return 0
    }
    let removed = 0
    await this.state.mutate((draft) => {
      const now = this.clock()
      for (const [id, record] of Object.entries(draft.tokens)) {
        if (record.expiresAt <= now) {
          settleOutstandingReservations(
            record,
            draft.ledgers[record.ledgerId],
            now
          )
          delete draft.tokens[id]
          removed += 1
        }
      }
    })
    return removed
  }
}

function settleOutstandingReservations(record, ledger, now) {
  if (!ledger) throw new Error("Source-job budget ledger is unavailable")
  const reservations = Object.values(record.reservations)
  if (reservations.length) ledger.accountingFailed = true
  for (const reservation of reservations) {
    ledger.reservedCostMicros -= reservation.costMicros
    ledger.reservedOutputTokens -= reservation.maxOutputTokens
    ledger.spentCostMicros += reservation.costMicros
    ledger.actualOutputTokens += reservation.maxOutputTokens
  }
  ledger.updatedAt = now
}

function normalizeUsage(usage) {
  const inputTokens = usage?.input_tokens
  const outputTokens = usage?.output_tokens
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0
  ) {
    throw statusError(502, "OpenAI response omitted valid usage accounting")
  }
  return { inputTokens, outputTokens }
}

function assertReservationIds(tokenId, reservationId) {
  if (!SAFE_TOKEN_ID.test(tokenId) || !SAFE_TOKEN_ID.test(reservationId)) {
    throw new Error("Invalid token cost reservation identifier")
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function statusError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}
