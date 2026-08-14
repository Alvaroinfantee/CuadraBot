import { googleAdsId } from "@/lib/google-ads"
import {
  legacyGoogleConsentCookieName,
  marketingConsentCookieName,
  regulatedMarketingCountryCodes,
} from "@/lib/marketing-analytics"

export function buildGoogleAdsConsentBootstrap() {
  return `
    (function () {
      var cookieName = ${JSON.stringify(marketingConsentCookieName)};
      var legacyCookieName = ${JSON.stringify(legacyGoogleConsentCookieName)};
      var match = document.cookie.split('; ').find(function (entry) {
        return entry.indexOf(cookieName + '=') === 0;
      });
      var choice = match ? decodeURIComponent(match.slice(cookieName.length + 1)) : null;
      var legacyMatch = document.cookie.split('; ').find(function (entry) {
        return entry.indexOf(legacyCookieName + '=') === 0;
      });
      var legacyChoice = legacyMatch ? decodeURIComponent(legacyMatch.slice(legacyCookieName.length + 1)) : null;
      var globalPrivacyControl = navigator.globalPrivacyControl === true;
      var explicitState = choice === 'granted' ? 'granted' : (choice === 'denied' || legacyChoice === 'denied') ? 'denied' : null;
      var globalState = globalPrivacyControl ? 'denied' : (explicitState || 'granted');
      var regulatedState = globalPrivacyControl ? 'denied' : (explicitState || 'denied');

      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', {
        'ad_storage': globalState,
        'analytics_storage': globalState,
        'ad_user_data': globalState,
        'ad_personalization': globalState,
        'wait_for_update': choice === null ? 500 : 0
      });
      window.gtag('consent', 'default', {
        'ad_storage': regulatedState,
        'analytics_storage': regulatedState,
        'ad_user_data': regulatedState,
        'ad_personalization': regulatedState,
        'region': ${JSON.stringify(regulatedMarketingCountryCodes)}
      });
      window.gtag('set', 'ads_data_redaction', true);
      window.gtag('js', new Date());
      window.gtag('config', ${JSON.stringify(googleAdsId)});
      document.documentElement.setAttribute('data-google-ads-ready', 'true');
    })();
  `
}
