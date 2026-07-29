import { NextResponse, type NextRequest } from "next/server"
import { getSiteUrl } from "@/lib/config"
import { safeRelativePath } from "@/lib/safe-redirect"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const next = safeRelativePath(request.nextUrl.searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(
      `${getSiteUrl()}/login?error=${encodeURIComponent("The confirmation link is invalid.")}`
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${getSiteUrl()}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${getSiteUrl()}${next}`)
}
