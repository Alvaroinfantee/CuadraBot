import Link from "next/link"
import { AdminHeader } from "@/components/admin/admin-ui"
import { JobStatus } from "@/components/takeoff/job-status"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAdminSnapshot } from "@/lib/admin-data"
import { tradeLabels } from "@/lib/takeoff-types"

export const metadata = { title: "Jobs and exceptions" }

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const [data, params] = await Promise.all([getAdminSnapshot(), searchParams])
  const jobs = params.status
    ? data.jobs.filter((job) => job.status === params.status)
    : data.jobs
  const profiles = new Map(data.profiles.map((profile) => [profile.id, profile]))

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Operations"
        title="Jobs and exceptions"
        body="Monitor the self-serve processing queue, investigate correction requests and failures, and see who owns every job."
        action={
          <div className="flex flex-wrap gap-2">
            {[
              ["", "All"],
              ["queued", "Queued"],
              ["processing", "Processing"],
              ["needs_review", "Review requested"],
              ["failed", "Failed"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={value ? `/admin/jobs?status=${value}` : "/admin/jobs"}
                className="border bg-white px-3 py-2 text-xs hover:border-primary"
              >
                {label}
              </Link>
            ))}
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        {data.statusCounts
          .filter((item) =>
            ["queued", "processing", "needs_review", "failed"].includes(
              item.status
            )
          )
          .map((item) => (
            <div key={item.status} className="border bg-white p-4">
              <p className="text-xs text-muted-foreground">
                {item.status.replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-2xl font-semibold">{item.count}</p>
            </div>
          ))}
      </div>

      <div className="overflow-hidden border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project / customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const owner = profiles.get(job.user_id)
              return (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {job.project_name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {owner?.company_name || owner?.email || job.user_id}
                    </p>
                  </TableCell>
                  <TableCell>
                    <JobStatus status={job.status} />
                    {job.free_sample ? (
                      <Badge variant="outline" className="ml-2">
                        Sample
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {(job.trades ?? [])
                      .map((trade) => tradeLabels[trade])
                      .join(", ") || "—"}
                  </TableCell>
                  <TableCell>{job.input_page_count}</TableCell>
                  <TableCell>
                    {job.consumed_credits || job.reserved_credits || job.quoted_credits}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {job.due_at ? formatDate(job.due_at) : "Not scheduled"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
