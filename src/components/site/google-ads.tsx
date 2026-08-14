import { GoogleAdsConsent } from "@/components/site/google-ads-consent"
import { MarketingAnalytics } from "@/components/site/marketing-analytics"
import {
  googleAdsConfigurationIsValid,
  googleAdsId,
} from "@/lib/google-ads"
import type { Locale } from "@/lib/i18n"
import { marketingConsentCookieName } from "@/lib/marketing-analytics"

export function GoogleAdsTag({ locale }: { locale: Locale }) {
  return (
    <>
      <MarketingAnalytics />
      <GoogleAdsConsent
        cookieName={marketingConsentCookieName}
        googleAdsEnabled={googleAdsConfigurationIsValid}
        googleAdsId={googleAdsId}
        locale={locale}
      />
    </>
  )
}
