import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getRequiredEnv, getSupabasePublicKey } from "@/lib/config"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getSupabasePublicKey() ??
      (() => {
        throw new Error("Missing Supabase publishable key.")
      })(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Components cannot set cookies. Server Actions and Route
            // Handlers can, so auth mutations still work.
          }
        },
      },
    }
  )
}
