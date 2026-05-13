import Link from "next/link"
import { DownloadIcon, SendIcon, UploadIcon } from "lucide-react"
import { notFound } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"
import { StatusBadge } from "@/components/site/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  sendCompletionEmailAction,
  updateOrderAdminAction,
  uploadAdminFinalFilesAction,
} from "@/lib/admin-actions"
import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formatMoney } from "@/lib/format"
import { orderStatuses, type OrderFile } from "@/lib/types"

export const metadata = {
  title: "Admin order",
}

export const dynamic = "force-dynamic"

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const supabase = createSupabaseAdminClient()
  const { data: order } = await supabase
    .from("orders")
    .select("*, packages(*)")
    .eq("id", id)
    .maybeSingle()

  if (!order) {
    notFound()
  }

  const [{ data: files }, { data: payments }, { data: runs }, { data: emails }] =
    await Promise.all([
      supabase.from("order_files").select("*").eq("order_id", id).order("created_at", { ascending: true }),
      supabase.from("payments").select("*").eq("order_id", id).order("created_at", { ascending: false }),
      supabase.from("worker_runs").select("*").eq("order_id", id).order("created_at", { ascending: false }),
      supabase.from("email_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    ])

  const signedFiles = await Promise.all(
    ((files ?? []) as OrderFile[]).map(async (file) => {
      const { data } = await supabase.storage
        .from(file.bucket)
        .createSignedUrl(file.storage_path, 15 * 60)

      return { ...file, signedUrl: data?.signedUrl ?? "#" }
    })
  )

  const packagePlan = Array.isArray(order.packages) ? order.packages[0] : order.packages

  return (
    <AdminShell title={order.order_number}>
      <div className="grid gap-6 lg:grid-cols-[0.72fr_0.38fr]">
        <div className="flex flex-col gap-6">
          <section className="grid gap-4 border p-6 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Status" value={<StatusBadge status={order.status} />} />
            <Info label="Customer" value={order.customer_email} />
            <Info label="Package" value={packagePlan?.name ?? "-"} />
            <Info
              label="Amount"
              value={
                order.amount_cents
                  ? formatMoney(order.amount_cents, order.currency ?? "usd")
                  : "-"
              }
            />
          </section>

          <section className="flex flex-col gap-4 border p-6">
            <h2 className="text-2xl font-semibold">Project brief</h2>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <Info label="Render type" value={order.render_type ?? "-"} />
              <Info label="Project type" value={order.project_type ?? "-"} />
              <Info label="Style" value={order.style_preference ?? "-"} />
              <Info label="Deadline" value={order.deadline_preference ?? "-"} />
              <Info label="Floors" value={order.number_of_floors ?? "-"} />
              <Info label="Square meters" value={order.estimated_square_meters ?? "-"} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {order.customer_notes || "No customer notes."}
            </p>
          </section>

          <section className="flex flex-col gap-4 border p-6">
            <h2 className="text-2xl font-semibold">Files</h2>
            <div className="flex flex-col gap-2">
              {signedFiles.map((file) => (
                <Link
                  key={file.id}
                  href={file.signedUrl}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <DownloadIcon data-icon="inline-start" />
                  {file.file_role}: {file.original_filename}
                </Link>
              ))}
            </div>
            <form action={uploadAdminFinalFilesAction} className="flex flex-col gap-3 border-t pt-4">
              <input type="hidden" name="order_id" value={order.id} />
              <Field>
                <FieldLabel htmlFor="admin-files">Upload final renders for customer delivery</FieldLabel>
                <Input id="admin-files" name="files" type="file" multiple />
              </Field>
              <p className="text-sm leading-6 text-muted-foreground">
                Uploaded final renders appear on the customer status page. The order moves to needs_review until you approve delivery.
              </p>
              <Button type="submit" className="w-fit">
                <UploadIcon data-icon="inline-start" />
                Upload final files
              </Button>
            </form>
          </section>

          <section className="flex flex-col gap-4 border p-6">
            <h2 className="text-2xl font-semibold">Worker logs</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs ?? []).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>{run.worker_id}</TableCell>
                    <TableCell>{run.status}</TableCell>
                    <TableCell>{new Date(run.created_at).toLocaleString()}</TableCell>
                    <TableCell>{run.error_message || run.logs || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>

        <aside className="flex h-fit flex-col gap-6 border p-6 lg:sticky lg:top-6">
          <form action={updateOrderAdminAction} className="flex flex-col gap-4">
            <input type="hidden" name="order_id" value={order.id} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <select id="status" name="status" defaultValue={order.status} className="h-10 rounded-lg border bg-background px-3 text-sm">
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="internal_notes">Internal notes</FieldLabel>
                <Textarea id="internal_notes" name="internal_notes" defaultValue={order.internal_notes ?? ""} rows={8} />
              </Field>
            </FieldGroup>
            <Button type="submit">Update order</Button>
          </form>
          <form action={sendCompletionEmailAction}>
            <input type="hidden" name="order_id" value={order.id} />
            <Button type="submit" variant="outline" className="w-full">
              <SendIcon data-icon="inline-start" />
              Mark completed and email client
            </Button>
          </form>
          <div className="border-t pt-4">
            <h2 className="mb-3 font-semibold">Payments</h2>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {(payments ?? []).map((payment) => (
                <div key={payment.id} className="border p-3">
                  {payment.status} · {payment.stripe_checkout_session_id}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-4">
            <h2 className="mb-3 font-semibold">Emails</h2>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {(emails ?? []).map((email) => (
                <div key={email.id} className="border p-3">
                  {email.email_type} · {email.status}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AdminShell>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
