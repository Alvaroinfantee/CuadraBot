import assert from "node:assert/strict"
import test from "node:test"
import {
  digestRequestIp,
  getRequestIp,
} from "../src/lib/request-rate-limit"

test("uses DigitalOcean's authenticated client address in production", () => {
  const request = new Request("https://cuadrabot.com/api/takeoff/jobs", {
    headers: {
      "do-connecting-ip": "203.0.113.7",
      "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1",
      "x-forwarded-for": "198.51.100.9",
    },
  })

  assert.equal(getRequestIp(request, "production"), "203.0.113.7")
})

test("production ignores spoofable forwarding headers and fails closed", () => {
  const spoofed = new Request("https://cuadrabot.com/api/takeoff/jobs", {
    headers: {
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.9",
      "x-real-ip": "192.0.2.8",
    },
  })
  assert.equal(getRequestIp(spoofed, "production"), "unknown")

  const malformed = new Request("https://cuadrabot.com/api/takeoff/jobs", {
    headers: { "do-connecting-ip": "not-an-ip" },
  })
  assert.equal(getRequestIp(malformed, "production"), "unknown")
})

test("uses a stable fallback without storing a raw address", () => {
  const request = new Request("https://cuadrabot.com/api/takeoff/jobs")
  assert.equal(getRequestIp(request, "production"), "unknown")

  const digest = digestRequestIp("203.0.113.7", "x".repeat(32))
  assert.match(digest, /^[a-f0-9]{64}$/)
  assert.equal(digest.includes("203.0.113.7"), false)
})

test("different secrets cannot correlate the same address", () => {
  const first = digestRequestIp("203.0.113.7", "a".repeat(32))
  const second = digestRequestIp("203.0.113.7", "b".repeat(32))
  assert.notEqual(first, second)
})
