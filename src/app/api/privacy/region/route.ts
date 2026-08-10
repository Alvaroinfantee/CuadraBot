import { NextRequest, NextResponse } from "next/server"
import { marketingPrivacyRegionCookieName } from "@/lib/marketing-analytics"
import { requestIsSameOrigin } from "@/lib/marketing-event"
import {
  resolveRequestPrivacyRegion,
  signedPrivacyRegionCookie,
} from "@/lib/privacy-region-server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json(
      { region: "unknown" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const resolution = await resolveRequestPrivacyRegion(request)
  const response = NextResponse.json(
    { region: resolution.region },
    { headers: { "cache-control": "private, no-store" } }
  )
  const cookieValue = signedPrivacyRegionCookie(resolution)
  if (cookieValue) {
    response.cookies.set(marketingPrivacyRegionCookieName, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    })
  }
  return response
}
