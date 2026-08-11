import { NextResponse, type NextRequest } from "next/server"
import { getSiteUrl } from "@/lib/config"
import type { AuthNoticeCode } from "@/lib/auth-notices"
import {
  isLocale,
  localeCookieName,
  localizedAuthPath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n"
import { safeRelativePath } from "@/lib/safe-redirect"
import { marketingAccountCreatedCookieName } from "@/lib/marketing-consent"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function localeRedirect(
  path: string,
  locale: Locale,
  accountCreated = false
) {
  const response = NextResponse.redirect(new URL(path, getSiteUrl()))
  response.cookies.set(localeCookieName, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    priority: "medium",
  })
  if (accountCreated) {
    response.cookies.set(marketingAccountCreatedCookieName, "1", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60,
    })
  }
  return response
}

function loginErrorPath(locale: Locale, code: AuthNoticeCode) {
  const path = localizedAuthPath("/login", locale)
  const target = new URL(path, "https://cuadrabot.invalid")
  target.searchParams.set("error", code)
  return `${target.pathname}${target.search}`
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const next = safeRelativePath(request.nextUrl.searchParams.get("next"))
  const accountCreated = request.nextUrl.searchParams.get("created") === "1"
  const explicitLocale = request.nextUrl.searchParams.get("lang")
  const locale = isLocale(explicitLocale)
    ? explicitLocale
    : normalizeLocale(request.cookies.get(localeCookieName)?.value)

  if (!code) {
    return localeRedirect(
      loginErrorPath(locale, "confirmation_invalid"),
      locale
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return localeRedirect(
      loginErrorPath(locale, "confirmation_invalid"),
      locale
    )
  }

  return localeRedirect(next, locale, accountCreated)
}
