import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  countryMarketingPrivacyRegion,
  regulatedMarketingCountryCodes,
} from "../src/lib/marketing-analytics"
import {
  browserDimensions,
  isUuid,
  marketingEventSchema,
  requestIsSameOrigin,
} from "../src/lib/marketing-event"

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
}

test("marketing payloads accept bounded campaign dimensions and reject extras", () => {
  const valid = {
    eventName: "page_view",
    pagePath: "/pricing",
    landingPath: "/",
    referrerHost: "example.com",
    source: "google",
    medium: "cpc",
    campaign: "launch",
    term: null,
    content: null,
    firstSource: "google",
    firstMedium: "cpc",
    firstCampaign: "launch",
    clickIdType: "gclid",
    language: "en-US",
    timezone: "Europe/Madrid",
    screenBucket: "1024_1439",
    consentVersion: 2,
  }

  assert.equal(marketingEventSchema.safeParse(valid).success, true)
  assert.equal(
    marketingEventSchema.safeParse({ ...valid, rawCookie: "secret" }).success,
    false
  )
  assert.equal(
    marketingEventSchema.safeParse({ ...valid, pagePath: "https://bad.test" })
      .success,
    false
  )
})

test("device parsing stores categories rather than the raw user-agent", () => {
  assert.deepEqual(
    browserDimensions(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
    ),
    { deviceType: "mobile", browserName: "Safari", osName: "iOS" }
  )
  assert.deepEqual(
    browserDimensions(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0"
    ),
    { deviceType: "desktop", browserName: "Edge", osName: "Windows" }
  )
})

test("the ingestion endpoint requires a same-origin browser request", () => {
  const sameOrigin = new Request("https://cuadrabot.com/api/marketing/events", {
    method: "POST",
    headers: {
      origin: "https://cuadrabot.com",
      "sec-fetch-site": "same-origin",
    },
  })
  const crossOrigin = new Request("https://cuadrabot.com/api/marketing/events", {
    method: "POST",
    headers: {
      origin: "https://attacker.test",
      "sec-fetch-site": "cross-site",
    },
  })
  assert.equal(requestIsSameOrigin(sameOrigin), true)
  assert.equal(requestIsSameOrigin(crossOrigin), false)
  assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true)
  assert.equal(isUuid("not-a-uuid"), false)
})

test("regional consent is opt-in for EEA, UK, and Switzerland", () => {
  for (const country of ["ES", "DE", "NO", "GB", "CH"]) {
    assert.equal(countryMarketingPrivacyRegion(country), "regulated")
    assert.equal(regulatedMarketingCountryCodes.includes(country as never), true)
  }
  assert.equal(countryMarketingPrivacyRegion("US"), "standard")
  assert.equal(countryMarketingPrivacyRegion("CA"), "standard")
  assert.equal(countryMarketingPrivacyRegion(null), "unknown")
})

test("consent is versioned and raw cookie or IP values are never collected", () => {
  const tracker = read("src/components/site/marketing-analytics.tsx")
  const consent = read("src/components/site/google-ads-consent.tsx")
  const route = read("src/app/api/marketing/events/route.ts")
  const migration = read(
    "supabase/migrations/20260810135927_upgrade_consented_marketing_intelligence.sql"
  )

  assert.match(tracker, /cuadrabot_mid|marketingAnonymousCookieName/)
  assert.match(tracker, /cuadrabot_attribution|marketingAttributionCookieName/)
  assert.match(consent, /previous grant covered only Google Ads/)
  assert.match(consent, /Reject optional analytics/)
  assert.doesNotMatch(route, /\.from\("cookies"\)/)
  assert.doesNotMatch(route, /raw_ip|raw_user_agent|cookie_value/)
  assert.match(migration, /retention_until timestamptz/)
  assert.match(migration, /"mode":"board_pending","days":null/)
  assert.doesNotMatch(migration, /interval '365 days'/)
  assert.match(migration, /revoke all on table public\.marketing_events from public, anon, authenticated/)
  assert.match(route, /marketingCollectionIsPermitted/)
  assert.match(
    read("src/lib/google-ads-bootstrap.ts"),
    /regulatedMarketingCountryCodes/
  )
  assert.match(tracker, /legacyGoogleConsentCookieName/)
  assert.match(
    read("src/lib/privacy-region-server.ts"),
    /legacyGoogleConsentCookieName/
  )
  assert.match(read("src/lib/privacy-region-server.ts"), /sec-gpc/)
  assert.match(read("src/lib/country-geolocation.ts"), /https:\/\/api\.country\.is/)
  assert.doesNotMatch(read("src/lib/privacy-region-server.ts"), /MAXMIND_/)
})
