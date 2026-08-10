import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  classifyUserAgent,
  coarseRequestGeo,
  parseMarketingEventInput,
  readCookie,
} from "../src/lib/marketing-event"
import { parseAdminMarketingSnapshot } from "../src/lib/marketing-analytics"

const validEvent = {
  eventName: "page_view",
  anonymousId: "9b169a18-5eb7-4b56-b172-5f31be340c42",
  sessionId: "d6c71d7d-8441-4916-9048-e270a7b39ef1",
  landingPath: "/pricing",
  referrerHost: "google.com",
  source: "google",
  medium: "cpc",
  campaign: "takeoff-us",
  term: "electrical takeoff",
  content: "blueprint-counts",
  clickIdKind: "gclid",
  clickId: "test-click-id",
  tags: { adgroup_id: "123" },
  metadata: { language: "en-US", viewport_band: "large" },
}

test("accepts bounded consented marketing fields and rejects invalid identity", () => {
  assert.deepEqual(parseMarketingEventInput(validEvent), validEvent)
  assert.equal(
    parseMarketingEventInput({ ...validEvent, anonymousId: "visitor-1" }),
    null
  )
  assert.equal(
    parseMarketingEventInput({ ...validEvent, landingPath: "https://evil.test" }),
    null
  )
})

test("reduces user agents to coarse device, browser, and OS families", () => {
  assert.deepEqual(
    classifyUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
    ),
    { deviceType: "mobile", browserFamily: "Safari", osFamily: "iOS" }
  )
  assert.deepEqual(
    classifyUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36"
    ),
    { deviceType: "desktop", browserFamily: "Chrome", osFamily: "Windows" }
  )
})

test("uses only validated coarse geo headers and parses consent cookies", () => {
  assert.deepEqual(
    coarseRequestGeo(
      new Headers({ "cf-ipcountry": "es", "cf-region-code": "MD" })
    ),
    { countryCode: "ES", region: "MD" }
  )
  assert.deepEqual(
    coarseRequestGeo(new Headers({ "cf-ipcountry": "unknown" })),
    { countryCode: null, region: null }
  )
  assert.equal(
    readCookie("a=1; cuadrabot_marketing_consent_v2=granted", "cuadrabot_marketing_consent_v2"),
    "granted"
  )
})

test("parses the private admin marketing aggregate", () => {
  const parsed = parseAdminMarketingSnapshot({
    asOf: "2026-08-09T12:00:00.000Z",
    metrics: {
      events30: 8,
      visitors30: 3,
      sessions30: 4,
      pageViews30: 6,
      accountsCreated30: 2,
      blueprintUploadsStarted30: 2,
      checkoutsStarted30: 1,
      purchases30: 1,
    },
    devices: [{ label: "desktop", events: 5, visitors: 2 }],
    geography: [{ label: "ES", events: 5, visitors: 2 }],
    ageBands: [{ label: "35-44", visitors: 1 }],
    campaigns: [
      {
        source: "google",
        medium: "cpc",
        campaign: "takeoff-us",
        events: 5,
        visitors: 2,
        accountsCreated: 2,
        blueprintUploadsStarted: 2,
        checkoutsStarted: 1,
        purchases: 1,
      },
    ],
  })
  assert.equal(parsed.metrics.purchases30, 1)
  assert.equal(parsed.metrics.accountsCreated30, 2)
  assert.equal(parsed.metrics.blueprintUploadsStarted30, 2)
  assert.equal(parsed.metrics.checkoutsStarted30, 1)
  assert.equal(parsed.campaigns[0]?.source, "google")
})

test("marketing storage is consent-only, private, coarse, and retained for 13 months", () => {
  const migration = read(
    "supabase/migrations/20260809164941_consent_aware_marketing_analytics.sql"
  )
  const route = read("src/app/api/marketing/events/route.ts")
  const tracker = read("src/components/site/marketing-tracker.tsx")
  const consent = read("src/components/site/google-ads-consent.tsx")
  const retention = read("src/app/api/internal/cron/retention/route.ts")

  assert.match(migration, /create table if not exists public\.marketing_events/)
  assert.match(migration, /alter table public\.marketing_events enable row level security/)
  assert.match(migration, /from public, anon, authenticated/)
  assert.match(migration, /to service_role/)
  assert.doesNotMatch(migration, /\bip_address\b|\buser_agent\b/)
  assert.match(route, /consent !== "granted"/)
  assert.match(route, /classifyUserAgent/)
  assert.match(route, /coarseRequestGeo/)
  assert.match(tracker, /utm_campaign/)
  assert.match(tracker, /gclid/)
  assert.match(consent, /globalPrivacyControl/)
  assert.match(retention, /setUTCMonth\(cutoff\.getUTCMonth\(\) - 13\)/)
})

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
}
