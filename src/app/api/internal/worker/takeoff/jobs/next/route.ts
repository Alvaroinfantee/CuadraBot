import { NextResponse } from "next/server"
import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireWorker } from "@/lib/worker-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const worker = requireWorker(request)
  if (!worker) return jsonError("Unauthorized worker request.", 401)

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("takeoff_jobs")
    .select(
      "id,user_id,project_name,trades,input_page_count,quoted_credits,free_sample,priority,queued_at,created_at"
    )
    .eq("status", "queued")
    .is("claimed_by", null)
    .lt("attempt_count", 3)
    .order("priority", { ascending: false })
    .order("queued_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ job: data ?? null })
}
