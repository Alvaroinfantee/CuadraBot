import { resolveAlert } from "@/app/admin/actions"
import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminSnapshot } from "@/lib/admin-data"
import { cn } from "@/lib/utils"

export const metadata = { title: "System health and alerts" }

export default async function AdminHealthPage() {
  const data = await getAdminSnapshot()
  const openAlerts = data.alerts.filter((alert) =>
    ["open", "acknowledged"].includes(alert.status)
  )
  const critical = openAlerts.filter((alert) => alert.severity === "critical")
  const current =
    data.healthSummary.total -
    data.healthSummary.missing -
    data.healthSummary.stale

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Operations"
        title="System health and alerts"
        body="A nontechnical view of what is working, what is stale, and which payment, worker, data, or security exceptions need an owner."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetric
          label="Open alerts"
          value={String(openAlerts.length)}
          note={`${critical.length} critical`}
        />
        <AdminMetric
          label="Healthy checks"
          value={`${data.healthSummary.healthy}/${data.healthSummary.total}`}
          note={`${current} reports are current`}
        />
        <AdminMetric
          label="Readiness issues"
          value={String(
            data.readiness.filter((item) => item.level !== "ok").length
          )}
          note="Configuration or data gaps"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Service checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.health.map((check) => {
              const expired =
                check.missing ||
                !check.expires_at ||
                new Date(check.expires_at) < new Date(data.asOf)
              return (
                <div key={check.id} className="border-b pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {check.service_name} · {check.check_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {check.missing
                          ? "No report received"
                          : `Last report ${formatDate(check.checked_at)}`}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        check.status === "healthy" && !expired
                          ? "text-emerald-700"
                          : "text-red-700"
                      )}
                    >
                      {check.missing
                        ? "missing"
                        : expired
                          ? "stale"
                          : check.status}
                    </Badge>
                  </div>
                  {check.message ? (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {check.message}
                    </p>
                  ) : null}
                </div>
              )
            })}
            {!data.health.length ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No services have reported health yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Readiness checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.readiness.map((item) => (
              <div key={item.title} className="border-b pb-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge
                    variant="secondary"
                    className={
                      item.level === "ok"
                        ? "text-emerald-700"
                        : item.level === "critical"
                          ? "text-red-700"
                          : "text-amber-700"
                    }
                  >
                    {item.level}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.alerts.slice(0, 100).map((alert) => (
            <div key={alert.id} className="grid gap-4 border p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      alert.severity === "critical"
                        ? "text-red-700"
                        : alert.severity === "warning"
                          ? "text-amber-700"
                          : "text-blue-700"
                    }
                  >
                    {alert.severity}
                  </Badge>
                  <Badge variant="outline">{alert.category}</Badge>
                  <Badge variant="outline">{alert.status}</Badge>
                </div>
                <p className="mt-3 font-medium">{alert.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {alert.message}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last seen {formatDate(alert.last_seen_at)} ·{" "}
                  {alert.occurrence_count} occurrence
                  {alert.occurrence_count === 1 ? "" : "s"}
                </p>
              </div>
              {["open", "acknowledged"].includes(alert.status) ? (
                <form action={resolveAlert} className="flex gap-2">
                  <input type="hidden" name="alertId" value={alert.id} />
                  {alert.status === "open" ? (
                    <Button
                      type="submit"
                      name="status"
                      value="acknowledged"
                      variant="outline"
                      size="sm"
                    >
                      Acknowledge
                    </Button>
                  ) : null}
                  <Button
                    type="submit"
                    name="status"
                    value="resolved"
                    size="sm"
                  >
                    Resolve
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
