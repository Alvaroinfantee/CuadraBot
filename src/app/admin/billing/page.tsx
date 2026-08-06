import {
  adjustCredits,
  scheduleSubscriptionCancellation,
  syncStripeCatalog,
} from "@/app/admin/actions"
import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAdminSnapshot } from "@/lib/admin-data"

export const metadata = { title: "Billing and credits" }

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>
}) {
  const query = await searchParams
  const data = await getAdminSnapshot()
  const profiles = new Map(data.profiles.map((profile) => [profile.id, profile]))
  const balances = new Map(
    data.credits.map((account) => [account.user_id, account.balance])
  )

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Revenue operations"
        title="Billing, subscriptions, and credits"
        body="Monitor recurring revenue, completed purchases, payment exceptions, and customer credit liability without opening the database."
      />
      {query.catalog === "synced" ? (
        <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Stripe’s six configured Prices were validated and synced to the
          Cuadrabot billing catalog.
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric
          label="Catalog MRR"
          value={money(data.metrics.mrrCents)}
          note={`${data.metrics.activeSubscriptions} active plans before discounts`}
          trend={data.metrics.subscriptionNet30}
        />
        <AdminMetric
          label="30-day paid revenue"
          value={money(data.metrics.revenue30Cents)}
          note="Actual Stripe payments, including renewals"
        />
        <AdminMetric
          label="Available credit liability"
          value={data.metrics.availableCredits.toLocaleString()}
          note="Credits customers can still spend"
        />
        <AdminMetric
          label="Payment exceptions"
          value={String(
            data.metrics.pastDueSubscriptions + data.metrics.refunds30
          )}
          note={`${data.metrics.pastDueSubscriptions} past due · ${data.metrics.refunds30} refunds in 30 days`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Catalog readiness</CardTitle>
              <form action={syncStripeCatalog}>
                <Button type="submit" size="sm" variant="outline">
                  Validate &amp; sync Stripe
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              This checks all six server-configured Stripe Prices for the
              correct amount, currency, and billing interval before enabling
              checkout.
            </p>
            {data.plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-4 border-b pb-3"
              >
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {money(plan.price_cents)} · {plan.credits} credits ·{" "}
                    {plan.plan_type.replace("_", " ")}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    plan.active && plan.stripe_price_id
                      ? "text-emerald-700"
                      : "text-red-700"
                  }
                >
                  {plan.active && plan.stripe_price_id
                    ? "Ready"
                    : "Needs Stripe Price"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period end</TableHead>
                  <TableHead>Cancellation</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.subscriptions.slice(0, 30).map((subscription) => {
                  const profile = profiles.get(subscription.user_id)
                  return (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <p className="font-medium">
                          {profile?.company_name || profile?.email || "Unknown"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscription.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {subscription.current_period_end
                          ? formatDate(subscription.current_period_end)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {subscription.cancel_at_period_end
                          ? "At period end"
                          : "Renews"}
                      </TableCell>
                      <TableCell>
                        {subscription.cancel_at_period_end ||
                        ["canceled", "expired", "incomplete_expired"].includes(
                          subscription.status
                        ) ? (
                          <span className="text-xs text-muted-foreground">
                            No action needed
                          </span>
                        ) : (
                          <form action={scheduleSubscriptionCancellation}>
                            <input
                              type="hidden"
                              name="subscriptionId"
                              value={subscription.id}
                            />
                            <input
                              type="hidden"
                              name="reason"
                              value="Scheduled from Admin Billing"
                            />
                            <Button type="submit" size="sm" variant="outline">
                              Stop renewal
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audited credit adjustment</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={adjustCredits}
            className="grid gap-4 lg:grid-cols-[1.4fr_0.55fr_1.4fr_auto] lg:items-end"
          >
            <input
              type="hidden"
              name="idempotencyKey"
              value={crypto.randomUUID()}
            />
            <label className="space-y-2 text-sm">
              <span className="font-medium">Customer workspace</span>
              <select
                name="userId"
                required
                defaultValue=""
                className="h-9 w-full border bg-transparent px-3 text-sm"
              >
                <option value="" disabled>
                  Select a customer
                </option>
                {data.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.company_name || profile.email} ·{" "}
                    {(balances.get(profile.id) ?? 0).toLocaleString()} credits
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Credit change</span>
              <Input
                name="amount"
                type="number"
                step="1"
                min="-100000"
                max="100000"
                placeholder="-550 or 100"
                required
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Reason</span>
              <Input
                name="reason"
                minLength={8}
                maxLength={500}
                placeholder="Refund, dispute, goodwill, or correction reference"
                required
              />
            </label>
            <Button type="submit">Apply adjustment</Button>
          </form>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Positive numbers add credits; negative numbers remove available
            credits. A removal cannot make the balance negative. Every change
            writes the ledger and admin audit in one database transaction.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent billing orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.slice(0, 100).map((order) => {
                const profile = profiles.get(order.user_id)
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      {profile?.company_name || profile?.email || "Unknown"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.sku}
                    </TableCell>
                    <TableCell>{order.kind.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{order.status}</Badge>
                    </TableCell>
                    <TableCell>{order.credits.toLocaleString()}</TableCell>
                    <TableCell>{money(order.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(order.created_at)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}
