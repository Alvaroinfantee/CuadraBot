export const defaultCurrency = process.env.DEFAULT_CURRENCY ?? "usd"
export const customerUploadBucket =
  process.env.CUSTOMER_UPLOAD_BUCKET ?? "customer-uploads"
export const blenderOutputBucket =
  process.env.BLENDER_OUTPUT_BUCKET ?? "render-outputs"
export const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? "100")
export const maxUploadBytes = maxUploadMb * 1024 * 1024
export const ownerRequestEmail =
  process.env.OWNER_REQUEST_EMAIL ?? process.env.ADMIN_EMAIL ?? "ainfante@cuadrabot.com"
export const jobReminderEmail =
  process.env.JOB_REMINDER_EMAIL ?? "alvaroinfantee@gmail.com"

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "http://localhost:3000"
  ).replace(/\/$/, "")
}

export function getRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function hasSupabaseServerEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export function getOptionalEnv(name: string) {
  return process.env[name] || null
}
