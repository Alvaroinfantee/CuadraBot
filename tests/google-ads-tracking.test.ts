import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8")
}

const layout = read("src/app/layout.tsx")
const globalTag = read("src/components/site/google-ads.tsx")
const consent = read("src/components/site/google-ads-consent.tsx")
const conversion = read("src/components/site/google-ads-conversion.tsx")
const poller = read("src/components/billing/checkout-conversion-poller.tsx")
const verification = read("src/lib/billing-conversion.ts")
const billingPage = read("src/app/dashboard/billing/page.tsx")
const checkoutRoute = read("src/app/api/billing/checkout/route.ts")

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
  assert.match(consent, /Max-Age=31536000/)
  assert.match(consent, /Cookie settings/)
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
})

test("both privacy notices describe Google Ads consent", () => {
  assert.match(read("src/app/privacy/page.tsx"), /Google Ads conversion measurement/)
  assert.match(read("src/app/es/privacy/page.tsx"), /conversiones de Google Ads/)
})
