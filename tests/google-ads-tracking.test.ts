import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
}

const layout = read("src/app/layout.tsx")
const globalTag = read("src/components/site/google-ads.tsx")
const googleAdsConfig = read("src/lib/google-ads.ts")
const consent = read("src/components/site/google-ads-consent.tsx")
const conversion = read("src/components/site/google-ads-conversion.tsx")
const poller = read("src/components/billing/checkout-conversion-poller.tsx")
const verification = read("src/lib/billing-conversion.ts")
const billingPage = read("src/app/dashboard/billing/page.tsx")
const checkoutRoute = read("src/app/api/billing/checkout/route.ts")
const marketingAnalytics = read("src/components/site/marketing-analytics.tsx")
const signupAction = read("src/app/auth/actions.ts")
const takeoffForm = read("src/components/takeoff/new-takeoff-form.tsx")
const checkoutButton = read("src/components/billing/checkout-button.tsx")

test("the Google tag is global and initializes Consent Mode v2 first", () => {
  assert.match(layout, /<GoogleAdsTag locale=\{locale\}/)
  assert.match(globalTag, /strategy="beforeInteractive"/)
  assert.match(globalTag, /gtag\/js\?id=/)
  assert.match(globalTag, /window\.gtag\('config'/)
  assert.ok(
    globalTag.indexOf("window.gtag('config'") <
      globalTag.indexOf('id="google-ads-library"')
  )

  for (const consentType of [
    "ad_storage",
    "analytics_storage",
    "ad_user_data",
    "ad_personalization",
  ]) {
    assert.match(globalTag, new RegExp(`'${consentType}'`))
    assert.match(consent, new RegExp(`${consentType}: state`))
  }

  assert.match(globalTag, /ads_data_redaction/)
  assert.match(globalTag, /marketingConsentCookieName/)
  assert.match(globalTag, /globalPrivacyControl/)
  assert.match(consent, /Max-Age=31536000/)
  assert.match(consent, /Cookie settings/)
  assert.match(consent, /marketingConsentChangedEvent/)
  assert.match(marketingAnalytics, /deleteMarketingIdentity/)
})

test("purchase conversion requires a server-verified paid Stripe session", () => {
  assert.match(verification, /\.eq\("user_id", userId\)/)
  assert.match(
    verification,
    /\.eq\("stripe_checkout_session_id", checkoutSessionId\)/
  )
  assert.match(verification, /session\.status === "complete"/)
  assert.match(verification, /session\.payment_status === "paid"/)
  assert.match(
    verification,
    /session\.metadata\?\.cuadrabot_user_id === userId/
  )
  assert.match(verification, /valueCents: amountTotal/)
  assert.match(billingPage, /verifyBillingConversion\(user\.id, checkoutSessionId\)/)
  assert.match(billingPage, /<GoogleAdsPurchaseConversion/)
  assert.match(billingPage, /<CheckoutConversionPoller/)
  assert.match(poller, /router\.refresh\(\)/)
  assert.match(poller, /maxPollAttempts = 30/)
  assert.match(checkoutRoute, /payment_method_types: \["card"\]/)
})

test("the conversion event uses a Stripe transaction id and has no fake fallback value", () => {
  assert.match(conversion, /transaction_id: transactionId/)
  assert.match(conversion, /Number\.isSafeInteger\(valueCents\)/)
  assert.doesNotMatch(conversion, /valueCents \?[^\n]+: 1/)
  assert.match(conversion, /sessionStorage\.setItem/)
  assert.match(conversion, /emitMarketingEvent\("purchase_completed"\)/)
})

test("intermediate funnel conversions are consented, deduplicated, and remain separate from purchase", () => {
  assert.match(marketingAnalytics, /sendGoogleAdsFunnelConversion/)
  assert.match(marketingAnalytics, /sign_up_completed/)
  assert.match(marketingAnalytics, /takeoff_started/)
  assert.match(marketingAnalytics, /checkout_started/)
  assert.match(signupAction, /marketingAccountCreatedCookieName/)
  assert.match(read("src/app/auth/confirm/route.ts"), /accountCreated/)
  assert.match(takeoffForm, /"takeoff_started"/)
  assert.match(checkoutButton, /"checkout_started"/)
  assert.match(googleAdsConfig, /o60NCISN694cELXR-N1D/)
  assert.match(googleAdsConfig, /2NvSCIqN694cELXR-N1D/)
  assert.match(googleAdsConfig, /uoDlCIeN694cELXR-N1D/)
})

test("both privacy notices describe Google Ads consent", () => {
  assert.match(read("src/app/privacy/page.tsx"), /Google Ads conversion measurement/)
  assert.match(read("src/app/es/privacy/page.tsx"), /conversiones de Google Ads/)
})
