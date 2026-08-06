import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileLock2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"
import {
  finalizeDocumentArchiveDeletion,
  transitionDocumentArchive,
} from "@/app/admin/document-actions"
import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAdminDocumentArchive } from "@/lib/admin-document-archives"
import { cn } from "@/lib/utils"

export const metadata = { title: "Manage archived document" }

const updateMessages: Record<string, string> = {
  place_hold: "Legal hold placed and audited.",
  release_hold: "Legal hold released and audited.",
  request_deletion: "Deletion request recorded and customer download paused.",
  cancel_deletion: "Deletion request canceled and customer access restored.",
  delete_source:
    "Primary source removed, verified absent, and preserved as an audited tombstone.",
}

export default async function AdminDocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ updated?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const archive = await getAdminDocumentArchive(id)
  if (!archive) notFound()

  const available =
    archive.status !== "deleted" &&
    archive.status !== "deleting" &&
    archive.integrity_status !== "missing"

  return (
    <div className="space-y-8">
      <Link
        href="/admin/documents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to document archive
      </Link>

      <AdminHeader
        eyebrow="Secure source record"
        title={archive.original_filename}
        body={`${archive.customer_name ?? "Unknown customer"} · ${archive.project_name ?? "Unknown project"}`}
        action={
          available ? (
            <Link
              href={`/api/admin/documents/${archive.id}/download`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              <DownloadIcon />
              Audited download
            </Link>
          ) : null
        }
      />

      {query.updated && updateMessages[query.updated] ? (
        <Alert>
          <AlertTitle>Archive updated</AlertTitle>
          <AlertDescription>{updateMessages[query.updated]}</AlertDescription>
        </Alert>
      ) : null}

      {archive.integrity_status === "missing" ? (
        <Alert variant="destructive">
          <AlertTitle>Primary source object is missing</AlertTitle>
          <AlertDescription>
            Download is blocked and a critical data alert should be open.
            Investigate primary Storage and the independently managed backup.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric
          label="Lifecycle"
          value={archive.status.replaceAll("_", " ")}
          note={archive.legal_hold_at ? "Legal hold active" : "No legal hold"}
        />
        <AdminMetric
          label="Object presence"
          value={archive.integrity_status}
          note={`Checked ${formatDate(archive.last_check_attempt_at)}`}
        />
        <AdminMetric
          label="Plan set"
          value={`${archive.page_count.toLocaleString()} pages`}
          note={formatBytes(archive.size_bytes)}
        />
        <AdminMetric
          label="Archived"
          value={formatShortDate(archive.archived_at)}
          note={`Present ${formatDate(archive.last_verified_at)}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileLock2Icon className="size-5 text-primary" />
                Registry and provenance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Info label="Customer" value={archive.customer_email ?? "Unknown"} />
              <Info
                label="Project"
                value={
                  <Link
                    href={`/admin/jobs/${archive.job_id}`}
                    className="text-primary underline"
                  >
                    {archive.project_name ?? archive.job_id}
                  </Link>
                }
              />
              <Info label="MIME type" value={archive.mime_type} />
              <Info
                label="Archive ID"
                value={<code className="break-all text-xs">{archive.id}</code>}
              />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  SHA-256 fingerprint
                </p>
                <code className="mt-2 block break-all border bg-muted/30 p-3 text-xs">
                  {archive.sha256}
                </code>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <ShieldCheckIcon className="size-4" />
            <AlertTitle>Registry is not an independent backup</AlertTitle>
            <AlertDescription>
              This record protects the primary object from scheduled cleanup
              and detects absence. Disaster recovery requires a separately
              encrypted object backup and a checksum-verified restore drill.
            </AlertDescription>
          </Alert>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlertIcon className="size-5 text-blue-700" />
                Legal hold
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                A hold blocks final deletion without erasing a pending customer
                request. Every change requires a reason and is atomic with its
                audit entry.
              </p>
            </CardHeader>
            <CardContent>
              {archive.status === "deleted" ? (
                <p className="text-sm text-muted-foreground">
                  Deleted tombstones cannot be changed.
                </p>
              ) : archive.status === "deleting" ? (
                <Alert>
                  <AlertTitle>Deletion lease active</AlertTitle>
                  <AlertDescription>
                    Legal-hold and cancellation changes are paused until this
                    exact-path deletion finishes or its 15-minute lease can be
                    safely recovered.
                  </AlertDescription>
                </Alert>
              ) : (
                <ArchiveActionForm
                  archiveId={archive.id}
                  action={
                    archive.legal_hold_at ? "release_hold" : "place_hold"
                  }
                  label={
                    archive.legal_hold_at
                      ? "Release legal hold"
                      : "Place legal hold"
                  }
                  placeholder={
                    archive.legal_hold_at
                      ? "Case closed by authorized privacy owner"
                      : "Dispute or legal case reference"
                  }
                  variant="outline"
                />
              )}
              {archive.legal_hold_reason ? (
                <p className="mt-4 border-l-2 border-blue-400 pl-3 text-xs leading-5 text-muted-foreground">
                  Current reason: {archive.legal_hold_reason}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2Icon className="size-5 text-amber-700" />
                Controlled deletion request
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                This records the request and pauses customer download. It does
                not delete the PDF. Exact-path removal and tombstoning require
                a different active administrator.
              </p>
            </CardHeader>
            <CardContent>
              {archive.status === "deleted" ? (
                <div className="space-y-2 text-sm">
                  <Badge variant="secondary">Deleted tombstone</Badge>
                  <p className="text-muted-foreground">
                    {archive.deletion_reason}
                  </p>
                </div>
              ) : archive.status === "deletion_requested" ||
                archive.status === "deleting" ? (
                <div className="space-y-6">
                  {archive.status === "deletion_requested" ? (
                    <ArchiveActionForm
                      archiveId={archive.id}
                      action="cancel_deletion"
                      label="Cancel deletion request"
                      placeholder="Why the request is being canceled"
                      variant="outline"
                    />
                  ) : (
                    <Alert>
                      <AlertTitle>Deletion already in progress</AlertTitle>
                      <AlertDescription>
                        If an earlier attempt was interrupted, a second
                        administrator can safely retry after the 15-minute
                        deletion lease expires.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="border-t pt-6">
                    <h3 className="font-medium">Second-admin removal</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      A different active administrator must approve this step.
                      The server removes only the registered source path,
                      waits out the initial signed-upload window, verifies
                      absence, and creates the permanent audit tombstone. Any
                      independent backup follows its approved erasure or
                      expiry policy.
                    </p>
                    <form
                      action={finalizeDocumentArchiveDeletion}
                      className="mt-4 space-y-3"
                    >
                      <input
                        type="hidden"
                        name="archiveId"
                        value={archive.id}
                      />
                      <div className="space-y-2">
                        <Label htmlFor={`${archive.id}-final-reason`}>
                          Final deletion reason or case reference
                        </Label>
                        <Input
                          id={`${archive.id}-final-reason`}
                          name="reason"
                          minLength={5}
                          maxLength={500}
                          placeholder="Approved privacy case and second approver"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${archive.id}-confirmation`}>
                          Type DELETE SOURCE
                        </Label>
                        <Input
                          id={`${archive.id}-confirmation`}
                          name="confirmation"
                          autoComplete="off"
                          pattern="DELETE SOURCE"
                          required
                        />
                      </div>
                      <Button type="submit" variant="destructive">
                        Permanently delete primary source
                      </Button>
                    </form>
                  </div>
                </div>
              ) : archive.legal_hold_at ? (
                <Alert>
                  <AlertTitle>Deletion blocked by legal hold</AlertTitle>
                  <AlertDescription>
                    Release the hold only after the authorized owner confirms
                    that the obligation has ended.
                  </AlertDescription>
                </Alert>
              ) : (
                <ArchiveActionForm
                  archiveId={archive.id}
                  action="request_deletion"
                  label="Record deletion request"
                  placeholder="Verified privacy case or closure reference"
                  variant="destructive"
                />
              )}
              {archive.deletion_request_reason ? (
                <p className="mt-4 border-l-2 border-amber-400 pl-3 text-xs leading-5 text-muted-foreground">
                  Request reason: {archive.deletion_request_reason}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ArchiveActionForm({
  archiveId,
  action,
  label,
  placeholder,
  variant,
}: {
  archiveId: string
  action: string
  label: string
  placeholder: string
  variant: "outline" | "destructive"
}) {
  return (
    <form action={transitionDocumentArchive} className="space-y-3">
      <input type="hidden" name="archiveId" value={archiveId} />
      <input type="hidden" name="archiveAction" value={action} />
      <div className="space-y-2">
        <Label htmlFor={`${archiveId}-${action}`}>Reason or case reference</Label>
        <Input
          id={`${archiveId}-${action}`}
          name="reason"
          minLength={5}
          maxLength={500}
          placeholder={placeholder}
          required
        />
      </div>
      <Button type="submit" variant={variant}>
        {label}
      </Button>
    </form>
  )
}

function Info({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium">{value}</span>
    </div>
  )
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value.toLocaleString()} B`
  const units = ["KB", "MB", "GB", "TB"]
  let amount = value / 1_024
  let unit = 0
  while (amount >= 1_024 && unit < units.length - 1) {
    amount /= 1_024
    unit += 1
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unit]}`
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}
