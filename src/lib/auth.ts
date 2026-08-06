import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type CurrentUser = {
  id: string
  email: string | null
}

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) return null

  return {
    id: data.claims.sub,
    email:
      typeof data.claims.email === "string" ? data.claims.email : null,
  } satisfies CurrentUser
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("profiles")
    .select(
      "id,email,full_name,role,status,company_name,country_code,region,city,timezone,stripe_customer_id,free_sample_used_at,last_seen_at"
    )
    .eq("id", user.id)
    .maybeSingle()

  return data
})

export const getActiveUser = cache(async () => {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ])
  return user && profile?.status === "active" ? user : null
})

export async function requireUser(next = "/dashboard") {
  const user = await getActiveUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  return user
}

export async function requireAdmin() {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect("/login?next=/admin")
  }

  if (profile.role !== "admin" || profile.status !== "active") {
    redirect("/dashboard?error=Admin%20access%20is%20required.")
  }

  return profile
}
