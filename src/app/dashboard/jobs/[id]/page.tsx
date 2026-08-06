import Link from "next/link"
import { notFound } from "next/navigation"
import {
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { JobStatus } from "@/components/takeoff/job-status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { requireUser } from "@/lib/auth"
import { getCustomerJob } from "@/lib/customer-dashboard"
import {
  dashboardCopy,
  formatDashboardDate,
  formatDashboardNumber,
  formatPlanPages,
  localizeFailureMessage,
  localizeJobEvent,
  localizeJobStage,
} from "@/lib/dashboard-i18n"
import { getRequestLocale } from "@/lib/i18n-server"
import { localizedTradeLabels } from "@/lib/i18n"
import { isIncludedCorrectionWindowOpen } from "@/lib/project-file-retention"
import { isCustomerTakeoffDeliverableFilename } from "@/lib/takeoff-artifacts"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: dashboardCopy[locale].metadata.jobDetails }
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser(`/dashboard/jobs/${id}`)
  const [{ job, files, events, archive }, locale] = await Promise.all([
    getCustomerJob(user.id, id),
    getRequestLocale(),
  ])
  if (!job) notFound()

  const copy = dashboardCopy[locale].detail
  const results = files
    .filter(
      (file) =>
        file.file_role !== "input" &&
        isCustomerTakeoffDeliverableFilename(file.original_filename)
    )
    .sort(
      (left, right) =>
        Number(left.original_filename === "takeoff.xlsx") -
        Number(right.original_filename === "takeoff.xlsx")
    )
  const legendMetrics = readLegendMetrics(job.result_summary)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={job.free_sample ? copy.freeSample : copy.verifiedTakeoff}
        title={job.project_name}
        description={`${copy.created} ${formatDashboardDate(
          job.created_at,
          locale,
          true
        )} · ${
          job.input_page_count === null
            ? `— ${copy.planPages}`
            : formatPlanPages(job.input_page_count, locale)
        } · ${formatDashboardNumber(job.quoted_credits, locale)} ${
          copy.credits
        }`}
        action={<JobStatus status={job.status} locale={locale} />}
      />

      {job.status === "failed" ? (
        <Alert variant="destructive">
          <AlertTitle>{copy.attentionTitle}</AlertTitle>
          <AlertDescription>
            {localizeFailureMessage({
              failureCode: job.failure_code,
              storedMessage: job.failure_message,
              locale,
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>{copy.progress}</CardTitle>
              <span className="font-mono text-sm text-muted-foreground">
                {job.progress}%
              </span>
            </CardHeader>
            <CardContent>
              <Progress value={job.progress} />
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[
                  [copy.planVerified, true],
                  [
                    copy.measured,
                    ["processing", "needs_review", "completed"].includes(
                      job.status
                    ),
                  ],
                  [copy.outputValidated, job.status === "completed"],
                  [copy.delivered, job.status === "completed"],
                ].map(([label, done]) => (
                  <div
                    key={String(label)}
                    className={cn(
                      "border p-3 text-xs",
                      done ? "border-emerald-200 bg-emerald-50" : "bg-muted/30"
                    )}
                  >
                    <CheckCircle2Icon
                      className={cn(
                        "mb-2 size-4",
                        done ? "text-emerald-600" : "text-muted-foreground"
                      )}
                    />
                    {label}
                  </div>
                ))}
              </div>
              {job.stage ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {copy.currentStage}: {localizeJobStage(job.stage, locale)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.deliverables}</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {results.map((file) => {
                    const spreadsheet =
                      file.original_filename === "takeoff.xlsx"
                    const Icon = spreadsheet
                      ? FileSpreadsheetIcon
                      : FileTextIcon
                    const title = spreadsheet
                      ? copy.countWorkbookTitle
                      : copy.annotatedBlueprintTitle
                    const description = spreadsheet
                      ? copy.countWorkbookBody
                      : copy.annotatedBlueprintBody
                    return (
                      <Link
                        key={file.id}
                        href={`/api/takeoff/jobs/${job.id}/download?file=${encodeURIComponent(file.id)}`}
                        className="group flex items-start gap-4 border p-5 transition-colors hover:border-primary"
                      >
                        <span className="grid size-10 shrink-0 place-items-center bg-blue-50 text-primary">
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {description}
                          </p>
                          <p className="mt-3 text-xs font-medium text-emerald-700">
                            {copy.verifiedOutput}
                          </p>
                        </div>
                        <DownloadIcon className="mt-1 size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="border border-dashed p-8 text-center">
                  <ShieldCheckIcon className="mx-auto size-7 text-primary" />
                  <p className="mt-3 font-medium">{copy.processingTitle}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {copy.processingBody}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {legendMetrics ? (
            <Card>
              <CardHeader>
                <CardTitle>{copy.legendSummary}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [copy.legendEntries, legendMetrics.legendEntries],
                    [copy.mappedPlacements, legendMetrics.countPlacements],
                    [copy.measuredRuns, legendMetrics.linearRuns],
                    [copy.unresolvedSymbols, legendMetrics.unresolvedSymbols],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="border p-4">
                      <p className="text-xs text-muted-foreground">
                        {String(label)}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatDashboardNumber(Number(value), locale)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-l-2 border-primary pl-4">
                  <p className="text-sm font-medium">
                    {copy.legendCoverage}:{" "}
                    {formatDashboardNumber(
                      Math.round(legendMetrics.coveragePercent * 10) / 10,
                      locale
                    )}
                    %
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {copy.legendCoverageBody}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{copy.scope}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {copy.trades}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(job.trades ?? []).map((trade) => (
                    <Badge key={trade} variant="secondary">
                      {localizedTradeLabels[locale][trade]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {copy.instructions}
                </p>
                <p className="mt-2 leading-6">
                  {job.customer_notes || copy.noInstructions}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {copy.reserved}
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatDashboardNumber(job.reserved_credits, locale)}{" "}
                    {copy.credits}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {copy.charged}
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatDashboardNumber(job.consumed_credits, locale)}{" "}
                    {copy.credits}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {archive && archive.status !== "deleted" ? (
            <Card>
              <CardHeader>
                <CardTitle>{copy.originalArchive}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="mt-0.5 size-5 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {archive.original_filename}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {formatPlanPages(archive.page_count, locale)} ·{" "}
                      {copy.privateArchive} · {copy.checksumRegistered}
                    </p>
                  </div>
                </div>
                {archive.status === "deletion_requested" ||
                archive.status === "deleting" ? (
                  <Alert>
                    <AlertTitle>{copy.deletionTitle}</AlertTitle>
                    <AlertDescription>{copy.deletionBody}</AlertDescription>
                  </Alert>
                ) : archive.integrity_status === "missing" ? (
                  <Alert variant="destructive">
                    <AlertTitle>{copy.sourceUnavailableTitle}</AlertTitle>
                    <AlertDescription>
                      {copy.sourceUnavailableBody}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Link
                    href={`/api/takeoff/jobs/${job.id}/source`}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full gap-2"
                    )}
                  >
                    <DownloadIcon />
                    {copy.downloadOriginal}
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{copy.activity}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4 border-l pl-4">
                {events.map((event) => (
                  <li key={event.id} className="relative text-sm">
                    <span className="absolute -left-[1.31rem] top-1 size-2 rounded-full bg-primary" />
                    <p className="font-medium">
                      {localizeJobEvent({
                        eventType: event.event_type,
                        message: event.message,
                        metadata:
                          event.metadata as Record<string, unknown> | null,
                        locale,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDashboardDate(event.created_at, locale, true)}
                    </p>
                  </li>
                ))}
                {!events.length ? (
                  <li className="text-sm text-muted-foreground">
                    {copy.activityFallback}
                  </li>
                ) : null}
              </ol>
            </CardContent>
          </Card>

          {job.status === "completed" &&
          !job.project_files_purged_at &&
          isIncludedCorrectionWindowOpen(job.completed_at ?? "") ? (
            <Link
              href={`/dashboard/jobs/${job.id}/correction`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full gap-2"
              )}
            >
              <MessageSquareTextIcon />
              {copy.requestCorrection}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function readLegendMetrics(resultSummary: Record<string, unknown>) {
  const metrics =
    resultSummary.metrics &&
    typeof resultSummary.metrics === "object" &&
    !Array.isArray(resultSummary.metrics)
      ? (resultSummary.metrics as Record<string, unknown>)
      : null
  if (!metrics) return null

  const legendEntries = finiteNonnegative(metrics.legend_entries)
  const countPlacements = finiteNonnegative(metrics.count_placements)
  const linearRuns = finiteNonnegative(metrics.linear_runs)
  const unresolvedSymbols = finiteNonnegative(metrics.unresolved_symbols)
  const coveragePercent = finiteNonnegative(
    metrics.legend_coverage_percent
  )

  if (
    legendEntries === null ||
    countPlacements === null ||
    linearRuns === null ||
    unresolvedSymbols === null ||
    coveragePercent === null ||
    coveragePercent > 100
  ) {
    return null
  }

  return {
    legendEntries,
    countPlacements,
    linearRuns,
    unresolvedSymbols,
    coveragePercent,
  }
}

function finiteNonnegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null
}
