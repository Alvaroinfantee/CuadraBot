import Link from "next/link"
import { AdminHeader } from "@/components/admin/admin-ui"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const metadata = { title: "Drywall orders" }
export const dynamic = "force-dynamic"

export default async function DrywallOrdersPage() {
  const supabase = createSupabaseAdminClient()
  const { data: projects, error } = await supabase
    .from("drywall_takeoff_projects")
    .select("id,customer_id,project_name,location,status,selected_sheet_count,due_at,created_at,drywall_takeoff_customers(email,company),drywall_takeoff_orders(order_number,payment_status,amount_total_cents,currency)")
    .order("created_at", { ascending: false })
    .limit(250)
  if (error) throw new Error(error.message)
  const rows = (projects ?? []).map((project) => ({
    ...project,
    customer: project.drywall_takeoff_customers?.[0] ?? null,
    order: project.drywall_takeoff_orders?.[0] ?? null,
  }))
  const paid = rows.filter((project) => project.order?.payment_status === "paid")
  const openOrders = paid.filter((project) => !["delivered", "revised", "completed", "refunded", "cancelled"].includes(project.status))

  return <div className="space-y-8"><AdminHeader eyebrow="Fixed-price operations" title="Drywall orders" body="Paid Spanish drywall takeoffs, private source plans, manual QA and customer delivery." />
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Paid orders" value={String(paid.length)} /><Metric label="Open deliveries" value={String(openOrders.length)} /><Metric label="Revenue captured" value={`${(paid.reduce((sum, project) => sum + (project.order?.amount_total_cents ?? 0), 0) / 100).toFixed(2)} €`} /></div>
    <div className="overflow-x-auto border bg-white"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Order / project</th><th className="p-4">Customer</th><th className="p-4">Status</th><th className="p-4">Sheets</th><th className="p-4">Due</th><th className="p-4">Payment</th></tr></thead><tbody>{rows.map((project) => <tr key={project.id} className="border-b"><td className="p-4"><Link href={`/admin/drywall/${project.id}`} className="font-semibold hover:text-primary">{project.project_name}</Link><span className="mt-1 block text-xs text-slate-500">{project.order?.order_number ?? "No order"} · {project.location}</span></td><td className="p-4">{project.customer?.company || project.customer?.email}</td><td className="p-4"><Status value={project.status} /></td><td className="p-4">{project.selected_sheet_count}</td><td className="p-4 text-xs">{project.due_at ? formatDate(project.due_at) : "—"}</td><td className="p-4">{project.order?.payment_status ?? "—"}</td></tr>)}</tbody></table></div>
  </div>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div> }
function Status({ value }: { value: string }) { return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{value.replaceAll("_", " ")}</span> }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value)) }
