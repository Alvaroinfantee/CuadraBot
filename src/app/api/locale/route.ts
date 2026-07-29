import { NextResponse } from "next/server"
import { isLocale, localeCookieName } from "@/lib/i18n"
import { jsonError } from "@/lib/http"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
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
