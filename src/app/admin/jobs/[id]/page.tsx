import Link from "next/link"
import { notFound } from "next/navigation"
import {
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  RotateCcwIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react"
import { reviewTakeoff } from "@/app/admin/actions"
import { AdminHeader } from "@/components/admin/admin-ui"
import { JobStatus } from "@/components/takeoff/job-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { tradeLabels } from "@/lib/takeoff-types"

export const metadata = { title: "Admin takeoff detail" }

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createSupabaseAdminClient()
  const [jobResult, profileResult, filesResult, eventsResult, archiveResult] =
    await Promise.all([
    supabase.from("takeoff_jobs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("takeoff_jobs")
      .select("user_id")
      .eq("id", id)
      .maybeSingle()
      .then(async ({ data }) =>
        data
          ? supabase
              .from("profiles")
              .select("id,email,full_name,company_name,status")
              .eq("id", data.user_id)
              .maybeSingle()
          : { data: null, error: null }
      ),
    supabase
      .from("takeoff_files")
      .select("*")
      .eq("job_id", id)
      .order("created_at"),
    supabase
      .from("takeoff_job_events")
      .select("*")
      .eq("job_id", id)
      .order("created_at"),
    supabase
      .from("document_archives")
      .select(
        "id,original_filename,size_bytes,page_count,sha256,status,integrity_status,archived_at"
      )
      .eq("job_id", id)
      .maybeSingle(),
  ])
  const job = jobResult.data
  if (!job) notFound()
  const profile = profileResult.data
  const files = filesResult.data ?? []
  const events = eventsResult.data ?? []
  const archive = archiveResult.data
  const metrics =
    job.result_summary &&
    typeof job.result_summary === "object" &&
    "metrics" in job.result_summary
      ? (job.result_summary.metrics as Record<string, unknown>)
      : {}

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Takeoff operations"
        title={job.project_name}
        body={`${profile?.company_name || profile?.email || "Unknown customer"} · ${job.input_page_count} pages · ${job.quoted_credits} credits`}
        action={<JobStatus status={job.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Job evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {archive ? (
                  <Link
                    href={
                      archive.status !== "deleted" &&
                      archive.status !== "deleting" &&
                      archive.integrity_status !== "missing"
                        ? `/api/admin/documents/${archive.id}/download`
                        : `/admin/documents/${archive.id}`
                    }
                    className="flex items-center gap-3 border border-emerald-200 bg-emerald-50/40 p-4 hover:border-primary"
                  >
                    <FileTextIcon className="size-5 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {archive.original_filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        archived original · {archive.page_count} pages ·{" "}
                        {archive.integrity_status === "missing"
                          ? "missing"
                          : `${archive.sha256.slice(0, 10)}…`}
                      </p>
                    </div>
                    {archive.status !== "deleted" &&
                    archive.status !== "deleting" &&
                    archive.integrity_status !== "missing" ? (
                      <DownloadIcon className="size-4 text-muted-foreground" />
                    ) : null}
                  </Link>
                ) : null}
                {files
                  .filter((file) => file.file_role !== "input")
                  .map((file) => {
                  const spreadsheet = file.original_filename.endsWith(".xlsx")
                  const Icon = spreadsheet ? FileSpreadsheetIcon : FileTextIcon
                  const attemptToken = resultAttemptToken(file.storage_path)
                  const attemptLabel =
                    file.file_role === "input"
                      ? "source plan"
                      : attemptToken === job.claim_token
                        ? "current attempt"
                        : attemptToken
                          ? `historical attempt ${attemptToken.slice(0, 8)}`
                          : "historical output"
                  return (
                    <Link
                      key={file.id}
                      href={`/api/admin/takeoff/jobs/${job.id}/download?file=${file.id}`}
                      className="flex items-center gap-3 border p-4 hover:border-primary"
                    >
                      <Icon className="size-5 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {file.original_filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.file_role} · {attemptLabel} ·{" "}
                          {file.sha256 ? `${file.sha256.slice(0, 10)}…` : "unverified"}
                        </p>
                      </div>
                      <DownloadIcon className="size-4 text-muted-foreground" />
                    </Link>
                  )
                  })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Processor metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="border p-4">
                    <p className="text-xs text-muted-foreground">
                      {key.replaceAll("_", " ")}
                    </p>
                    <p className="mt-2 text-xl font-semibold">{String(value)}</p>
                  </div>
                ))}
                {!Object.keys(metrics).length ? (
                  <p className="text-sm text-muted-foreground">
                    Processor metrics have not arrived yet.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4 border-l pl-5">
                {events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[1.5rem] top-1.5 size-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium">
                      {event.message ?? event.event_type.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.actor_type} · {formatDate(event.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scope and customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div className="flex flex-wrap gap-2">
                {(job.trades ?? []).map((trade: keyof typeof tradeLabels) => (
                  <Badge key={trade} variant="secondary">
                    {tradeLabels[trade]}
                  </Badge>
                ))}
              </div>
              <Info label="Customer" value={profile?.email ?? "Unknown"} />
              <Info label="Account" value={profile?.status ?? "Unknown"} />
              <Info label="Stage" value={job.stage ?? "—"} />
              <Info label="Worker" value={job.claimed_by ?? "Unclaimed"} />
              <Info label="Processor job" value={job.processor_job_id ?? "—"} />
              <Info label="Due" value={job.due_at ? formatDate(job.due_at) : "Not scheduled"} />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Customer notes
                </p>
                <p className="mt-2 leading-6">
                  {job.customer_notes || "No customer note."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Correction or exception decision</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={reviewTakeoff} className="space-y-4">
                <input type="hidden" name="jobId" value={job.id} />
                <Textarea
                  name="notes"
                  rows={5}
                  defaultValue={job.qa_notes ?? ""}
                  placeholder="Document the correction, exception, or reason for another pass."
                />
                <div className="grid gap-2">
                  <Button
                    type="submit"
                    name="decision"
                    value="approve"
                    disabled={job.status !== "needs_review"}
                  >
                    <SendIcon />
                    Resolve and deliver
                  </Button>
                  <Button
                    type="submit"
                    name="decision"
                    value="requeue"
                    variant="outline"
                    disabled={job.status !== "needs_review"}
                  >
                    <RotateCcwIcon />
                    Return for another pass
                  </Button>
                  <Button
                    type="submit"
                    name="decision"
                    value="cancel"
                    variant="outline"
                    disabled={["completed", "canceled"].includes(job.status)}
                  >
                    <XCircleIcon />
                    Cancel and release credits
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function resultAttemptToken(storagePath: string) {
  const marker = "/results/"
  const markerIndex = storagePath.indexOf(marker)
  if (markerIndex < 0) return null

  return storagePath.slice(markerIndex + marker.length).split("/", 1)[0] || null
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
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
