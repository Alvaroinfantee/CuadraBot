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

test("authenticated sessions cannot directly mutate takeoff storage", () => {
  assert.match(
    migration,
    /revoke insert, update, delete on table storage\.objects from authenticated;/
  )
  assert.doesNotMatch(
    migration,
    /create policy "takeoff uploads owner (?:insert|update|delete)"/
  )
  assert.doesNotMatch(
    migration,
    /grant select, insert, update, delete on table storage\.objects to authenticated/
  )
})
