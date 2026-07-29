import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  CoinsIcon,
  FilePlus2Icon,
  FilesIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { JobStatus } from "@/components/takeoff/job-status"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { requireUser } from "@/lib/auth"
import { getCustomerWorkspace } from "@/lib/customer-dashboard"
import { cn } from "@/lib/utils"

export const metadata = { title: "Workspace" }

export default async function DashboardPage() {
  const user = await requireUser("/dashboard")
  const { credits, jobs, subscription } = await getCustomerWorkspace(user.id)
  const activeJobs = jobs.filter((job) =>
    ["queued", "processing", "needs_review"].includes(job.status)
  )
  const completedJobs = jobs.filter((job) => job.status === "completed")
  const recentJobs = jobs.slice(0, 5)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Customer workspace"
        title="Your takeoff desk"
        description="Submit scaled plan sets, follow automated measurement, and download source-linked quantities when processing finishes."
        action={
          <Link
            href="/dashboard/new"
            className={cn(buttonVariants({ size: "lg" }), "gap-2")}
          >
            <FilePlus2Icon />
            New takeoff
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Available credits"
          value={credits.balance.toLocaleString()}
          note={`${credits.lifetime_consumed.toLocaleString()} used all time`}
          icon={CoinsIcon}
        />
        <Metric
          label="In progress"
          value={String(activeJobs.length)}
          note="Self-serve processing queue"
          icon={Clock3Icon}
        />
        <Metric
          label="Delivered"
          value={String(completedJobs.length)}
          note="Marked PDF and workbook"
          icon={CheckCircle2Icon}
        />
        <Metric
          label="Billing plan"
          value={subscription ? "Active" : "Pay as you go"}
          note={
            subscription?.cancel_at_period_end
              ? "Cancels at period end"
              : "No seat license required"
          }
          icon={ShieldCheckIcon}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent takeoffs</CardTitle>
            <Link
              href="/dashboard/jobs"
              className="text-sm font-medium text-primary"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentJobs.length ? (
              <div className="divide-y border-y">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}`}
                    className="grid gap-4 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:items-center sm:px-2"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">
                          {job.project_name}
                        </p>
                        <JobStatus status={job.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.input_page_count ?? "—"} pages ·{" "}
                        {job.trades?.length ?? 0} trade
                        {(job.trades?.length ?? 0) === 1 ? "" : "s"} ·{" "}
                        {formatDate(job.created_at)}
                      </p>
                      {job.status === "processing" ? (
                        <Progress
                          value={job.progress}
                          className="mt-3 h-1.5 max-w-md"
                        />
                      ) : null}
                    </div>
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyTakeoffs />
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0b1f3a] text-white">
          <CardHeader>
            <Badge className="w-fit bg-blue-400/15 text-blue-200">
              Included once per company
            </Badge>
            <CardTitle className="pt-4 text-2xl">Try one sheet free</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-slate-300">
              Pick one launch trade and one plan sheet. We will return a marked
              PDF and quantity workbook through the same automated workflow as
              paid work.
            </p>
            <Link
              href="/dashboard/new?mode=sample"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "w-full justify-between"
              )}
            >
              Start free sample
              <ArrowRightIcon />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string
  value: string
  note: string
  icon: typeof CoinsIcon
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="size-4 text-primary" />
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}

function EmptyTakeoffs() {
  return (
    <div className="grid min-h-64 place-items-center border border-dashed p-8 text-center">
      <div>
        <FilesIcon className="mx-auto size-8 text-primary" />
        <p className="mt-4 font-medium">No takeoffs yet</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Upload your first scaled PDF plan set to receive a fixed credit quote.
        </p>
        <Link
          href="/dashboard/new"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          Create a takeoff <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}
