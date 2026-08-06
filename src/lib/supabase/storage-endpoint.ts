const hostedProjectHostname = /^([a-z0-9-]+)\.supabase\.co$/i

export function getSupabaseResumableUploadEndpoint(projectUrl: string) {
  const parsed = new URL(projectUrl)
  const match = parsed.hostname.match(hostedProjectHostname)

  if (parsed.protocol !== "https:" || !match?.[1]) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a hosted HTTPS Supabase project URL."
    )
  }

  return `https://${match[1].toLowerCase()}.storage.supabase.co/storage/v1/upload/resumable`
}
