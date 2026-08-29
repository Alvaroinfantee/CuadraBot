import { NextResponse } from "next/server"
import { verifyDrywallPortalToken } from "@/lib/drywall-portal"
import { drywallRevisionSchema } from "@/lib/drywall-takeoff-schemas"
import { jsonError } from "@/lib/http"
import { consumeTakeoffRateLimit } from "@/lib/request-rate-limit"
import { readRequestJsonWithLimit, requestBodyLimits } from "@/lib/request-body"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Context = { params: Promise<{ id: string }> }
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const body = await readRequestJsonWithLimit(request, requestBodyLimits.drywallRevisionJson)
  const parsed = drywallRevisionSchema.safeParse(body.ok ? body.value : null)
  if (!parsed.success || !verifyDrywallPortalToken(id, parsed.data?.token ?? "")) {
    return jsonError("El enlace del portal no es válido o ha caducado.", 401)
  }
  const supabase = createSupabaseAdminClient()
  try {
    const limit = await consumeTakeoffRateLimit({ supabase, request, userId: id, action: "revise_drywall_order" })
    if (!limit.allowed) return jsonError("Demasiados intentos. Inténtalo de nuevo más tarde.", 429)
  } catch {
    return jsonError("La protección del formulario no está disponible.", 503)
  }

  const [{ data: project }, { data: delivery }, { data: openRevision }] = await Promise.all([
    supabase.from("drywall_takeoff_projects").select("id,status").eq("id", id).maybeSingle(),
    supabase.from("drywall_takeoff_deliverables").select("version").eq("project_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("drywall_takeoff_revision_requests").select("id").eq("project_id", id).eq("status", "open").maybeSingle(),
  ])
  if (!project || !delivery || !["delivered", "revised", "completed"].includes(project.status)) return jsonError("El pedido aún no admite correcciones.", 409)
  if (openRevision) return jsonError("Ya existe una corrección abierta para este pedido.", 409)

  const { error } = await supabase.from("drywall_takeoff_revision_requests").insert({
    project_id: id,
    delivery_version: delivery.version,
    category: parsed.data.category,
    drawing_page: parsed.data.drawingPage,
    area: parsed.data.area,
    measurement_id: parsed.data.measurementId,
    description: parsed.data.description,
  })
  if (error) return jsonError("No se pudo registrar la corrección.", error.code === "23505" ? 409 : 503)
  await Promise.all([
    supabase.from("drywall_takeoff_projects").update({ status: "revision_requested" }).eq("id", id),
    supabase.from("drywall_takeoff_events").insert({ project_id: id, event_name: "revision_requested", actor: "customer", metadata: { delivery_version: delivery.version } }),
  ])
  return NextResponse.json({ received: true })
}
