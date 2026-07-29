import Link from "next/link"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
} from "lucide-react"
import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { getAdminSnapshot } from "@/lib/admin-data"
import { cn } from "@/lib/utils"

export const metadata = { title: "Admin overview" }

export default async function AdminOverviewPage() {
  const data = await getAdminSnapshot()
  const maxWeeklyJobs = Math.max(...data.weeklyUsage.map((week) => week.jobs), 1)
  const openAlerts = data.alerts.filter((alert) =>
    ["open", "acknowledged"].includes(alert.status)
  )

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Operating overview"
        title="What needs attention today"
        body="A plain-language control panel for growth, revenue, takeoff volume, delivery quality, customer geography, and system readiness."
      />
      <p className="-mt-5 text-xs text-muted-foreground">
        Complete-dataset metrics refreshed {formatTimestamp(data.asOf)}. Recent
        detail tables are intentionally bounded for operator lookup.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric
          label="Total users"
          value={data.metrics.totalUsers.toLocaleString()}
          trend={data.metrics.userGrowthPct}
          note={`${data.metrics.newUsers30} joined in 30 days`}
        />
        <AdminMetric
          label="Active subscriptions"
          value={data.metrics.activeSubscriptions.toLocaleString()}
          trend={data.metrics.subscriptionNet30}
          note={`${signed(data.metrics.subscriptionNet30)} net in 30 days`}
        />
        <AdminMetric
          label="Catalog MRR"
          value={money(data.metrics.mrrCents)}
          note="Active plan value before discounts"
        />
        <AdminMetric
          label="30-day takeoff revenue"
          value={money(data.metrics.revenue30Cents)}
          note="Actual Stripe payments, including renewals"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Weekly takeoff volume</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                New jobs over the last eight weeks
              </p>
            </div>
            <Link
              href="/admin/jobs"
              className="text-sm font-medium text-primary"
            >
              Open queue
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-3 border-b border-l px-3 pt-6">
              {data.weeklyUsage.map((week) => (
                <div
                  key={week.label}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
                >
                  <div
                    className="min-h-1 bg-primary transition-all"
                    style={{
                      height: `${Math.max(4, (week.jobs / maxWeeklyJobs) * 100)}%`,
                    }}
                    title={`${week.jobs} jobs · ${week.pages} pages`}
                  />
                  <p className="truncate text-center text-[10px] text-muted-foreground">
                    {week.label}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <MiniMetric
                label="Jobs / 30 days"
                value={data.metrics.jobs30.toLocaleString()}
              />
              <MiniMetric
                label="Pages / 30 days"
                value={data.metrics.pages30.toLocaleString()}
              />
              <MiniMetric
                label="Credits used"
                value={data.metrics.consumedCredits.toLocaleString()}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Launch readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.readiness.map((item) => (
              <div key={item.title} className="flex gap-3 border-b pb-3 last:border-0">
                {item.level === "ok" ? (
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : item.level === "critical" ? (
                  <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-red-600" />
                ) : (
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                )}
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Conversion funnel · 30 days</CardTitle>
            <Link href="/admin/growth" className="text-sm text-primary">
              Growth detail
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.funnel.map((step, index) => {
              const first = data.funnel[0]?.count ?? 0
              const rate = first ? (step.count / first) * 100 : 0
              return (
                <div key={step.name}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <span>
                      {index + 1}. {funnelLabel(step.name)}
                    </span>
                    <span className="font-medium">
                      {step.count.toLocaleString()} · {rate.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={rate} />
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Open alerts</CardTitle>
            <Link href="/admin/health" className="text-sm text-primary">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {openAlerts.length ? (
              <div className="divide-y">
                {openAlerts.slice(0, 6).map((alert) => (
                  <Link
                    key={alert.id}
                    href="/admin/health"
                    className="flex items-center gap-3 py-3"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        alert.severity === "critical"
                          ? "bg-red-500"
                          : alert.severity === "warning"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{alert.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {alert.category} · {alert.occurrence_count} occurrence
                        {alert.occurrence_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid h-48 place-items-center text-center">
                <div>
                  <CheckCircle2Icon className="mx-auto size-7 text-emerald-600" />
                  <p className="mt-3 text-sm font-medium">No open alerts</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Operational exceptions will appear here.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <QualityCard
          label="On-time delivery"
          value={
            data.metrics.onTimeEligible30
              ? `${data.metrics.onTimeRate30.toFixed(1)}%`
              : "—"
          }
          target="Target ≥ 95%"
          healthy={
            data.metrics.onTimeEligible30
              ? data.metrics.onTimeRate30 >= 95
              : null
          }
        />
        <QualityCard
          label="Automation failure rate"
          value={
            data.metrics.completedJobs30 + data.metrics.failedJobs30
              ? `${data.metrics.failureRate30.toFixed(1)}%`
              : "—"
          }
          target="Target < 5%"
          healthy={
            data.metrics.completedJobs30 + data.metrics.failedJobs30
              ? data.metrics.failureRate30 < 5
              : null
          }
        />
        <QualityCard
          label="Correction request rate"
          value={
            data.metrics.deliveredJobs30
              ? `${data.metrics.correctionRate30.toFixed(1)}%`
              : "—"
          }
          target="Monitor first-pass acceptance"
          healthy={
            data.metrics.deliveredJobs30
              ? data.metrics.correctionRate30 < 10
              : null
          }
        />
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  )
}

function QualityCard({
  label,
  value,
  target,
  healthy,
}: {
  label: string
  value: string
  target: string
  healthy: boolean | null
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Badge
            variant="secondary"
            className={
              healthy === null
                ? "text-muted-foreground"
                : healthy
                  ? "text-emerald-700"
                  : "text-amber-700"
            }
          >
            {healthy === null ? "Waiting" : healthy ? "On track" : "Review"}
          </Badge>
        </div>
        <p className="mt-3 text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{target}</p>
      </CardContent>
    </Card>
  )
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value))
}

function funnelLabel(name: string) {
  const labels: Record<string, string> = {
    takeoff_draft_created: "Draft created",
    takeoff_quote_ready: "Verified quote",
    takeoff_queued: "Credits confirmed",
    takeoff_automation_completed: "Automation complete",
    takeoff_delivered: "Delivered",
  }
  return labels[name] ?? name
}
