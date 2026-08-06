import assert from "node:assert/strict"
import test from "node:test"
import {
  normalizeRequiredServiceHealth,
  parseAdminAnalyticsAggregate,
  requiredServiceChecks,
  summarizeServiceHealth,
  takeoffProcessorUsageHealthCheck,
} from "../src/lib/admin-analytics"

const metricNames = [
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
] as const

test("parses a complete database aggregate and derives UTC week labels", () => {
  const metrics = Object.fromEntries(metricNames.map((name) => [name, 0]))
  const parsed = parseAdminAnalyticsAggregate({
    asOf: "2026-07-29T12:00:00.000Z",
    currency: "usd",
    metrics,
    geography: [{ label: "US · CA", users: 4 }],
    statusCounts: [{ status: "completed", count: 2 }],
    funnel: [{ name: "takeoff_draft_created", count: 3 }],
    weeklyUsage: [
      {
        weekStart: "2026-07-27T00:00:00.000Z",
        jobs: 2,
        pages: 15,
      },
    ],
  })

  assert.equal(parsed.metrics.revenue30Cents, 0)
  assert.equal(parsed.geography[0]?.users, 4)
  assert.equal(parsed.weeklyUsage[0]?.label, "Jul 27")
})

test("fails closed when a required metric is missing or nonnumeric", () => {
  const metrics = Object.fromEntries(metricNames.map((name) => [name, 0]))
  delete metrics.revenue30Cents

  assert.throws(
    () =>
      parseAdminAnalyticsAggregate({
        asOf: "2026-07-29T12:00:00.000Z",
        currency: "usd",
        metrics,
        geography: [],
        statusCounts: [],
        funnel: [],
        weeklyUsage: [],
      }),
    /metrics\.revenue30Cents/
  )
})

test("missing required health reporters are explicit unhealthy checks", () => {
  const asOf = "2026-07-29T12:00:00.000Z"
  const rows = normalizeRequiredServiceHealth([], asOf)
  const summary = summarizeServiceHealth(rows, asOf)

  assert.equal(rows.length, requiredServiceChecks.length)
  assert.equal(summary.missing, requiredServiceChecks.length)
  assert.equal(summary.healthy, 0)
})

test("processor usage accounting is a required health reporter", () => {
  assert.ok(
    requiredServiceChecks.some(
      (check) =>
        check.serviceName === takeoffProcessorUsageHealthCheck.serviceName &&
        check.checkName === takeoffProcessorUsageHealthCheck.checkName
    )
  )
})

test("expired healthy reports are stale, not healthy", () => {
  const asOf = "2026-07-29T12:00:00.000Z"
  const [required] = requiredServiceChecks
  const rows = normalizeRequiredServiceHealth(
    [
      {
        id: "health-1",
        service_name: required.serviceName,
        check_name: required.checkName,
        status: "healthy",
        message: null,
        details: {},
        checked_at: "2026-07-29T11:50:00.000Z",
        expires_at: "2026-07-29T11:55:00.000Z",
      },
    ],
    asOf
  )
  const summary = summarizeServiceHealth(rows, asOf)

  assert.equal(summary.stale, 1)
  assert.equal(summary.healthy, 0)
  assert.equal(summary.missing, requiredServiceChecks.length - 1)
})
