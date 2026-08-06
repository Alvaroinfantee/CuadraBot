"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !publicKey) {
    throw new Error("Missing public Supabase environment variables.")
  }

  return createBrowserClient(url, publicKey)
}
