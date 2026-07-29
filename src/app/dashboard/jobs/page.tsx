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
import {
  dashboardCopy,
  formatDashboardDate,
  formatDashboardNumber,
} from "@/lib/dashboard-i18n"
import { getRequestLocale } from "@/lib/i18n-server"
import { localizedTradeLabels } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: dashboardCopy[locale].metadata.jobs }
}

export default async function JobsPage() {
  const user = await requireUser("/dashboard/jobs")
  const [{ jobs }, locale] = await Promise.all([
    getCustomerWorkspace(user.id),
    getRequestLocale(),
  ])
  const copy = dashboardCopy[locale].jobs

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={
          <Link
            href="/dashboard/new"
            className={cn(buttonVariants(), "gap-2")}
          >
            <FilePlus2Icon />
            {copy.newTakeoff}
          </Link>
        }
      />
      <div className="overflow-hidden border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.project}</TableHead>
              <TableHead>{copy.status}</TableHead>
              <TableHead>{copy.scope}</TableHead>
              <TableHead>{copy.pages}</TableHead>
              <TableHead>{copy.credits}</TableHead>
              <TableHead>{copy.created}</TableHead>
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
                  <JobStatus status={job.status} locale={locale} />
                </TableCell>
                <TableCell className="max-w-xs text-xs text-muted-foreground">
                  {(job.trades ?? [])
                    .map((trade) => localizedTradeLabels[locale][trade])
                    .join(", ") || "—"}
                </TableCell>
                <TableCell>
                  {job.input_page_count === null
                    ? "—"
                    : formatDashboardNumber(job.input_page_count, locale)}
                </TableCell>
                <TableCell>
                  {formatDashboardNumber(
                    job.consumed_credits || job.quoted_credits,
                    locale
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDashboardDate(job.created_at, locale)}
                </TableCell>
              </TableRow>
            ))}
            {!jobs.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  {copy.empty}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
