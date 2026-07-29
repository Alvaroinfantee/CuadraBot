import Link from "next/link"
import { DownloadIcon, FileLock2Icon, ShieldCheckIcon } from "lucide-react"
import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  adminDocumentArchiveStatuses,
  getAdminDocumentArchives,
} from "@/lib/admin-document-archives"
import { cn } from "@/lib/utils"

export const metadata = { title: "Secure document archive" }

const statusLabels: Record<string, string> = {
  retained: "Retained",
  legal_hold: "Legal hold",
  deletion_requested: "Deletion requested",
  deleting: "Deletion in progress",
  missing: "Missing",
  deleted: "Deleted",
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const data = await getAdminDocumentArchives(params.status, params.page)

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Data protection"
        title="Secure document archive"
        body="See every original source plan retained by Cuadrabot, spot integrity issues, and retrieve a short-lived admin copy when support or recovery requires it."
        action={
          <div className="flex flex-wrap gap-2">
            <FilterLink href="/admin/documents" active={!data.selectedStatus}>
              All
            </FilterLink>
            {adminDocumentArchiveStatuses.map((status) => (
              <FilterLink
                key={status}
                href={`/admin/documents?status=${status}`}
                active={data.selectedStatus === status}
              >
                {statusLabels[status]}
              </FilterLink>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminMetric
          label="Stored source plans"
          value={data.counts.stored.toLocaleString()}
          note={`${data.counts.registered.toLocaleString()} active registry records · ${data.counts.total.toLocaleString()} including tombstones`}
        />
        <AdminMetric
          label="Private storage used"
          value={formatBytes(data.counts.storageBytes)}
          note="Last-confirmed present original PDFs"
        />
        <AdminMetric
          label="Protected registry paths"
          value={data.counts.protected.toLocaleString()}
          note={`${data.counts.legalHold.toLocaleString()} under legal hold · missing paths stay protected`}
        />
        <AdminMetric
          label="Deletion requests"
          value={data.counts.deletionRequested.toLocaleString()}
          note="Waiting for controlled removal"
        />
        <AdminMetric
          label="Missing files"
          value={data.counts.missing.toLocaleString()}
          note="Investigate immediately"
        />
        <AdminMetric
          label="Verification overdue"
          value={data.counts.overdueVerification.toLocaleString()}
          note="Not checked in more than 8 days"
        />
      </div>

      <Card className="border-blue-200 bg-blue-50/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-blue-700" />
            How the archive is protected
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-3">
          <p>
            Original PDFs stay in private storage. The database keeps ownership,
            lifecycle, file size, page count, and a SHA-256 integrity fingerprint.
          </p>
          <p>
            Admin downloads are authorized again on every request and use a
            signed link that expires after five minutes.
          </p>
          <p>
            “Missing” requires investigation. “Deleted” keeps the audit record
            and reason but no longer offers file access.
          </p>
        </CardContent>
      </Card>

      <div className="overflow-x-auto border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document / customer</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>File details</TableHead>
              <TableHead>Integrity</TableHead>
              <TableHead>Archived</TableHead>
              <TableHead className="text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.archives.map((archive) => (
              <TableRow key={archive.id}>
                <TableCell className="max-w-xs">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
                      <FileLock2Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {archive.original_filename}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {archive.customer_name ?? "Unknown customer"}
                      </p>
                      {archive.customer_email &&
                      archive.customer_email !== archive.customer_name ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {archive.customer_email}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-52">
                  <Link
                    href={`/admin/jobs/${archive.job_id}`}
                    className="block truncate font-medium hover:text-primary"
                  >
                    {archive.project_name ?? "Open job"}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {archive.job_status?.replaceAll("_", " ") ?? "Status unknown"}
                  </p>
                </TableCell>
                <TableCell>
                  <ArchiveStatus
                    status={archive.status}
                    integrityStatus={archive.integrity_status}
                    legalHold={Boolean(archive.legal_hold_at)}
                  />
                  {archive.deletion_reason ||
                  archive.deletion_request_reason ||
                  archive.legal_hold_reason ? (
                    <p
                      className="mt-2 max-w-48 text-xs text-muted-foreground"
                      title={
                        archive.deletion_reason ??
                        archive.deletion_request_reason ??
                        archive.legal_hold_reason ??
                        undefined
                      }
                    >
                      {archive.deletion_reason ??
                        archive.deletion_request_reason ??
                        archive.legal_hold_reason}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <p>{formatBytes(archive.size_bytes)}</p>
                  <p className="mt-1">
                    {archive.page_count.toLocaleString()} page
                    {archive.page_count === 1 ? "" : "s"}
                  </p>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <p title={archive.sha256} className="font-mono">
                    {archive.sha256.slice(0, 12)}…
                  </p>
                  <p className="mt-1">
                    Present {formatDate(archive.last_verified_at)}
                  </p>
                  <p className="mt-1">
                    Checked {formatDate(archive.last_check_attempt_at)}
                  </p>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(archive.archived_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-2">
                    {archive.deleted_at ||
                    archive.status === "deleting" ||
                    archive.integrity_status === "missing" ? (
                      <span className="text-xs text-muted-foreground">
                        Unavailable
                      </span>
                    ) : (
                      <Button
                        render={
                          <Link
                            href={`/api/admin/documents/${archive.id}/download`}
                          />
                        }
                        size="sm"
                        variant="outline"
                      >
                        <DownloadIcon />
                        Download
                      </Button>
                    )}
                    <Link
                      href={`/admin/documents/${archive.id}`}
                      className="text-xs font-medium text-primary underline"
                    >
                      Manage
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!data.archives.length ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  No documents match this archive view.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>
          Showing {formatRange(data.pagination)} of{" "}
          {data.pagination.totalRows.toLocaleString()} matching document
          {data.pagination.totalRows === 1 ? "" : "s"}
          {data.selectedStatus
            ? ` with status “${statusLabels[data.selectedStatus]}”.`
            : "."}
        </p>
        <div className="flex items-center gap-2">
          <PageLink
            page={data.pagination.page - 1}
            status={data.selectedStatus}
            disabled={data.pagination.page <= 1}
          >
            Previous
          </PageLink>
          <span>
            Page {data.pagination.page.toLocaleString()} of{" "}
            {data.pagination.totalPages.toLocaleString()}
          </span>
          <PageLink
            page={data.pagination.page + 1}
            status={data.selectedStatus}
            disabled={
              data.pagination.page >= data.pagination.totalPages
            }
          >
            Next
          </PageLink>
        </div>
      </div>
    </div>
  )
}

function PageLink({
  page,
  status,
  disabled,
  children,
}: {
  page: number
  status: string | null
  disabled: boolean
  children: React.ReactNode
}) {
  const query = new URLSearchParams()
  if (status) query.set("status", status)
  query.set("page", String(Math.max(1, page)))
  return disabled ? (
    <span className="border px-3 py-2 text-muted-foreground/50">
      {children}
    </span>
  ) : (
    <Link
      href={`/admin/documents?${query.toString()}`}
      className="border bg-white px-3 py-2 text-foreground hover:border-primary"
    >
      {children}
    </Link>
  )
}

function formatRange(pagination: {
  page: number
  pageSize: number
  totalRows: number
}) {
  if (!pagination.totalRows) return "0"
  const first = (pagination.page - 1) * pagination.pageSize + 1
  const last = Math.min(
    pagination.page * pagination.pageSize,
    pagination.totalRows
  )
  return `${first.toLocaleString()}–${last.toLocaleString()}`
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "border px-3 py-2 text-xs",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-white hover:border-primary"
      )}
    >
      {children}
    </Link>
  )
}

function ArchiveStatus({
  status,
  integrityStatus,
  legalHold,
}: {
  status: string
  integrityStatus: string
  legalHold: boolean
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge
        variant="secondary"
        className={cn(
          status === "retained" && "text-emerald-700",
          status === "legal_hold" && "text-blue-700",
          status === "deletion_requested" && "text-amber-700",
          status === "deleting" && "text-orange-700",
          status === "deleted" && "text-slate-600"
        )}
      >
        {statusLabels[status] ?? status.replaceAll("_", " ")}
      </Badge>
      {integrityStatus === "missing" ? (
        <Badge variant="destructive">Missing</Badge>
      ) : null}
      {legalHold ? <Badge variant="secondary">Legal hold</Badge> : null}
    </div>
  )
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) return "Unknown size"
  if (value < 1_024) return `${value.toLocaleString()} B`

  const units = ["KB", "MB", "GB", "TB"]
  let amount = value / 1_024
  let unitIndex = 0
  while (amount >= 1_024 && unitIndex < units.length - 1) {
    amount /= 1_024
    unitIndex += 1
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: amount >= 10 ? 1 : 2,
  }).format(amount)} ${units[unitIndex]}`
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
