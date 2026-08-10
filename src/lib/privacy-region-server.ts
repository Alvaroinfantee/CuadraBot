import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"
import { lookupCountryCode } from "@/lib/country-geolocation"
import {
  countryMarketingPrivacyRegion,
  legacyGoogleConsentCookieName,
  marketingConsentCookieName,
  marketingPrivacyRegionCookieName,
  type MarketingPrivacyRegion,
} from "@/lib/marketing-analytics"
import { getRequestIp } from "@/lib/request-rate-limit"

type PrivacyRegionResolution = {
  region: MarketingPrivacyRegion
  countryCode: string | null
  source: "cache" | "country_is" | "development" | "unknown"
}

export async function resolveRequestPrivacyRegion(
  request: NextRequest
): Promise<PrivacyRegionResolution> {
  const cached = parseSignedRegionCookie(
    request.cookies.get(marketingPrivacyRegionCookieName)?.value
  )
  if (cached) return { ...cached, source: "cache" }

  const developmentCountry =
    process.env.NODE_ENV === "production"
      ? null
      : normalizedCountry(process.env.MARKETING_DEVELOPMENT_COUNTRY)
  if (developmentCountry) {
    return {
      countryCode: developmentCountry,
      region: countryMarketingPrivacyRegion(developmentCountry),
      source: "development",
    }
  }

  const ip = getRequestIp(request)
  if (ip === "unknown") return unknownResolution()

  const countryCode = await lookupCountryCode(ip)
  if (!countryCode) return unknownResolution()
  return {
    countryCode,
    region: countryMarketingPrivacyRegion(countryCode),
    source: "country_is",
  }
}

export function signedPrivacyRegionCookie(
  resolution: PrivacyRegionResolution
) {
  if (!resolution.countryCode || resolution.region === "unknown") return null
  const secret = process.env.RATE_LIMIT_SECRET
  if (!secret || secret.length < 32) return null
  const payload = `${resolution.region}.${resolution.countryCode}`
  return `${payload}.${signature(payload, secret)}`
}

export function marketingCollectionIsPermitted(
  request: NextRequest,
  resolution: PrivacyRegionResolution
) {
  if (request.headers.get("sec-gpc") === "1") return false
  const choice = request.cookies.get(marketingConsentCookieName)?.value
  if (choice === "denied") return false
  if (choice === "granted") return true
  if (
    request.cookies.get(legacyGoogleConsentCookieName)?.value === "denied"
  ) {
    return false
  }
  return resolution.region === "standard"
}

function parseSignedRegionCookie(value: string | undefined) {
  if (!value) return null
  const secret = process.env.RATE_LIMIT_SECRET
  if (!secret || secret.length < 32) return null
  const [region, countryCode, suppliedSignature, ...extra] = value.split(".")
  if (
    extra.length ||
    (region !== "regulated" && region !== "standard") ||
    !normalizedCountry(countryCode) ||
    !suppliedSignature
  ) {
    return null
  }

  const payload = `${region}.${countryCode}`
  const expected = signature(payload, secret)
  const suppliedBytes = Buffer.from(suppliedSignature)
  const expectedBytes = Buffer.from(expected)
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return null
  }

  return {
    region: region as Exclude<MarketingPrivacyRegion, "unknown">,
    countryCode: countryCode.toUpperCase(),
  }
}

function normalizedCountry(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase()
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

function unknownResolution(): PrivacyRegionResolution {
  return { region: "unknown", countryCode: null, source: "unknown" }
}
