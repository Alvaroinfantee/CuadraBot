import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { getAdminSnapshot } from "@/lib/admin-data"

export const metadata = { title: "Funnel and growth" }

export default async function AdminGrowthPage() {
  const data = await getAdminSnapshot()
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
              Source, medium, and campaign are stored on consent-aware product
              events. No campaign has enough attributed data to display until
              launch traffic arrives.
            </p>
            <div className="mt-6 space-y-3">
              {[
                ["Primary growth KPI", "90-day contribution / CAC"],
                ["Activation KPI", "Upload → verified quote"],
                ["Revenue KPI", "Verified quote → confirmed credits"],
                ["Retention KPI", "Second takeoff within 90 days"],
              ].map(([name, value]) => (
                <div key={name} className="border p-4">
                  <p className="text-xs text-muted-foreground">{name}</p>
                  <p className="mt-1 text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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
