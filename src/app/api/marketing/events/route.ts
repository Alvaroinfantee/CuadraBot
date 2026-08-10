import { NextResponse } from "next/server"
import { jsonError } from "@/lib/http"
import {
  classifyUserAgent,
  coarseRequestGeo,
  parseMarketingEventInput,
  readCookie,
} from "@/lib/marketing-event"
import {
  marketingConsentCookieName,
  marketingConsentVersion,
} from "@/lib/marketing-consent"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"
import { consumeMarketingEventRateLimit } from "@/lib/request-rate-limit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) {
    return jsonError("Cross-site marketing events are not accepted.", 403)
  }

  const consent = readCookie(
    request.headers.get("cookie"),
    marketingConsentCookieName
  )
  if (consent !== "granted") {
    return new NextResponse(null, { status: 204 })
  }

  const body = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.marketingEventJson
  )
  if (!body.ok) {
    return jsonError(
      body.reason === "too_large"
        ? "Marketing event payload is too large."
        : "Marketing event payload is invalid.",
      body.reason === "too_large" ? 413 : 400
    )
  }

  const event = parseMarketingEventInput(body.value)
  if (!event) return jsonError("Marketing event payload is invalid.", 422)

  const supabase = createSupabaseAdminClient()
  const rateLimit = await consumeMarketingEventRateLimit({
    supabase,
    request,
    anonymousId: event.anonymousId,
  }).catch(() => null)
  if (!rateLimit) {
    return jsonError("Marketing event collection is temporarily unavailable.", 503)
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many marketing events." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    )
  }

  const authClient = await createSupabaseServerClient()
  const { data: claimsData } = await authClient.auth.getClaims()
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null
  const demographic = userId
    ? await readConsentedDemographic(supabase, userId)
    : null
  const geo = coarseRequestGeo(request.headers)
  const device = classifyUserAgent(request.headers.get("user-agent"))
  const now = new Date().toISOString()

  const { error } = await supabase.from("marketing_events").insert({
    user_id: userId,
    anonymous_id: event.anonymousId,
    session_id: event.sessionId,
    event_name: event.eventName,
    consent_version: marketingConsentVersion,
    consented_at: now,
    country_code: geo.countryCode,
    region: geo.region,
    device_type: device.deviceType,
    browser_family: device.browserFamily,
    os_family: device.osFamily,
    age_band: demographic,
    source: event.source,
    medium: event.medium,
    campaign: event.campaign,
    term: event.term,
    content: event.content,
    click_id_kind: event.clickIdKind,
    click_id: event.clickId,
    landing_path: event.landingPath,
    referrer_host: event.referrerHost,
    tags: event.tags,
    metadata: event.metadata,
    occurred_at: now,
  })
  if (error) {
    return jsonError("Marketing event could not be recorded.", 500)
  }

  return new NextResponse(null, { status: 202 })
}

async function readConsentedDemographic(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const { data } = await supabase
    .from("profiles")
    .select("age_band,demographic_consent_at")
    .eq("id", userId)
    .maybeSingle()
  return data?.demographic_consent_at ? data.age_band : null
}

function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}
