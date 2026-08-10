import assert from "node:assert/strict"
import test from "node:test"
import { lookupCountryCode } from "../src/lib/country-geolocation"

test("country lookup sends only a validated IP and accepts a country code", async () => {
  let requestedUrl = ""
  const result = await lookupCountryCode(
    "203.0.113.7",
    async (input, init) => {
      requestedUrl = String(input)
      assert.equal(init?.method, "GET")
      assert.equal(init?.redirect, "error")
      assert.equal(init?.cache, "no-store")
      return new Response('{"ip":"203.0.113.7","country":"ES"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
  )

  assert.equal(requestedUrl, "https://api.country.is/203.0.113.7")
  assert.equal(result, "ES")
})

test("country lookup fails closed on invalid input or untrusted responses", async () => {
  let calls = 0
  const neverFetch = async () => {
    calls += 1
    return new Response('{"country":"US"}')
  }
  assert.equal(await lookupCountryCode("not-an-ip", neverFetch), null)
  assert.equal(calls, 0)

  for (const response of [
    new Response('{"country":"USA"}'),
    new Response('{"country":"US"}', { status: 429 }),
    new Response("x".repeat(1_025)),
    new Response("not-json"),
  ]) {
    assert.equal(
      await lookupCountryCode("203.0.113.7", async () => response),
      null
    )
  }
})
