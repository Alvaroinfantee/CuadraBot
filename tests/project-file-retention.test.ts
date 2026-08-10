import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { requiredServiceChecks } from "../src/lib/admin-analytics"
import {
  DEFAULT_PROJECT_FILE_RETENTION_DAYS,
  isIncludedCorrectionWindowOpen,
  isProjectFileRetentionEligible,
  MAX_PROJECT_FILE_RETENTION_DAYS,
  MIN_PROJECT_FILE_RETENTION_DAYS,
  parseProjectFileRetentionDays,
  projectFileRetentionCutoff,
  projectFileRetentionStatuses,
} from "../src/lib/project-file-retention"
import { removeTrackedStorageObjects } from "../src/lib/project-file-retention-storage"

test("the launch retention default is a valid conservative integer", () => {
  assert.deepEqual(
    parseProjectFileRetentionDays(DEFAULT_PROJECT_FILE_RETENTION_DAYS),
    { ok: true, days: 30 }
  )
})

test("retention parsing rejects malformed and unsafe values", () => {
  for (const value of [
    null,
    undefined,
    "30",
    30.5,
    MIN_PROJECT_FILE_RETENTION_DAYS - 1,
    MAX_PROJECT_FILE_RETENTION_DAYS + 1,
  ]) {
    assert.equal(parseProjectFileRetentionDays(value).ok, false)
  }
})

test("only old terminal jobs are eligible for project-file deletion", () => {
  const cutoff = "2026-07-01T00:00:00.000Z"
  for (const status of projectFileRetentionStatuses) {
    assert.equal(
      isProjectFileRetentionEligible({
        status,
        retentionAt: "2026-06-30T23:59:59.999Z",
        cutoff,
      }),
      true
    )
  }

  for (const status of [
    "draft",
    "awaiting_upload",
    "ready",
    "queued",
    "processing",
    "needs_review",
  ]) {
    assert.equal(
      isProjectFileRetentionEligible({
        status,
        retentionAt: "2020-01-01T00:00:00.000Z",
        cutoff,
      }),
      false
    )
  }
})

test("the cutoff boundary and invalid timestamps fail closed", () => {
  const cutoff = "2026-07-01T00:00:00.000Z"
  assert.equal(
    isProjectFileRetentionEligible({
      status: "completed",
      retentionAt: cutoff,
      cutoff,
    }),
    false
  )
  assert.equal(
    isProjectFileRetentionEligible({
      status: "completed",
      retentionAt: "not-a-date",
      cutoff,
    }),
    false
  )
})

test("retention cutoff is calculated in exact 24-hour days", () => {
  assert.equal(
    projectFileRetentionCutoff(
      new Date("2026-07-31T12:00:00.000Z"),
      30
    ),
    "2026-07-01T12:00:00.000Z"
  )
})

test("the included correction window closes after seven exact days", () => {
  const now = new Date("2026-07-29T12:00:00.000Z")
  assert.equal(
    isIncludedCorrectionWindowOpen("2026-07-22T12:00:00.000Z", now),
    true
  )
  assert.equal(
    isIncludedCorrectionWindowOpen("2026-07-22T11:59:59.999Z", now),
    false
  )
  assert.equal(isIncludedCorrectionWindowOpen("invalid", now), false)
})

test("the migration keeps a durable marker so cleaned jobs cannot starve later batches", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260729153834_takeoff_self_serve_saas.sql",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(migration, /project_files_purged_at timestamptz/)
  assert.match(
    migration,
    /status in \('completed', 'failed', 'canceled'\)\s+and project_files_purged_at is null/
  )

  const route = readFileSync(
    new URL(
      "../src/app/api/internal/cron/retention/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(route, /\.is\("project_files_purged_at", null\)/)
  assert.match(route, /project_files_purge_token: claimToken/)
  assert.match(route, /const RETENTION_LEASE_HOURS = 2/)
  assert.match(
    route,
    /\.lte\("project_files_purge_expires_at", claimedAt\.toISOString\(\)\)/
  )
  assert.match(route, /purgeBoardScheduledMarketingEvents/)
  assert.match(route, /\.not\("retention_until", "is", null\)/)
  assert.match(route, /\.eq\("legal_hold", false\)/)
  assert.match(route, /\.lte\("retention_until", new Date\(\)\.toISOString\(\)\)/)
  assert.match(route, /MAX_MARKETING_EVENTS_PER_RUN = 10_000/)

  const claimPosition = route.indexOf(
    "const claimed = await claimRetentionJobs"
  )
  const deletionPosition = route.indexOf(
    "const deletion = await removeTrackedStorageObjects"
  )
  assert.ok(claimPosition >= 0 && deletionPosition > claimPosition)

  assert.match(
    migration,
    /old\.project_files_purge_token is not null\s+and old\.project_files_purge_expires_at > now\(\)/
  )
  assert.match(
    migration,
    /before insert on public\.takeoff_files\s+for each row execute function public\.guard_takeoff_file_insert_during_retention\(\)/
  )
})

test("partial Storage failures retry exact existing paths and retain failed metadata", async () => {
  const files = [
    { id: "missing", storage_path: "user/job/missing.pdf" },
    { id: "retried", storage_path: "user/job/retried.xlsx" },
    { id: "failed", storage_path: "user/job/failed.json" },
    { id: "unknown", storage_path: "user/job/unknown.log" },
  ]
  const removeCalls: string[][] = []
  const existsCalls: string[] = []
  const storage = {
    async remove(paths: string[]) {
      removeCalls.push(paths)
      if (paths.length > 1) return { error: new Error("partial failure") }
      return {
        error:
          paths[0] === "user/job/failed.json"
            ? new Error("still unavailable")
            : null,
      }
    },
    async exists(path: string) {
      existsCalls.push(path)
      if (path === "user/job/unknown.log") {
        return { data: null, error: new Error("probe unavailable") }
      }
      return { data: path !== "user/job/missing.pdf", error: null }
    },
  }

  const result = await removeTrackedStorageObjects(storage, files)

  assert.deepEqual(
    result.succeeded.map((file) => file.id),
    ["missing", "retried"]
  )
  assert.equal(result.failed, 2)
  assert.deepEqual(existsCalls, files.map((file) => file.storage_path))
  assert.deepEqual(removeCalls, [
    files.map((file) => file.storage_path),
    ["user/job/retried.xlsx"],
    ["user/job/failed.json"],
  ])
})

test("the admin dashboard requires the exact retention health reporter", () => {
  assert.equal(
    requiredServiceChecks.some(
      (check) =>
        check.serviceName === "cuadrabot-retention" &&
        check.checkName === "project-files"
    ),
    true
  )
})
