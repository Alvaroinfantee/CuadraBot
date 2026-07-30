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
import {
  dashboardCopy,
  formatDashboardDate,
  formatDashboardNumber,
  formatPlanPages,
  formatTrades,
} from "@/lib/dashboard-i18n"
import { getRequestLocale } from "@/lib/i18n-server"
import type { Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: dashboardCopy[locale].metadata.workspace }
}

export default async function DashboardPage() {
  const user = await requireUser("/dashboard")
  const [{ credits, jobs, subscription }, locale] = await Promise.all([
    getCustomerWorkspace(user.id),
    getRequestLocale(),
  ])
  const copy = dashboardCopy[locale].overview
  const activeJobs = jobs.filter((job) =>
    ["queued", "processing", "needs_review"].includes(job.status)
  )
  const completedJobs = jobs.filter((job) => job.status === "completed")
  const recentJobs = jobs.slice(0, 5)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={
          <Link
            href="/dashboard/new"
            className={cn(buttonVariants({ size: "lg" }), "gap-2")}
          >
            <FilePlus2Icon />
            {copy.newTakeoff}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={copy.availableCredits}
          value={formatDashboardNumber(credits.balance, locale)}
          note={`${formatDashboardNumber(
            credits.lifetime_consumed,
            locale
          )} ${copy.usedAllTime}`}
          icon={CoinsIcon}
        />
        <Metric
          label={copy.inProgress}
          value={formatDashboardNumber(activeJobs.length, locale)}
          note={copy.processingQueue}
          icon={Clock3Icon}
        />
        <Metric
          label={copy.delivered}
          value={formatDashboardNumber(completedJobs.length, locale)}
          note={copy.deliveredNote}
          icon={CheckCircle2Icon}
        />
        <Metric
          label={copy.billingPlan}
          value={subscription ? copy.active : copy.payAsYouGo}
          note={
            subscription?.cancel_at_period_end
              ? copy.cancelsAtPeriodEnd
              : copy.noSeatLicense
          }
          icon={ShieldCheckIcon}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{copy.recentTakeoffs}</CardTitle>
            <Link
              href="/dashboard/jobs"
              className="text-sm font-medium text-primary"
            >
              {copy.viewAll}
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
                        <JobStatus status={job.status} locale={locale} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.input_page_count === null
                          ? "—"
                          : formatPlanPages(job.input_page_count, locale)}{" "}
                        · {formatTrades(job.trades?.length ?? 0, locale)} ·{" "}
                        {formatDashboardDate(job.created_at, locale)}
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
              <EmptyTakeoffs locale={locale} />
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0b1f3a] text-white">
          <CardHeader>
            <Badge className="w-fit bg-blue-400/15 text-blue-200">
              {copy.sampleBadge}
            </Badge>
            <CardTitle className="pt-4 text-2xl">
              {copy.sampleTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-slate-300">
              {copy.sampleBody}
            </p>
            <Link
              href="/dashboard/new?mode=sample"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "w-full justify-between"
              )}
            >
              {copy.sampleCta}
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

function EmptyTakeoffs({ locale }: { locale: Locale }) {
  const copy = dashboardCopy[locale].overview
  return (
    <div className="grid min-h-64 place-items-center border border-dashed p-8 text-center">
      <div>
        <FilesIcon className="mx-auto size-8 text-primary" />
        <p className="mt-4 font-medium">{copy.emptyTitle}</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {copy.emptyBody}
        </p>
        <Link
          href="/dashboard/new"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          {copy.emptyCta} <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </div>
  )
}
