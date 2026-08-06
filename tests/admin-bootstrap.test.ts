import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  adminBootstrapKeyPattern,
  digestAdminBootstrapKey,
  digestAdminBootstrapRequestFingerprint,
} from "../src/lib/admin-bootstrap"
import { readRequestTextWithLimit } from "../src/lib/request-body"

const migrationPath =
  "supabase/migrations/20260806192139_admin_bootstrap_recovery.sql"

test("admin bootstrap keys are exact 256-bit hex capabilities", () => {
  const key = "ab".repeat(32)
  assert.equal(adminBootstrapKeyPattern.test(key), true)
  assert.equal(adminBootstrapKeyPattern.test(key.toUpperCase()), false)
  assert.equal(adminBootstrapKeyPattern.test(key.slice(2)), false)
  assert.match(digestAdminBootstrapKey(key), /^[a-f0-9]{64}$/)
  assert.notEqual(digestAdminBootstrapKey(key), key)

  const fingerprint = digestAdminBootstrapRequestFingerprint(
    "203.0.113.9",
    "x".repeat(32)
  )
  assert.match(fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(fingerprint.includes("203.0.113.9"), false)
  assert.throws(() =>
    digestAdminBootstrapRequestFingerprint("203.0.113.9", "short")
  )
})

test("admin bootstrap request bodies are bounded even without Content-Length", async () => {
  const accepted = new Request("https://cuadrabot.com/api/admin/bootstrap", {
    method: "POST",
    body: JSON.stringify({ key: "ab" }),
  })
  assert.deepEqual(await readRequestTextWithLimit(accepted, 128), {
    ok: true,
    value: JSON.stringify({ key: "ab" }),
  })

  const rejected = new Request("https://cuadrabot.com/api/admin/bootstrap", {
    method: "POST",
    body: "x".repeat(129),
  })
  assert.deepEqual(await readRequestTextWithLimit(rejected, 128), {
    ok: false,
    reason: "too_large",
  })
})

test("bootstrap state is private, expiring, single-use, throttled, and service-only", () => {
  const migration = read(migrationPath)
  const route = read("src/app/api/admin/bootstrap/route.ts")

  assert.match(migration, /create schema if not exists private/)
  assert.match(migration, /create table if not exists private\.admin_bootstrap_grants/)
  assert.match(migration, /key_digest bytea not null unique/)
  assert.match(migration, /octet_length\(key_digest\) = 32/)
  assert.match(migration, /expires_at <= created_at \+ interval '24 hours'/)
  assert.match(migration, /for update;/)
  assert.match(migration, /user_failures >= 5/)
  assert.match(migration, /fingerprint_failures >= 15/)
  assert.match(migration, /alter table private\.admin_bootstrap_grants enable row level security/)
  assert.match(migration, /from public, anon, authenticated/)
  assert.match(
    migration,
    /grant execute on function public\.redeem_admin_bootstrap\([\s\S]*?\) to service_role;/
  )
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.redeem_admin_bootstrap\([\s\S]*?\) to authenticated;/
  )
  assert.match(migration, /lower\(btrim\(auth_user\.email\)\)/)
  assert.match(migration, /auth_user\.email_confirmed_at/)
  assert.doesNotMatch(migration, /current_profile\.role = 'admin'/)
  assert.match(migration, /set\s+role = 'admin'/)
  assert.match(migration, /admin_bootstrap_redeemed/)
  assert.match(migration, /set file_size_limit = 26214400/)
  assert.match(route, /createSupabaseAdminClient\(\)/)
  assert.match(route, /readRequestTextWithLimit\([\s\S]*?request/)
  assert.doesNotMatch(route, /console\.|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/)
})

test("new administrator recovery copy is valid UTF-8 Spanish", () => {
  const page = read("src/app/admin-bootstrap/page.tsx")
  const form = read("src/components/admin/admin-bootstrap-form.tsx")
  const combined = `${page}\n${form}`

  assert.match(combined, /Recuperación segura/)
  assert.match(combined, /sesión autenticada/)
  assert.match(combined, /Comprueba que has iniciado sesión/)
  assert.doesNotMatch(combined, /Ã|Â/)
})

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}
