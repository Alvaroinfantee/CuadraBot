import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminHeader } from "@/components/admin/admin-ui"
import { AdminDeliveryForm } from "@/components/takeoff/admin-delivery-form"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { transitionDrywallProject } from "../actions"

export const dynamic = "force-dynamic"

export default async function DrywallOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createSupabaseAdminClient()
  const { data: project } = await supabase
    .from("drywall_takeoff_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!project) notFound()
  const [{ data: order }, { data: customer }, { data: files }, { data: deliverables }, { data: revisions }, { data: events }] = await Promise.all([
    supabase.from("drywall_takeoff_orders").select("*").eq("project_id", id).maybeSingle(),
    supabase.from("drywall_takeoff_customers").select("*").eq("id", project.customer_id).maybeSingle(),
    supabase.from("drywall_takeoff_files").select("*").eq("project_id", id).order("created_at"),
    supabase.from("drywall_takeoff_deliverables").select("*").eq("project_id", id).order("version", { ascending: false }),
    supabase.from("drywall_takeoff_revision_requests").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("drywall_takeoff_events").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
  ])
  const actions = nextStatuses(project.status)
  return <div className="space-y-8"><AdminHeader eyebrow={order?.order_number ?? "Draft"} title={project.project_name} body={`${customer?.email ?? "Unknown customer"} · ${project.location} · ${project.selected_sheet_count} selected sheets`} action={<Link href="/admin/drywall" className="border bg-white px-4 py-2 text-sm">Back to orders</Link>} />
    <div className="grid gap-4 sm:grid-cols-4"><Metric label="Status" value={project.status.replaceAll("_", " ")} /><Metric label="Payment" value={order?.payment_status ?? "none"} /><Metric label="Total" value={order ? `${(order.amount_total_cents / 100).toFixed(2)} ${order.currency.toUpperCase()}` : "—"} /><Metric label="Due" value={project.due_at ? formatDate(project.due_at) : "Not scheduled"} /></div>
    {actions.length ? <section className="border bg-white p-5"><h2 className="font-semibold">Workflow</h2><div className="mt-4 flex flex-wrap gap-2">{actions.map((status) => <form key={status} action={transitionDrywallProject}><input type="hidden" name="projectId" value={id} /><input type="hidden" name="nextStatus" value={status} /><button className="border bg-slate-50 px-3 py-2 text-xs font-semibold">Move to {status.replaceAll("_", " ")}</button></form>)}</div></section> : null}
    <section className="grid gap-6 lg:grid-cols-2"><div className="border bg-white p-6"><h2 className="text-lg font-semibold">Verified source plans</h2><div className="mt-4 space-y-3">{files?.map((file) => <a key={file.id} href={`/api/admin/drywall/${id}/source/${file.id}`} className="flex justify-between border p-3 text-sm hover:border-primary"><span>{file.original_filename}</span><span className="text-slate-500">{file.page_count} pages · {file.upload_status}</span></a>)}</div><details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">Selected pages and scope</summary><pre className="mt-3 max-h-80 overflow-auto bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify({ selected_pages: project.selected_pages, scope_answers: project.scope_answers }, null, 2)}</pre></details></div>
      <div className="border bg-white p-6"><h2 className="text-lg font-semibold">Publish reviewed delivery</h2><p className="mt-2 text-sm text-slate-500">Files remain private. The server rechecks exact size, SHA-256 and file signature before publishing.</p>{order?.payment_status === "paid" ? <div className="mt-5"><AdminDeliveryForm projectId={id} /></div> : <p className="mt-5 bg-amber-50 p-4 text-sm">Delivery is blocked until Stripe payment is confirmed.</p>}</div></section>
    <section className="grid gap-6 lg:grid-cols-2"><div className="border bg-white p-6"><h2 className="text-lg font-semibold">Deliveries</h2><ul className="mt-4 space-y-3 text-sm">{deliverables?.map((file) => <li key={file.id} className="border-b pb-3">v{file.version} · {file.file_type} · {file.delivered_at ? `published ${formatDate(file.delivered_at)}` : "upload pending"}</li>)}</ul></div><div className="border bg-white p-6"><h2 className="text-lg font-semibold">Correction requests</h2><ul className="mt-4 space-y-4 text-sm">{revisions?.map((revision) => <li key={revision.id} className="border-b pb-3"><strong>{revision.status} · {revision.category}</strong><p className="mt-1 text-slate-600">{revision.drawing_page} · {revision.area} · {revision.measurement_id}</p><p className="mt-1">{revision.description}</p></li>)}</ul></div></section>
    <section className="border bg-white p-6"><h2 className="text-lg font-semibold">Event trail</h2><ul className="mt-4 space-y-2 font-mono text-xs">{events?.map((event) => <li key={event.id} className="grid gap-2 border-b py-2 sm:grid-cols-[180px_220px_1fr]"><span>{formatDate(event.created_at)}</span><strong>{event.event_name}</strong><span>{event.actor}</span></li>)}</ul></section>
  </div>
}

function nextStatuses(status: string) { return ({ order_received: ["initial_review"], initial_review: ["takeoff_in_progress"], takeoff_in_progress: ["quality_review"], quality_review: ["takeoff_in_progress"], delivered: ["completed"], revised: ["completed"], revision_requested: ["takeoff_in_progress"] } as Record<string, string[]>)[status] ?? [] }
function Metric({ label, value }: { label: string; value: string }) { return <div className="border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div> }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value)) }
