import "server-only"

import { createClient } from "@supabase/supabase-js"
import {
  getRequiredEnv,
  getSupabaseSecretKey,
} from "@/lib/config"

export function createSupabaseAdminClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getSupabaseSecretKey() ??
      (() => {
        throw new Error("Missing Supabase secret key.")
      })(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
