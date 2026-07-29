import Link from "next/link"
import { FilePlus2Icon } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { JobStatus } from "@/components/takeoff/job-status"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireUser } from "@/lib/auth"
import { getCustomerWorkspace } from "@/lib/customer-dashboard"
import { tradeLabels } from "@/lib/takeoff-types"
import { cn } from "@/lib/utils"

export const metadata = { title: "Takeoffs" }

export default async function JobsPage() {
  const user = await requireUser("/dashboard/jobs")
  const { jobs } = await getCustomerWorkspace(user.id)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Project register"
        title="Takeoffs"
        description="Every plan set, status transition, credit charge, and verified deliverable in one place."
        action={
          <Link
            href="/dashboard/new"
            className={cn(buttonVariants(), "gap-2")}
          >
            <FilePlus2Icon />
            New takeoff
          </Link>
        }
      />
      <div className="overflow-hidden border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {job.project_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <JobStatus status={job.status} />
                </TableCell>
                <TableCell className="max-w-xs text-xs text-muted-foreground">
                  {(job.trades ?? [])
                    .map((trade) => tradeLabels[trade])
                    .join(", ") || "—"}
                </TableCell>
                <TableCell>{job.input_page_count ?? "—"}</TableCell>
                <TableCell>{job.consumed_credits || job.quoted_credits}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(job.created_at))}
                </TableCell>
              </TableRow>
            ))}
            {!jobs.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  No takeoffs yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
