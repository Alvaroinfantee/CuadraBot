import { NextRequest, NextResponse } from "next/server"
import {
  browserDimensions,
  isUuid,
  marketingEventSchema,
  requestIsSameOrigin,
} from "@/lib/marketing-event"
import {
  marketingAnonymousCookieName,
  marketingSessionCookieName,
} from "@/lib/marketing-analytics"
import {
  consumeMarketingRateLimit,
  RateLimitConfigurationError,
} from "@/lib/request-rate-limit"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  marketingCollectionIsPermitted,
  resolveRequestPrivacyRegion,
} from "@/lib/privacy-region-server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!requestIsSameOrigin(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403)
  }
  const privacyRegion = await resolveRequestPrivacyRegion(request)
  if (!marketingCollectionIsPermitted(request, privacyRegion)) {
    return emptyResponse(204)
  }

  const anonymousId = request.cookies.get(marketingAnonymousCookieName)?.value
  const sessionId = request.cookies.get(marketingSessionCookieName)?.value
  if (!isUuid(anonymousId) || !isUuid(sessionId)) {
    return jsonResponse({ error: "Missing analytics identifiers." }, 400)
  }

  const body = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.marketingEventJson
  )
  if (!body.ok) {
    return jsonResponse(
      { error: body.reason === "too_large" ? "Request too large." : "Invalid request." },
      body.reason === "too_large" ? 413 : 400
    )
  }
  const parsed = marketingEventSchema.safeParse(body.value)
  if (!parsed.success) {
    return jsonResponse({ error: "Invalid marketing event." }, 400)
  }

  const admin = createSupabaseAdminClient()
  try {
    const rateLimit = await consumeMarketingRateLimit({
      supabase: admin,
      request,
      anonymousId: anonymousId!,
    })
    if (!rateLimit.allowed) {
      return new NextResponse(null, {
        status: 429,
        headers: responseHeaders({
          "retry-after": String(rateLimit.retryAfterSeconds),
        }),
      })
    }
  } catch (error) {
    if (error instanceof RateLimitConfigurationError) {
      return jsonResponse({ error: "Analytics temporarily unavailable." }, 503)
    }
    throw error
  }

  const serverClient = await createSupabaseServerClient()
  const { data: authData } = await serverClient.auth.getUser()
  const userId = authData.user?.id ?? null
  let location: {
    country_code: string | null
    region: string | null
    city: string | null
  } = {
    country_code: privacyRegion.countryCode,
    region: null,
    city: null,
  }

  if (userId) {
    const { data } = await admin
      .from("profiles")
      .select("country_code,region,city")
      .eq("id", userId)
      .maybeSingle()
    if (data) {
      location = {
        country_code: data.country_code ?? privacyRegion.countryCode,
        region: data.region,
        city: data.city,
      }
    }
  }

  const dimensions = browserDimensions(request.headers.get("user-agent"))
  const event = parsed.data
  const { error } = await admin.from("marketing_events").insert({
    anonymous_id: anonymousId,
    session_id: sessionId,
    user_id: userId,
    event_name: event.eventName,
    page_path: event.pagePath,
    landing_path: event.landingPath,
    referrer_host: event.referrerHost,
    source: event.source,
    medium: event.medium,
    campaign: event.campaign,
    term: event.term,
    content: event.content,
    first_source: event.firstSource,
    first_medium: event.firstMedium,
    first_campaign: event.firstCampaign,
    click_id_type: event.clickIdType,
    country_code: location.country_code,
    region: location.region,
    city: location.city,
    device_type: dimensions.deviceType,
    browser_name: dimensions.browserName,
    os_name: dimensions.osName,
    language: event.language,
    timezone: event.timezone,
    screen_bucket: event.screenBucket,
    consent_version: event.consentVersion,
  })
  if (error) return jsonResponse({ error: "Could not save analytics event." }, 503)

  return emptyResponse(204)
}

export async function DELETE(request: NextRequest) {
  if (!requestIsSameOrigin(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403)
  }

  const anonymousId = request.cookies.get(marketingAnonymousCookieName)?.value
  if (!isUuid(anonymousId)) return emptyResponse(204)

  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from("marketing_events")
    .delete()
    .eq("anonymous_id", anonymousId!)
  if (error) return jsonResponse({ error: "Could not delete analytics data." }, 503)
  return emptyResponse(204)
}

function emptyResponse(status: number) {
  return new NextResponse(null, { status, headers: responseHeaders() })
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: responseHeaders() })
}

function responseHeaders(extra: Record<string, string> = {}) {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extra,
  }
}
