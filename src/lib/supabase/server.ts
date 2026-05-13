import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getRequiredEnv } from "@/lib/config"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
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
