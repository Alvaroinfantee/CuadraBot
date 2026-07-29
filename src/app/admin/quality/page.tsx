import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminSnapshot } from "@/lib/admin-data"

export const metadata = { title: "Quality and delivery" }

export default async function AdminQualityPage() {
  const data = await getAdminSnapshot()
  const qaQueue = data.jobs.filter((job) => job.status === "needs_review")

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Service quality"
        title="Accuracy, validation, and turnaround"
        body="Monitor whether jobs finish, arrive on time, preserve annotation coverage, and pass the first delivery without a correction request."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric
          label="On-time delivery"
          value={
            data.metrics.onTimeEligible30
              ? `${data.metrics.onTimeRate30.toFixed(1)}%`
              : "—"
          }
          note={`${data.metrics.onTimeEligible30} eligible completions in 30 days`}
        />
        <AdminMetric
          label="Failure rate"
          value={
            data.metrics.completedJobs30 + data.metrics.failedJobs30
              ? `${data.metrics.failureRate30.toFixed(1)}%`
              : "—"
          }
          note={`${data.metrics.failedJobs30} failed terminal jobs in 30 days`}
        />
        <AdminMetric
          label="Correction rate"
          value={
            data.metrics.deliveredJobs30
              ? `${data.metrics.correctionRate30.toFixed(1)}%`
              : "—"
          }
          note={`${data.metrics.deliveredJobs30} deliveries in 30 days`}
        />
        <AdminMetric
          label="Annotation coverage"
          value={
            data.metrics.annotationCountedUnits30
              ? `${data.metrics.annotationCoverage30.toFixed(1)}%`
              : "—"
          }
          note={`${data.metrics.annotationSkipped30} skipped of ${data.metrics.annotationCountedUnits30} counted in 30 days`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Correction and exception queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {qaQueue.slice(0, 20).map((job) => (
              <a
                key={job.id}
                href={`/admin/jobs/${job.id}`}
                className="flex items-center justify-between gap-4 border-b py-3"
              >
                <div>
                  <p className="text-sm font-medium">{job.project_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {job.input_page_count} pages · {job.reserved_credits} credits
                  </p>
                </div>
                <Badge variant="secondary">Review now</Badge>
              </a>
            ))}
            {!qaQueue.length ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No correction or exception reviews are waiting.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quality operating targets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              [
                "On-time delivery",
                "≥ 95%",
                data.metrics.onTimeEligible30
                  ? data.metrics.onTimeRate30 >= 95
                  : null,
              ],
              [
                "Automation failures",
                "< 5%",
                data.metrics.completedJobs30 + data.metrics.failedJobs30
                  ? data.metrics.failureRate30 < 5
                  : null,
              ],
              [
                "Correction requests",
                "< 10%",
                data.metrics.deliveredJobs30
                  ? data.metrics.correctionRate30 < 10
                  : null,
              ],
              [
                "Annotation coverage",
                "100%",
                data.metrics.annotationCountedUnits30
                  ? data.metrics.annotationCoverage30 >= 99.9
                  : null,
              ],
            ].map(([label, target, healthy]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between gap-4 border-b pb-4"
              >
                <div>
                  <p className="text-sm font-medium">{String(label)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Target {String(target)}
                  </p>
                </div>
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
                  {healthy === null
                    ? "Waiting"
                    : healthy
                      ? "On track"
                      : "Review"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
