import { NextResponse, type NextRequest } from "next/server"
import { getSiteUrl } from "@/lib/config"
import { safeRelativePath } from "@/lib/safe-redirect"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  const next = safeRelativePath(
    request.nextUrl.searchParams.get("next"),
    "/"
  )
  return NextResponse.redirect(`${getSiteUrl()}${next}`, { status: 303 })
}
