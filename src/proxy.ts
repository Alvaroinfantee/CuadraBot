import type { NextRequest } from "next/server"
import {
  localeCookieName,
  localeForRequestPath,
} from "@/lib/i18n"
import { refreshSupabaseSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  const requestedLocale = request.nextUrl.searchParams.get("lang")
  const locale = localeForRequestPath(
    request.nextUrl.pathname,
    request.cookies.get(localeCookieName)?.value,
    requestedLocale
  )

  return refreshSupabaseSession(request, {
    "x-cuadrabot-locale": locale,
  })
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
