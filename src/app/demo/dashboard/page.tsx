import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  CoinsIcon,
  FilePlus2Icon,
  ShieldCheckIcon,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PageHeader } from "@/components/dashboard/page-header"
import { JobStatus } from "@/components/takeoff/job-status"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { canShowDemo } from "@/lib/demo"
import { cn } from "@/lib/utils"

const jobs = [
  {
    id: "demo-1",
    name: "Riverside retail fit-out",
    status: "queued" as const,
    detail: "18 pages · both legend-based outputs · queued now",
    progress: 10,
  },
  {
    id: "demo-2",
    name: "North Loop office",
    status: "processing" as const,
    detail: "10 pages · electrical fixtures · 99 credits",
    progress: 62,
  },
  {
    id: "demo-3",
    name: "Pine Street apartments",
    status: "completed" as const,
    detail: "25 pages · legend-coded devices · delivered Jul 26",
    progress: 100,
  },
] as const

export default function DemoDashboardPage() {
  if (!canShowDemo()) notFound()

  return (
    <DashboardShell
      name="Alex Estimator"
      company="Northstar Contractors"
      credits={681}
      isAdmin
      demo
    >
      <div className="mb-6 flex items-center justify-between border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <span>Preview mode — sample data only.</span>
        <Link href="/demo" className="font-medium underline">
          Exit preview
        </Link>
      </div>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Customer workspace"
          title="Your takeoff desk"
          description="Submit PDF plans with readable legends, follow automated code mapping and counting, then download source-linked quantities in hours."
          action={
            <Link
              href="/demo/new"
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              <FilePlus2Icon />
              New takeoff
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DemoMetric label="Available credits" value="681" note="780 granted this cycle" icon={CoinsIcon} />
          <DemoMetric label="In progress" value="2" note="Self-serve processing queue" icon={Clock3Icon} />
          <DemoMetric label="Delivered" value="14" note="Across 9 projects" icon={CheckCircle2Icon} />
          <DemoMetric label="Billing plan" value="Team" note="780 credits / month" icon={ShieldCheckIcon} />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <Card>
            <CardHeader>
              <CardTitle>Recent takeoffs</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{job.name}</p>
                      <JobStatus status={job.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{job.detail}</p>
                    {job.status === "processing" ? (
                      <Progress value={job.progress} className="mt-3 h-1.5 max-w-md" />
                    ) : null}
                  </div>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-[#0b1f3a] text-white">
            <CardHeader>
              <Badge className="w-fit bg-blue-400/15 text-blue-200">
                Delivery ready
              </Badge>
              <CardTitle className="pt-4">Pine Street apartments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-300">
                Marked PDF, Excel workbook, evidence JSON, and methodology are
                available in the private project page.
              </p>
              <div className="mt-5 flex items-start gap-2 border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-100">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
                Original 25-page plan securely archived with a registered
                checksum and customer download access.
              </div>
              <button className="mt-6 w-full border border-white/20 px-4 py-2 text-sm">
                View deliverables
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}

function DemoMetric({
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="size-4 text-primary" />
        </div>
        <p className="mt-3 text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}
