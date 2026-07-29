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
import { isIncludedCorrectionWindowOpen } from "@/lib/project-file-retention"
import { tradeLabels } from "@/lib/takeoff-types"
import { cn } from "@/lib/utils"

export const metadata = { title: "Takeoff details" }

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser(`/dashboard/jobs/${id}`)
  const { job, files, events } = await getCustomerJob(user.id, id)
  if (!job) notFound()

  const results = files.filter((file) => file.file_role !== "input")

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={job.free_sample ? "Free sample" : "Verified takeoff"}
        title={job.project_name}
        description={`Created ${formatDate(job.created_at)} · ${job.input_page_count ?? "—"} plan pages · ${job.quoted_credits} credits`}
        action={<JobStatus status={job.status} />}
      />

      {job.status === "failed" ? (
        <Alert variant="destructive">
          <AlertTitle>This job needs attention</AlertTitle>
          <AlertDescription>
            {job.failure_message ??
              "The processing team has been notified. Reserved credits will be released for system failures."}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Progress</CardTitle>
              <span className="font-mono text-sm text-muted-foreground">
                {job.progress}%
              </span>
            </CardHeader>
            <CardContent>
              <Progress value={job.progress} />
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[
                  ["Plan verified", true],
                  [
                    "Measured",
                    ["processing", "needs_review", "completed"].includes(
                      job.status
                    ),
                  ],
                  ["Output validated", job.status === "completed"],
                  ["Delivered", job.status === "completed"],
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
                  Current stage: {job.stage.replaceAll("_", " ")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deliverables</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {results.map((file) => {
                    const spreadsheet =
                      file.mime_type?.includes("spreadsheet") ||
                      file.original_filename.endsWith(".xlsx")
                    const Icon = spreadsheet
                      ? FileSpreadsheetIcon
                      : FileTextIcon
                    return (
                      <Link
                        key={file.id}
                        href={`/api/takeoff/jobs/${job.id}/download?file=${encodeURIComponent(file.id)}`}
                        className="flex items-center gap-3 border p-4 hover:border-primary"
                      >
                        <Icon className="size-5 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {file.original_filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Verified output
                          </p>
                        </div>
                        <DownloadIcon className="size-4 text-muted-foreground" />
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="border border-dashed p-8 text-center">
                  <ShieldCheckIcon className="mx-auto size-7 text-primary" />
                  <p className="mt-3 font-medium">Processing is still in progress</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Marked PDF, Excel quantities, source evidence, and
                    methodology will appear here when processing completes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scope</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Trades
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(job.trades ?? []).map((trade) => (
                    <Badge key={trade} variant="secondary">
                      {tradeLabels[trade]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Instructions
                </p>
                <p className="mt-2 leading-6">
                  {job.customer_notes || "No additional instructions."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Reserved</p>
                  <p className="mt-1 font-semibold">
                    {job.reserved_credits} credits
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Charged</p>
                  <p className="mt-1 font-semibold">
                    {job.consumed_credits} credits
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4 border-l pl-4">
                {events.map((event) => (
                  <li key={event.id} className="relative text-sm">
                    <span className="absolute -left-[1.31rem] top-1 size-2 rounded-full bg-primary" />
                    <p className="font-medium">
                      {event.message ?? event.event_type.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(event.created_at)}
                    </p>
                  </li>
                ))}
                {!events.length ? (
                  <li className="text-sm text-muted-foreground">
                    Activity will appear as the job moves through the queue.
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
              Request included correction
            </Link>
          ) : null}
        </div>
      </div>
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
