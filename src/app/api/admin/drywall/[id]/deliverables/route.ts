import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentProfile } from "@/lib/auth"
import { drywallResultBucket, getRequiredEnv, getSiteUrl } from "@/lib/config"
import { escapeEmailHtml, sendDrywallEmail } from "@/lib/drywall-email"
import { createDrywallPortalToken } from "@/lib/drywall-portal"
import { jsonError, sanitizeFilename } from "@/lib/http"
import { readRequestJsonWithLimit, requestBodyLimits } from "@/lib/request-body"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getSupabaseResumableUploadEndpoint } from "@/lib/supabase/storage-endpoint"

type Context = { params: Promise<{ id: string }> }
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const reviewer = z.string().trim().min(2).max(120)
const common = { reviewerName: reviewer, qaConfirmed: z.literal(true), assumptionsConfirmed: z.literal(true) }
const prepareSchema = z.object({
  action: z.literal("prepare"),
  ...common,
  files: z.array(z.object({
    fileType: z.enum(["marked_pdf", "quantity_workbook"]),
    filename: z.string().trim().min(1).max(220),
    mimeType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
    sizeBytes: z.number().int().min(5).max(100 * 1024 * 1024),
    checksum: z.string().regex(/^[a-f0-9]{64}$/i),
  })).length(2),
})
const finalizeSchema = z.object({
  action: z.literal("finalize"),
  ...common,
  deliverableIds: z.array(z.string().uuid()).length(2),
})

const qaChecks = Object.fromEntries([
  "scope", "drawing_revision", "scale_dimensions", "selected_pages",
  "wall_types", "units", "openings", "duplicates", "formulas",
  "cross_references", "totals", "marked_pdf", "quantity_workbook",
  "file_names", "legibility", "final_consistency",
].map((key) => [key, true]))

export async function POST(request: Request, context: Context) {
  const admin = await getCurrentProfile()
  if (!admin || admin.role !== "admin" || admin.status !== "active") return jsonError("Admin access is required.", 403)
  const { id } = await context.params
  const body = await readRequestJsonWithLimit(request, requestBodyLimits.drywallAdminDeliveryJson)
  if (!body.ok) return jsonError("Invalid delivery request.", body.reason === "too_large" ? 413 : 400)
  const supabase = createSupabaseAdminClient()
  const { data: project } = await supabase
    .from("drywall_takeoff_projects")
    .select("id,customer_id,project_name,status")
    .eq("id", id)
    .maybeSingle()
  const { data: order } = await supabase
    .from("drywall_takeoff_orders")
    .select("order_number,payment_status")
    .eq("project_id", id)
    .maybeSingle()
  if (!project || order?.payment_status !== "paid" || ["refunded", "cancelled"].includes(project.status)) return jsonError("This project is not eligible for delivery.", 409)

  if (body.value && typeof body.value === "object" && "action" in body.value && body.value.action === "prepare") {
    const parsed = prepareSchema.safeParse(body.value)
    if (!parsed.success) return jsonError("Complete the reviewer, QA checks and both valid deliverables.", 422)
    const types = new Set(parsed.data.files.map((file) => file.fileType))
    if (types.size !== 2 || !types.has("marked_pdf") || !types.has("quantity_workbook")) return jsonError("Provide one marked PDF and one quantity workbook.", 422)
    for (const file of parsed.data.files) {
      if (file.fileType === "marked_pdf" && file.mimeType !== "application/pdf") return jsonError("The marked plan must be a PDF.", 422)
      if (file.fileType === "quantity_workbook" && !file.filename.toLowerCase().endsWith(".xlsx")) return jsonError("The quantity workbook must be XLSX.", 422)
    }

    const { data: existing } = await supabase.from("drywall_takeoff_deliverables").select("id,version,bucket,storage_path,delivered_at").eq("project_id", id).order("version", { ascending: false })
    const latestVersion = existing?.[0]?.version ?? 0
    const pending = (existing ?? []).filter((file) => file.version === latestVersion && !file.delivered_at)
    if (pending.length) {
      await supabase.storage.from(drywallResultBucket).remove(pending.map((file) => file.storage_path))
      const { error: deleteError } = await supabase.from("drywall_takeoff_deliverables").delete().in("id", pending.map((file) => file.id))
      if (deleteError) return jsonError("Could not replace the incomplete delivery.", 503)
    }
    const version = pending.length ? latestVersion : latestVersion + 1
    const uploads = []
    const preparedIds: string[] = []
    try {
      for (const file of parsed.data.files) {
        const deliverableId = crypto.randomUUID()
        const filename = sanitizeFilename(file.filename) || (file.fileType === "marked_pdf" ? "plano-marcado.pdf" : "mediciones.xlsx")
        const storagePath = `${id}/v${version}/${deliverableId}-${filename}`
        const { error: insertError } = await supabase.from("drywall_takeoff_deliverables").insert({
          id: deliverableId,
          project_id: id,
          version,
          file_type: file.fileType,
          bucket: drywallResultBucket,
          storage_path: storagePath,
          original_filename: file.filename,
          mime_type: file.mimeType,
          size_bytes: file.sizeBytes,
          sha256: file.checksum.toLowerCase(),
        })
        if (insertError) throw new Error(insertError.message)
        preparedIds.push(deliverableId)
        const { data: signed, error: signError } = await supabase.storage.from(drywallResultBucket).createSignedUploadUrl(storagePath, { upsert: false })
        if (signError || !signed?.token) throw new Error(signError?.message ?? "Signed upload unavailable.")
        uploads.push({
          deliverableId,
          endpoint: getSupabaseResumableUploadEndpoint(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")),
          bucket: drywallResultBucket,
          path: storagePath,
          token: signed.token,
        })
      }
      return NextResponse.json({ version, uploads })
    } catch (error) {
      if (preparedIds.length) await supabase.from("drywall_takeoff_deliverables").delete().in("id", preparedIds)
      console.error("Could not prepare drywall delivery.", error)
      return jsonError("Could not prepare private delivery uploads.", 503)
    }
  }

  const parsed = finalizeSchema.safeParse(body.value)
  if (!parsed.success) return jsonError("Complete the reviewer and QA confirmations.", 422)
  if (new Set(parsed.data.deliverableIds).size !== 2) return jsonError("Select two different deliverables.", 422)
  const { data: deliverables, error: filesError } = await supabase
    .from("drywall_takeoff_deliverables")
    .select("*")
    .eq("project_id", id)
    .in("id", parsed.data.deliverableIds)
  if (filesError || deliverables?.length !== 2 || new Set(deliverables.map((file) => file.version)).size !== 1 || new Set(deliverables.map((file) => file.file_type)).size !== 2 || deliverables.some((file) => file.delivered_at)) return jsonError("Prepared deliverables do not match this project.", 409)

  for (const file of deliverables) {
    const { data: signed, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.storage_path, 5 * 60)
    if (error || !signed?.signedUrl) return jsonError(`Could not read ${file.original_filename}.`, 503)
    const response = await fetch(signed.signedUrl, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(2 * 60 * 1000) })
    if (!response.ok) return jsonError(`Upload missing: ${file.original_filename}.`, 422)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length !== file.size_bytes || createHash("sha256").update(bytes).digest("hex") !== file.sha256) return jsonError(`Server verification failed for ${file.original_filename}.`, 422)
    const signature = bytes.subarray(0, 4).toString("hex")
    if (file.file_type === "marked_pdf" && signature !== "25504446") return jsonError("The marked plan is not a valid PDF file.", 422)
    if (file.file_type === "quantity_workbook" && !signature.startsWith("504b03")) return jsonError("The workbook is not a valid XLSX container.", 422)
  }

  const deliveredAt = new Date().toISOString()
  const retentionDeleteAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const version = deliverables[0].version
  const nextStatus = version > 1 ? "revised" : "delivered"
  const { error: deliveryError } = await supabase.from("drywall_takeoff_deliverables").update({ delivered_at: deliveredAt }).in("id", parsed.data.deliverableIds).is("delivered_at", null)
  if (deliveryError) return jsonError("Could not publish the verified files.", 503)
  const { error: projectError } = await supabase.from("drywall_takeoff_projects").update({ status: nextStatus, delivered_at: deliveredAt, reviewer_name: parsed.data.reviewerName, qa_checks: qaChecks, assumptions_confirmed: true, retention_delete_at: retentionDeleteAt }).eq("id", id)
  if (projectError) return jsonError("Files were verified, but the project status needs repair.", 503)
  if (version > 1) await supabase.from("drywall_takeoff_revision_requests").update({ status: "resolved", resolved_at: deliveredAt }).eq("project_id", id).eq("status", "open")
  await supabase.from("drywall_takeoff_events").insert({ project_id: id, event_name: version > 1 ? "revision_delivered" : "delivery_published", actor: admin.email ?? admin.id, metadata: { version, reviewer_name: parsed.data.reviewerName, qa_checks: qaChecks } })

  const { data: customer } = await supabase.from("drywall_takeoff_customers").select("email").eq("id", project.customer_id).maybeSingle()
  let emailSent = false
  if (customer?.email) {
    const portalUrl = `${getSiteUrl()}/portal/${id}?token=${encodeURIComponent(createDrywallPortalToken(id))}`
    try {
      const result = await sendDrywallEmail({ to: customer.email, subject: `${version > 1 ? "Corrección" : "Medición"} lista · ${order.order_number}`, html: `<p>Los archivos revisados de <strong>${escapeEmailHtml(project.project_name)}</strong> ya están disponibles.</p><p><a href="${portalUrl}">Descargar desde el portal privado</a></p>` })
      emailSent = result.sent
    } catch (error) { console.error("Delivery email failed.", { projectId: id, error }) }
  }
  if (!emailSent) {
    const now = new Date().toISOString()
    const { error: alertError } = await supabase.from("admin_alerts").insert({
      severity: "warning",
      category: "system",
      title: "Drywall delivery email needs attention",
      message: "The files were published, but the customer delivery email was not sent.",
      status: "open",
      dedupe_key: `drywall:delivery-email:${id}:v${version}`,
      entity_type: "drywall_project",
      entity_id: id,
      metadata: { version, customer_email: customer?.email ?? null },
      first_seen_at: now,
      last_seen_at: now,
    })
    if (alertError && alertError.code !== "23505") console.error("Could not create delivery email alert.", alertError)
  }
  return NextResponse.json({ delivered: true, version, emailSent })
}
