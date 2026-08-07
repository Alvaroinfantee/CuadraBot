import Script from "next/script"
import { GoogleAdsConsent } from "@/components/site/google-ads-consent"
import {
  googleAdsConfigurationIsValid,
  googleAdsId,
} from "@/lib/google-ads"
import type { Locale } from "@/lib/i18n"

const consentCookieName = "cuadrabot_google_consent"

export function GoogleAdsTag({ locale }: { locale: Locale }) {
  if (!googleAdsConfigurationIsValid) return null

  const consentBootstrap = `
    (function () {
      var cookieName = ${JSON.stringify(consentCookieName)};
      var match = document.cookie.split('; ').find(function (entry) {
        return entry.indexOf(cookieName + '=') === 0;
      });
      var choice = match ? decodeURIComponent(match.slice(cookieName.length + 1)) : null;
      var granted = choice === 'granted';

      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', {
        'ad_storage': granted ? 'granted' : 'denied',
        'analytics_storage': granted ? 'granted' : 'denied',
        'ad_user_data': granted ? 'granted' : 'denied',
        'ad_personalization': granted ? 'granted' : 'denied',
        'wait_for_update': choice === null ? 500 : 0
      });
      window.gtag('set', 'ads_data_redaction', true);
      window.gtag('js', new Date());
      window.gtag('config', ${JSON.stringify(googleAdsId)});
    })();
  `

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script id="google-ads-consent-default" strategy="beforeInteractive">
        {consentBootstrap}
      </Script>
      <Script
        id="google-ads-library"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          googleAdsId
        )}`}
        strategy="afterInteractive"
      />
      <GoogleAdsConsent cookieName={consentCookieName} locale={locale} />
    </>
  )
}
