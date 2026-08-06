import {
  SAFE_PROCESSOR_JOB_ID,
  SAFE_TOKEN_ID,
  assertSafeId,
  assertUuid,
} from "./util.mjs"
import { isBudgetClass } from "./budget-policy.mjs"

export function validateBrokerState(state) {
  if (
    !state ||
    state.version !== 1 ||
    !state.executions ||
    Array.isArray(state.executions) ||
    typeof state.executions !== "object"
  ) {
    throw new Error("Invalid broker state")
  }
  for (const [executionId, record] of Object.entries(state.executions)) {
    assertSafeId(executionId, "execution identifier")
    if (
      !record ||
      record.executionId !== executionId ||
      !["starting", "running", "cleaning"].includes(record.status) ||
      !Number.isSafeInteger(record.createdAt) ||
      !Number.isSafeInteger(record.expiresAt) ||
      record.expiresAt <= record.createdAt ||
      !SAFE_TOKEN_ID.test(record.tokenId) ||
      !SAFE_TOKEN_ID.test(record.egressInstanceId) ||
      !isBudgetClass(record.budgetClass) ||
      !/^[a-f0-9]{64}$/.test(record.userFingerprint) ||
      (record.processorJobId !== null &&
        !SAFE_PROCESSOR_JOB_ID.test(record.processorJobId))
    ) {
      throw new Error("Invalid broker execution record")
    }
    assertSafeId(record.containerName, "container name")
    assertSafeId(record.networkName, "network name")
    assertUuid(record.sourceJobId, "source job identifier")
  }
}
