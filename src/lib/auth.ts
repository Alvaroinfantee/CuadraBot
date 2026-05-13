import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .maybeSingle()

  return data
})

export async function requireAdmin() {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect("/admin/login")
  }

  if (profile.role !== "admin") {
    redirect("/admin/login?forbidden=1")
  }

  return profile
}
