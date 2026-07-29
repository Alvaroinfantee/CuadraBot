import { NextResponse } from "next/server"
import { getSiteUrl } from "@/lib/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(getSiteUrl(), { status: 303 })
}
