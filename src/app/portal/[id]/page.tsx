import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2Icon, Clock3Icon, DownloadIcon, ShieldCheckIcon } from "lucide-react"
import { GoogleAdsPurchaseConversion } from "@/components/site/google-ads-conversion"
import { RevisionForm } from "@/components/takeoff/revision-form"
import { PortalDraftCleanup } from "@/components/takeoff/portal-draft-cleanup"
import { verifyDrywallConversion } from "@/lib/drywall-conversion"
import { createDrywallPortalToken, verifyDrywallPortalToken } from "@/lib/drywall-portal"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const metadata = { title: "Portal del pedido", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function DrywallPortalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ session_id?: string | string[]; token?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const sessionId = single(query.session_id)
  const suppliedToken = single(query.token)
  let conversion = null
  if (sessionId) {
    try { conversion = await verifyDrywallConversion(id, sessionId) } catch (error) { console.error("Could not verify drywall Checkout return.", error) }
  }
  const tokenAccess = suppliedToken ? verifyDrywallPortalToken(id, suppliedToken) : false
  if (!conversion && !tokenAccess) notFound()

  const supabase = createSupabaseAdminClient()
  const [{ data: project }, { data: order }, { data: files }, { data: deliverables }, { data: revisions }] = await Promise.all([
    supabase.from("drywall_takeoff_projects").select("id,customer_id,project_name,location,status,selected_sheet_count,due_at,delivered_at,created_at").eq("id", id).maybeSingle(),
    supabase.from("drywall_takeoff_orders").select("order_number,payment_status,amount_total_cents,currency,paid_at").eq("project_id", id).maybeSingle(),
    supabase.from("drywall_takeoff_files").select("id,original_filename,page_count").eq("project_id", id).order("created_at"),
    supabase.from("drywall_takeoff_deliverables").select("id,version,file_type,original_filename,size_bytes,delivered_at").eq("project_id", id).not("delivered_at", "is", null).order("version", { ascending: false }),
    supabase.from("drywall_takeoff_revision_requests").select("id,status,category,drawing_page,created_at").eq("project_id", id).order("created_at", { ascending: false }),
  ])
  if (!project || (!conversion && order?.payment_status !== "paid")) notFound()
  const portalToken = suppliedToken && tokenAccess ? suppliedToken : createDrywallPortalToken(id)
  const delivered = (deliverables?.length ?? 0) > 0
  const openRevision = revisions?.some((revision) => revision.status === "open")

  return <main className="min-h-screen bg-[#f5f7f4] px-4 py-10 text-slate-950 sm:px-6"><PortalDraftCleanup projectId={id} /><div className="mx-auto max-w-5xl"><header className="flex flex-wrap items-center justify-between gap-4"><Link href="/" className="font-semibold text-[#153a31]">Cuadrabot</Link><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"><ShieldCheckIcon className="mr-1 inline size-3.5" /> Portal privado</span></header>
    <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-4"><CheckCircle2Icon className="mt-1 size-7 shrink-0 text-emerald-600" /><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">{conversion ? "Pago confirmado" : "Pedido seguro"}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{project.project_name}</h1><p className="mt-2 text-sm text-slate-600">{order?.order_number || conversion?.orderNumber} · {project.location}</p></div></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-4"><Metric label="Estado" value={statusLabel(project.status)} /><Metric label="Hojas" value={String(project.selected_sheet_count)} /><Metric label="Entrega" value={project.due_at ? formatDate(project.due_at) : "2 días laborables"} /><Metric label="Total" value={order ? `${(order.amount_total_cents / 100).toFixed(2)} ${order.currency.toUpperCase()}` : "Confirmado"} /></div>
    </section>
    <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Entregables</h2>{delivered ? <div className="mt-5 space-y-3">{deliverables?.map((file) => <a key={file.id} href={`/api/drywall/orders/${id}/deliverables/${file.id}?token=${encodeURIComponent(portalToken)}`} className="flex items-center justify-between rounded-xl border p-4 hover:border-[#17816b]"><span><strong className="block text-sm">{file.file_type === "marked_pdf" ? "PDF marcado" : "Excel de mediciones"}</strong><span className="mt-1 block text-xs text-slate-500">v{file.version} · {file.original_filename}</span></span><DownloadIcon className="size-5 text-[#17816b]" /></a>)}</div> : <div className="mt-5 rounded-xl bg-[#edf4f1] p-5"><Clock3Icon className="size-5 text-[#17816b]" /><p className="mt-3 font-semibold">Estamos preparando tu medición.</p><p className="mt-1 text-sm leading-6 text-slate-600">Publicaremos aquí el Excel y el PDF marcado después del control de calidad manual.</p></div>}</div>
      <div className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Planos incluidos</h2><ul className="mt-4 space-y-3 text-sm">{files?.map((file) => <li key={file.id} className="flex justify-between border-b pb-3"><span className="truncate pr-4">{file.original_filename}</span><span className="shrink-0 text-slate-500">{file.page_count} págs.</span></li>)}</ul><p className="mt-4 text-xs leading-5 text-slate-500">Conservación estándar: 90 días tras la entrega, salvo obligación legal o incidencia abierta.</p></div></section>
    {delivered ? <section className="mt-6 rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Corrección incluida</h2>{openRevision ? <p className="mt-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Ya hay una corrección abierta. No necesitas enviarla de nuevo.</p> : <><p className="mt-2 text-sm leading-6 text-slate-600">Indica una discrepancia concreta de la misma revisión de planos. Las revisiones nuevas del proyecto quedan fuera de este alcance.</p><RevisionForm projectId={id} token={portalToken} /></>}</section> : null}
    <footer className="py-8 text-center text-xs text-slate-500">¿Necesitas ayuda? Responde al email del pedido o escribe a pedidos@cuadrabot.com.</footer></div>
    {conversion ? <GoogleAdsPurchaseConversion currency={conversion.currency} transactionId={conversion.transactionId} valueCents={conversion.valueCents} /> : null}</main>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div> }
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? null : value ?? null }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value)) }
function statusLabel(status: string) { return ({ order_received: "Recibido", initial_review: "Revisión inicial", takeoff_in_progress: "En medición", quality_review: "Control de calidad", delivered: "Entregado", revision_requested: "Corrección solicitada", revised: "Corregido", completed: "Completado", refunded: "Reembolsado" } as Record<string, string>)[status] ?? "Procesando" }
