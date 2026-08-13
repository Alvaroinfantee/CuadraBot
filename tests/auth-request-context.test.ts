import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

test("authenticated takeoff routes resolve user and profile through one auth context", () => {
  const createRoute = read("src/app/api/takeoff/jobs/route.ts")
  const submitRoute = read("src/app/api/takeoff/jobs/[id]/submit/route.ts")
  const auth = read("src/lib/auth.ts")

  assert.match(createRoute, /getCurrentAuthContext\(\)/)
  assert.match(submitRoute, /getCurrentAuthContext\(\)/)
  assert.doesNotMatch(
    `${createRoute}\n${submitRoute}`,
    /getCurrentUser\(\)[\s\S]{0,100}getCurrentProfile\(\)/
  )
  assert.match(auth, /const \{ user, profile \} = await getCurrentAuthContext\(\)/)
})

test("takeoff form replaces non-JSON API failures with customer-safe errors", () => {
  const form = read("src/components/takeoff/new-takeoff-form.tsx")

  assert.match(form, /draftResponse\.json\(\)\.catch/)
  assert.match(form, /quoteResponse\.json\(\)\.catch/)
  assert.match(form, /response\.json\(\)\.catch/)
})
