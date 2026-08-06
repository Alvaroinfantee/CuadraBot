export function normalizeTakeoffJobClaimResult<T>(
  result: T | null | undefined
): T | null {
  if (result === null || typeof result !== "object" || Array.isArray(result)) {
    return null
  }

  const id = (result as Record<string, unknown>).id
  return typeof id === "string" && takeoffJobIdPattern.test(id) ? result : null
}

const takeoffJobIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
