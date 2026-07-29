import assert from "node:assert/strict"
import test from "node:test"
import {
  digestRequestIp,
  getRequestIp,
} from "../src/lib/request-rate-limit"

test("prefers the platform-authenticated forwarded address", () => {
  const request = new Request("https://cuadrabot.com/api/takeoff/jobs", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1",
      "x-forwarded-for": "198.51.100.9",
    },
  })

  assert.equal(getRequestIp(request), "203.0.113.7")
})

test("uses a stable fallback without storing a raw address", () => {
  const request = new Request("https://cuadrabot.com/api/takeoff/jobs")
  assert.equal(getRequestIp(request), "unknown")

  const digest = digestRequestIp("203.0.113.7", "x".repeat(32))
  assert.match(digest, /^[a-f0-9]{64}$/)
  assert.equal(digest.includes("203.0.113.7"), false)
})

test("different secrets cannot correlate the same address", () => {
  const first = digestRequestIp("203.0.113.7", "a".repeat(32))
  const second = digestRequestIp("203.0.113.7", "b".repeat(32))
  assert.notEqual(first, second)
})
