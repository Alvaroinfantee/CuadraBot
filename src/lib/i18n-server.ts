import "server-only"

import { cookies } from "next/headers"
import {
  isLocale,
  localeCookieName,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n"

export async function getRequestLocale(explicitLocale?: unknown) {
  if (isLocale(explicitLocale)) return explicitLocale
  const cookieStore = await cookies()
  return normalizeLocale(cookieStore.get(localeCookieName)?.value)
}

export async function persistRequestLocale(locale: Locale) {
  const cookieStore = await cookies()
  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    priority: "medium",
  })
}
