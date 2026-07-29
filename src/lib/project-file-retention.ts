export const PROJECT_FILE_RETENTION_SETTING_KEY =
  "retention.project_files_days"
export const DEFAULT_PROJECT_FILE_RETENTION_DAYS = 30
export const INCLUDED_CORRECTION_WINDOW_DAYS = 7
export const MIN_PROJECT_FILE_RETENTION_DAYS =
  INCLUDED_CORRECTION_WINDOW_DAYS
export const MAX_PROJECT_FILE_RETENTION_DAYS = 365

export const projectFileRetentionStatuses = [
  "completed",
  "failed",
  "canceled",
] as const

export const PROJECT_FILE_RETENTION_DESCRIPTION =
  "Days to keep tracked customer uploads and generated takeoff files after a job is completed, failed, or canceled."

export type ProjectFileRetentionParseResult =
  | { ok: true; days: number }
  | { ok: false; error: string }

export function parseProjectFileRetentionDays(
  value: unknown
): ProjectFileRetentionParseResult {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return {
      ok: false,
      error: "Project-file retention must be a whole number of days.",
    }
  }

  if (
    value < MIN_PROJECT_FILE_RETENTION_DAYS ||
    value > MAX_PROJECT_FILE_RETENTION_DAYS
  ) {
    return {
      ok: false,
      error: `Project-file retention must be between ${MIN_PROJECT_FILE_RETENTION_DAYS} and ${MAX_PROJECT_FILE_RETENTION_DAYS} days.`,
    }
  }

  return { ok: true, days: value }
}

export function projectFileRetentionCutoff(
  now: Date,
  retentionDays: number
) {
  const parsed = parseProjectFileRetentionDays(retentionDays)
  if (!parsed.ok) throw new Error(parsed.error)

  return new Date(
    now.getTime() - parsed.days * 24 * 60 * 60 * 1000
  ).toISOString()
}

export function isIncludedCorrectionWindowOpen(
  completedAt: string,
  now: Date = new Date()
) {
  const completed = Date.parse(completedAt)
  return (
    Number.isFinite(completed) &&
    now.getTime() - completed <=
      INCLUDED_CORRECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
}

export function isProjectFileRetentionEligible(input: {
  status: string
  retentionAt: string
  cutoff: string
}) {
  if (
    !projectFileRetentionStatuses.includes(
      input.status as (typeof projectFileRetentionStatuses)[number]
    )
  ) {
    return false
  }

  const retentionAt = Date.parse(input.retentionAt)
  const cutoff = Date.parse(input.cutoff)
  return (
    Number.isFinite(retentionAt) &&
    Number.isFinite(cutoff) &&
    retentionAt < cutoff
  )
}
