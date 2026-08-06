import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260729153834_takeoff_self_serve_saas.sql",
    import.meta.url
  ),
  "utf8"
)
const action = readFileSync(
  new URL("../src/app/dashboard/actions.ts", import.meta.url),
  "utf8"
)

test("included correction state, event, alert, and analytics are atomic", () => {
  assert.match(
    migration,
    /create or replace function public\.request_takeoff_correction/
  )
  assert.match(
    migration,
    /job\.completed_at < requested_at - interval '7 days'/
  )
  assert.match(migration, /job\.project_files_purged_at is not null/)
  assert.match(migration, /event\.event_type = 'correction_requested'/)
  assert.match(action, /\.rpc\(\s*"request_takeoff_correction"/)
  assert.doesNotMatch(
    action,
    /\.from\("takeoff_jobs"\)\s*\.update\(\{\s*status: "needs_review"/
  )
})
