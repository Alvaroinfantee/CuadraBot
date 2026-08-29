import { NextResponse, type NextRequest } from "next/server"
import { verifyDrywallPortalToken } from "@/lib/drywall-portal"
import { jsonError } from "@/lib/http"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string; deliverableId: string }> }
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: Context) {
  const { id, deliverableId } = await context.params
  const token = request.nextUrl.searchParams.get("token") ?? ""
  if (!verifyDrywallPortalToken(id, token)) return jsonError("El enlace ha caducado.", 401)
  const supabase = createSupabaseAdminClient()
  const { data: file, error } = await supabase
    .from("drywall_takeoff_deliverables")
    .select("id,project_id,bucket,storage_path,original_filename,delivered_at")
    .eq("id", deliverableId)
    .eq("project_id", id)
    .maybeSingle()
  if (error || !file?.delivered_at) return jsonError("Archivo no disponible.", 404)
  const { data: signed, error: signError } = await supabase.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, 5 * 60, { download: file.original_filename })
  if (signError || !signed?.signedUrl) return jsonError("No se pudo preparar la descarga.", 503)
  return NextResponse.redirect(signed.signedUrl, 303)
}
