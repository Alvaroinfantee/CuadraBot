import { NextResponse } from "next/server"
import { hasSupabaseServerEnv } from "@/lib/config"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  const startedAt = Date.now()
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "cuadrabot-web",
        checks: { environment: "missing_supabase" },
      },
      { status: 503 }
    )
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("app_settings")
    .select("key", { head: true, count: "exact" })
    .limit(1)

  return NextResponse.json(
    {
      status: error ? "degraded" : "healthy",
      service: "cuadrabot-web",
      response_ms: Date.now() - startedAt,
      checks: {
        database: error ? "unavailable" : "healthy",
      },
    },
    {
      status: error ? 503 : 200,
      headers: { "cache-control": "no-store" },
    }
  )
}
