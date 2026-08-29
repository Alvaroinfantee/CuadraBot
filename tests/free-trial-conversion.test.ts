import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(path, "utf8")

test("the public funnel makes the fixed-price Spanish product unmistakable", () => {
  const home = read("src/app/page.tsx")
  const spanishHome = read("src/app/es/page.tsx")
  const landing = read("src/components/takeoff/takeoff-landing.tsx")
  const order = read("src/components/takeoff/local-order-flow.tsx")

  assert.match(home, /<TakeoffLanding/)
  assert.match(spanishHome, /<TakeoffLanding/)
  assert.match(landing, /Precio fijo: 149 € \+ IVA/)
  assert.match(landing, /Hasta 20 hojas relevantes/)
  assert.match(landing, /Sin suscripcion/)
  assert.match(landing, /Excel de cantidades y un PDF marcado/)
  assert.match(order, /Pago protegido por Stripe/)
  assert.match(landing, /sin crear contraseña/i)
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
