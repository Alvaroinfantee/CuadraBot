import { NextResponse } from "next/server"
import { isLocale, localeCookieName } from "@/lib/i18n"
import { jsonError } from "@/lib/http"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"

export async function POST(request: Request) {
  const bodyResult = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.localeJson
  )
  if (!bodyResult.ok && bodyResult.reason === "too_large") {
    return jsonError("Locale request payload is too large.", 413)
  }
  const body = bodyResult.ok ? bodyResult.value : null
  const locale =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).locale
      : null

  if (!isLocale(locale)) {
    return jsonError("Choose a supported language.", 422)
  }

  const response = NextResponse.json({ locale })
  response.cookies.set(localeCookieName, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    priority: "medium",
  })
  return response
}
