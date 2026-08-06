export const defaultCurrency = process.env.DEFAULT_CURRENCY ?? "usd"
export const takeoffUploadBucket =
  process.env.TAKEOFF_UPLOAD_BUCKET ?? "takeoff-uploads"
export const takeoffResultBucket =
  process.env.TAKEOFF_RESULT_BUCKET ?? "takeoff-results"
const launchUploadCeilingMb = 25
const configuredUploadMb = Number(
  process.env.MAX_UPLOAD_MB ?? launchUploadCeilingMb
)
export const maxUploadMb =
  Number.isSafeInteger(configuredUploadMb) && configuredUploadMb > 0
    ? Math.min(configuredUploadMb, launchUploadCeilingMb)
    : launchUploadCeilingMb
export const maxUploadBytes = maxUploadMb * 1024 * 1024
export const maxPlanPages = Number(process.env.MAX_PLAN_PAGES ?? "250")
export const ownerRequestEmail =
  process.env.OWNER_REQUEST_EMAIL ?? process.env.ADMIN_EMAIL ?? "ainfante@cuadrabot.com"
export const simulationEmailToken = process.env.SIMULATION_EMAIL_TOKEN ?? null
export const demoModeEnabled = process.env.ENABLE_DEMO_MODE === "true"
export const stripeAutomaticTaxEnabled =
  process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true"

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

export function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null
  )
}

export function getSupabaseSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null
  )
}

export function hasSupabaseServerEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      getSupabasePublicKey() &&
      getSupabaseSecretKey()
  )
}

export function getOptionalEnv(name: string) {
  return process.env[name] || null
}
