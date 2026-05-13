import Link from "next/link"
import { AdminShell } from "@/components/admin/admin-shell"
import { StatusBadge } from "@/components/site/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { formatMoney } from "@/lib/format"
import { orderStatuses } from "@/lib/types"

export const metadata = {
  title: "Admin orders",
}

export const dynamic = "force-dynamic"

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await requireAdmin()
  const params = await searchParams
  const supabase = createSupabaseAdminClient()
  let query = supabase
    .from("orders")
    .select("id,order_number,customer_email,status,amount_cents,currency,created_at,paid_at,packages(name)")
    .order("created_at", { ascending: false })
    .limit(100)

  if (params.status && orderStatuses.includes(params.status as never)) {
    query = query.eq("status", params.status)
  }

  if (params.q) {
    const q = params.q.replaceAll(",", " ")
    query = query.or(`customer_email.ilike.%${q}%,order_number.ilike.%${q}%`)
  }

  const { data: orders, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (
    <AdminShell title="Orders">
      <form className="flex flex-col gap-3 border p-4 md:flex-row md:items-center">
        <Input name="q" placeholder="Search email or order number" defaultValue={params.q ?? ""} className="md:max-w-sm" />
        <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-lg border bg-background px-3 text-sm">
          <option value="">All statuses</option>
          {orderStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).map((order) => {
              const packagePlan = Array.isArray(order.packages) ? order.packages[0] : order.packages
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>{order.customer_email}</TableCell>
                  <TableCell>{packagePlan?.name ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    {order.amount_cents
                      ? formatMoney(order.amount_cents, order.currency ?? "usd")
                      : "-"}
                  </TableCell>
                  <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Link href={`/admin/orders/${order.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  )
}
