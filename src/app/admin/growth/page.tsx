import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  getAdminMarketingSnapshot,
  getAdminSnapshot,
} from "@/lib/admin-data"

export const metadata = { title: "Funnel and growth" }

export default async function AdminGrowthPage() {
  const [data, marketing] = await Promise.all([
    getAdminSnapshot(),
    getAdminMarketingSnapshot(),
  ])
  const first = data.funnel[0]?.count ?? 0
  const paid = data.funnel.find((step) => step.name === "takeoff_queued")?.count ?? 0
  const conversion = first ? (paid / first) * 100 : 0

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Acquisition and retention"
        title="Funnel and growth"
        body="See where prospective customers progress or stop, whether new-user growth is accelerating, and how many companies return for another takeoff."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetric
          label="New users · 30 days"
          value={String(data.metrics.newUsers30)}
          note={`${data.metrics.userGrowthPct.toFixed(0)}% vs previous 30 days`}
          trend={data.metrics.userGrowthPct}
        />
        <AdminMetric
          label="Draft-to-confirmed conversion"
          value={`${conversion.toFixed(1)}%`}
          note={`${paid} confirmed of ${first} drafts`}
        />
        <AdminMetric
          label="Repeat company rate"
          value={`${data.metrics.repeatCompanyRate.toFixed(1)}%`}
          note={`${data.metrics.repeatCompanies} of ${data.metrics.companiesWithConfirmedJobs} confirmed customers`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetric
          label="Consented visitors · 30 days"
          value={marketing.metrics.visitors30.toLocaleString()}
          note={`${marketing.metrics.sessions30.toLocaleString()} sessions`}
        />
        <AdminMetric
          label="Accounts created"
          value={marketing.metrics.accountsCreated30.toLocaleString()}
          note="Successful consented registrations"
        />
        <AdminMetric
          label="Blueprint uploads started"
          value={marketing.metrics.blueprintUploadsStarted30.toLocaleString()}
          note="Unique upload drafts per session"
        />
        <AdminMetric
          label="Checkouts started"
          value={marketing.metrics.checkoutsStarted30.toLocaleString()}
          note="Unique SKU starts per session"
        />
        <AdminMetric
          label="Attributed purchases"
          value={marketing.metrics.purchases30.toLocaleString()}
          note="Server-verified Stripe conversions"
        />
        <AdminMetric
          label="Consented events"
          value={marketing.metrics.events30.toLocaleString()}
          note="No raw IP or full user-agent storage"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>30-day draft cohort funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {data.funnel.map((step, index) => {
              const rate = first ? (step.count / first) * 100 : 0
              const previous = index ? data.funnel[index - 1].count : step.count
              const stepRate = previous ? (step.count / previous) * 100 : 0
              return (
                <div key={step.name}>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {index + 1}. {label(step.name)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {index ? `${stepRate.toFixed(1)}% from prior step` : "Funnel entry"}
                      </p>
                    </div>
                    <p className="text-xl font-semibold">{step.count}</p>
                  </div>
                  <Progress value={rate} className="h-3" />
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign signals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              First-party source, medium, campaign, and purchase signals from
              visitors who allowed marketing analytics.
            </p>
            <div className="mt-6 space-y-3">
              {marketing.campaigns.slice(0, 8).map((row) => (
                <div
                  key={`${row.source}:${row.medium}:${row.campaign}`}
                  className="border p-4"
                >
                  <p className="text-xs text-muted-foreground">
                    {row.source} · {row.medium}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium">
                    {row.campaign}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {row.visitors} visitors · {row.accountsCreated} accounts ·{" "}
                    {row.blueprintUploadsStarted} uploads · {row.checkoutsStarted} checkouts ·{" "}
                    {row.purchases} purchases
                  </p>
                </div>
              ))}
              {!marketing.campaigns.length ? (
                <p className="border p-4 text-sm text-muted-foreground">
                  No consented campaign traffic recorded yet.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <BreakdownCard title="Device mix" rows={marketing.devices} />
        <BreakdownCard title="Visitor country" rows={marketing.geography} />
        <BreakdownCard
          title="Optional declared age range"
          rows={marketing.ageBands.map((row) => ({ ...row, events: 0 }))}
          hideEvents
        />
      </div>
    </div>
  )
}

function BreakdownCard({
  title,
  rows,
  hideEvents = false,
}: {
  title: string
  rows: Array<{ label: string; visitors: number; events: number }>
  hideEvents?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.slice(0, 10).map((row) => (
          <div key={row.label} className="flex justify-between gap-4 border-b pb-3 text-sm last:border-0">
            <span>{row.label}</span>
            <span className="text-right text-muted-foreground">
              {row.visitors} visitors
              {!hideEvents ? ` · ${row.events} events` : ""}
            </span>
          </div>
        ))}
        {!rows.length ? (
          <p className="text-sm text-muted-foreground">No consented data yet.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function label(name: string) {
  const labels: Record<string, string> = {
    takeoff_draft_created: "Draft created",
    takeoff_quote_ready: "Verified quote shown",
    takeoff_queued: "Credits confirmed",
    takeoff_automation_completed: "Automation completed",
    takeoff_delivered: "Self-serve delivery",
  }
  return labels[name] ?? name
}
