import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminSnapshot } from "@/lib/admin-data"

export const metadata = { title: "Customer geography" }

export default async function AdminGeographyPage() {
  const data = await getAdminSnapshot()
  const known = data.metrics.knownLocationUsers
  const coverage = data.metrics.totalUsers
    ? (known / data.metrics.totalUsers) * 100
    : 0
  const max = Math.max(...data.geography.map((row) => row.users), 1)

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Market coverage"
        title="Where customers are located"
        body="Coarse country and region signals from customer profiles or Stripe billing addresses. Complete street addresses stay in Stripe."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetric
          label="Countries"
          value={String(data.metrics.countries)}
          note="With at least one known customer"
        />
        <AdminMetric
          label="Location coverage"
          value={`${coverage.toFixed(1)}%`}
          note={`${known} of ${data.metrics.totalUsers} users`}
        />
        <AdminMetric
          label="Top market"
          value={data.geography[0]?.label.split(" · ")[0] ?? "No data"}
          note={
            data.geography[0]
              ? `${data.geography[0].users} known users`
              : "Billing geography appears after launch"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users by country and region</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.geography.slice(0, 30).map((row) => (
            <div key={row.label} className="grid gap-2 sm:grid-cols-[220px_1fr_60px] sm:items-center">
              <p className="truncate text-sm">{row.label}</p>
              <div className="h-3 bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(row.users / max) * 100}%` }}
                />
              </div>
              <p className="text-right text-sm font-medium">{row.users}</p>
            </div>
          ))}
          {!data.geography.length ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Geography will populate from profiles and successful billing
              sessions.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="border bg-white p-5 text-xs leading-6 text-muted-foreground">
        Privacy note: this view is intentionally coarse. Use country and
        region for market planning and tax operations; avoid copying complete
        billing addresses into analytics unless an operational need is
        documented.
      </div>
    </div>
  )
}
