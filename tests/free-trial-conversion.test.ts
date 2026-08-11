import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(path, "utf8")

test("the public funnel makes the no-card free trial unmistakable", () => {
  const home = read("src/app/page.tsx")
  const spanishHome = read("src/app/es/page.tsx")
  const signup = read("src/app/signup/page.tsx")
  const header = read("src/components/site/site-header.tsx")

  assert.match(home, /Free trial · one real sheet · no credit card/)
  assert.match(home, /Upload one sheet free/)
  assert.match(spanishHome, /Prueba gratis · una hoja real · sin tarjeta/)
  assert.match(signup, /Your free trial is included/)
  assert.match(signup, /One trial per user/)
  assert.match(signup, /Company \(optional\)/)
  assert.doesNotMatch(
    signup,
    /name="companyName"[\s\S]{0,120}\brequired\b/
  )
  assert.match(header, /freeTrialSignupPath/)
})

test("signup and confirmation preserve the free upload destination", () => {
  const signup = read("src/app/signup/page.tsx")
  const actions = read("src/app/auth/actions.ts")
  const confirmation = read("src/app/auth/confirm/route.ts")

  assert.match(signup, /name="next" value=\{next\}/)
  assert.match(actions, /"\/dashboard\/new\?mode=sample"/)
  assert.match(actions, /confirmationUrl\.searchParams\.set\("next", next\)/)
  assert.match(actions, /redirect\(next\)/)
  assert.match(confirmation, /safeRelativePath/)
  assert.match(confirmation, /marketingAccountCreatedCookieName/)
})

test("the free trial is claimed once per authenticated user, not per company", () => {
  const migration = read(
    "supabase/migrations/20260729153834_takeoff_self_serve_saas.sql"
  )
  const functionStart = migration.indexOf(
    "create or replace function public.queue_free_sample("
  )
  const functionEnd = migration.indexOf("create or replace function", functionStart + 1)
  const queueFreeSample = migration.slice(functionStart, functionEnd)

  assert.ok(functionStart >= 0)
  assert.match(queueFreeSample, /where profile\.id = job\.user_id/)
  assert.match(queueFreeSample, /customer\.free_sample_used_at is not null/)
  assert.match(queueFreeSample, /where id = customer\.id/)
  assert.doesNotMatch(queueFreeSample, /company_name/)
})
