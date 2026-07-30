export type AdminAnalyticsMetrics = {
  totalUsers: number
  newUsers30: number
  userGrowthPct: number
  activeSubscriptions: number
  subscriptionNet30: number
  pastDueSubscriptions: number
  mrrCents: number
  revenue30Cents: number
  refunds30: number
  jobs30: number
  pages30: number
  completedJobs30: number
  failedJobs30: number
  onTimeEligible30: number
  deliveredJobs30: number
  failureRate30: number
  onTimeRate30: number
  correctionRate30: number
  availableCredits: number
  consumedCredits: number
  companiesWithConfirmedJobs: number
  repeatCompanies: number
  repeatCompanyRate: number
  knownLocationUsers: number
  countries: number
  missingCountry: number
  unpricedPlans: number
  staleProcessing: number
  failedStripeEvents: number
  annotationCountedUnits30: number
  annotationSkipped30: number
  annotationCoverage30: number
}

export type AdminAnalyticsAggregate = {
  asOf: string
  currency: "usd"
  metrics: AdminAnalyticsMetrics
  geography: Array<{ label: string; users: number }>
  statusCounts: Array<{ status: string; count: number }>
  funnel: Array<{ name: string; count: number }>
  weeklyUsage: Array<{
    weekStart: string
    label: string
    jobs: number
    pages: number
  }>
}

export type ServiceHealthRow = {
  id: string
  service_name: string
  check_name: string
  status: "healthy" | "degraded" | "down" | "unknown"
  message: string | null
  details: Record<string, unknown>
  checked_at: string
  expires_at: string | null
  missing: boolean
}

export const requiredServiceChecks = [
  {
    serviceName: "cuadrabot-worker",
    checkName: "poll-loop",
    label: "Takeoff worker poll loop",
  },
  {
    serviceName: "takeoff-processor",
    checkName: "readiness",
    label: "Takeoff processor",
  },
  {
    serviceName: "cuadrabot-reconciler",
    checkName: "stale-claims",
    label: "Stale-claim reconciler",
  },
  {
    serviceName: "cuadrabot-retention",
    checkName: "project-files",
    label: "Generated-file retention",
  },
  {
    serviceName: "cuadrabot-archive",
    checkName: "source-integrity",
    label: "Source-plan archive integrity",
  },
] as const

const metricKeys = [
  "totalUsers",
  "newUsers30",
  "userGrowthPct",
  "activeSubscriptions",
  "subscriptionNet30",
  "pastDueSubscriptions",
  "mrrCents",
  "revenue30Cents",
  "refunds30",
  "jobs30",
  "pages30",
  "completedJobs30",
  "failedJobs30",
  "onTimeEligible30",
  "deliveredJobs30",
  "failureRate30",
  "onTimeRate30",
  "correctionRate30",
  "availableCredits",
  "consumedCredits",
  "companiesWithConfirmedJobs",
  "repeatCompanies",
  "repeatCompanyRate",
  "knownLocationUsers",
  "countries",
  "missingCountry",
  "unpricedPlans",
  "staleProcessing",
  "failedStripeEvents",
  "annotationCountedUnits30",
  "annotationSkipped30",
  "annotationCoverage30",
] as const satisfies readonly (keyof AdminAnalyticsMetrics)[]

export function parseAdminAnalyticsAggregate(
  value: unknown
): AdminAnalyticsAggregate {
  const root = asRecord(value, "admin analytics aggregate")
  const asOf = requiredIsoString(root.asOf, "asOf")
  if (root.currency !== "usd") {
    throw new Error("Admin analytics must use the configured USD catalog.")
  }

  const rawMetrics = asRecord(root.metrics, "metrics")
  const metrics = Object.fromEntries(
    metricKeys.map((key) => [key, finiteNumber(rawMetrics[key], `metrics.${key}`)])
  ) as unknown as AdminAnalyticsMetrics

  return {
    asOf,
    currency: "usd",
    metrics,
    geography: parseArray(root.geography, "geography", (row, index) => {
      const item = asRecord(row, `geography[${index}]`)
      return {
        label: requiredString(item.label, `geography[${index}].label`),
        users: nonNegativeInteger(
          item.users,
          `geography[${index}].users`
        ),
      }
    }),
    statusCounts: parseArray(
      root.statusCounts,
      "statusCounts",
      (row, index) => {
        const item = asRecord(row, `statusCounts[${index}]`)
        return {
          status: requiredString(
            item.status,
            `statusCounts[${index}].status`
          ),
          count: nonNegativeInteger(
            item.count,
            `statusCounts[${index}].count`
          ),
        }
      }
    ),
    funnel: parseArray(root.funnel, "funnel", (row, index) => {
      const item = asRecord(row, `funnel[${index}]`)
      return {
        name: requiredString(item.name, `funnel[${index}].name`),
        count: nonNegativeInteger(item.count, `funnel[${index}].count`),
      }
    }),
    weeklyUsage: parseArray(
      root.weeklyUsage,
      "weeklyUsage",
      (row, index) => {
        const item = asRecord(row, `weeklyUsage[${index}]`)
        const weekStart = requiredIsoString(
          item.weekStart,
          `weeklyUsage[${index}].weekStart`
        )
        return {
          weekStart,
          label: new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(new Date(weekStart)),
          jobs: nonNegativeInteger(
            item.jobs,
            `weeklyUsage[${index}].jobs`
          ),
          pages: nonNegativeInteger(
            item.pages,
            `weeklyUsage[${index}].pages`
          ),
        }
      }
    ),
  }
}

export function normalizeRequiredServiceHealth(
  rows: Array<Omit<ServiceHealthRow, "missing">>,
  asOf: string
) {
  const byKey = new Map(
    rows.map((row) => [`${row.service_name}\u0000${row.check_name}`, row])
  )
  const normalized: ServiceHealthRow[] = rows.map((row) => ({
    ...row,
    missing: false,
  }))

  for (const required of requiredServiceChecks) {
    const key = `${required.serviceName}\u0000${required.checkName}`
    if (byKey.has(key)) continue
    normalized.push({
      id: `missing:${required.serviceName}:${required.checkName}`,
      service_name: required.serviceName,
      check_name: required.checkName,
      status: "unknown",
      message: `${required.label} has not reported health yet.`,
      details: { required: true, reporter_missing: true },
      checked_at: asOf,
      expires_at: null,
      missing: true,
    })
  }

  return normalized.sort((left, right) => {
    const service = left.service_name.localeCompare(right.service_name)
    return service || left.check_name.localeCompare(right.check_name)
  })
}

export function summarizeServiceHealth(
  rows: ServiceHealthRow[],
  asOf: string
) {
  const now = new Date(asOf).getTime()
  const isCurrent = (row: ServiceHealthRow) =>
    !row.missing &&
    Boolean(row.expires_at) &&
    new Date(row.expires_at as string).getTime() > now

  const missing = rows.filter((row) => row.missing).length
  const stale = rows.filter((row) => !row.missing && !isCurrent(row)).length
  const unhealthy = rows.filter(
    (row) => isCurrent(row) && row.status !== "healthy"
  ).length
  const healthy = rows.filter(
    (row) => isCurrent(row) && row.status === "healthy"
  ).length

  return { missing, stale, unhealthy, healthy, total: rows.length }
}

function asRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}.`)
  }
  return value as Record<string, unknown>
}

function parseArray<Row>(
  value: unknown,
  label: string,
  parse: (value: unknown, index: number) => Row
) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}.`)
  return value.map(parse)
}

function finiteNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label}.`)
  }
  return value
}

function nonNegativeInteger(value: unknown, label: string) {
  const number = finiteNumber(value, label)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid ${label}.`)
  }
  return number
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid ${label}.`)
  }
  return value
}

function requiredIsoString(value: unknown, label: string) {
  const text = requiredString(value, label)
  if (!Number.isFinite(new Date(text).getTime())) {
    throw new Error(`Invalid ${label}.`)
  }
  return text
}
