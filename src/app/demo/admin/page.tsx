import Link from "next/link"
import { notFound } from "next/navigation"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  FileLock2Icon,
  ShieldCheckIcon,
} from "lucide-react"
import { AdminShell } from "@/components/admin/admin-shell"
import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { canShowDemo } from "@/lib/demo"

const funnel = [
  ["Draft created", 214],
  ["Verified quote", 176],
  ["Credits confirmed", 79],
  ["Automation complete", 74],
  ["Delivered", 68],
] as const

const weeks = [
  ["Jun 02", 8],
  ["Jun 09", 11],
  ["Jun 16", 9],
  ["Jun 23", 15],
  ["Jun 30", 17],
  ["Jul 07", 19],
  ["Jul 14", 22],
  ["Jul 21", 27],
] as const

export default function DemoAdminPage() {
  if (!canShowDemo()) notFound()
  const maxJobs = Math.max(...weeks.map((week) => week[1]))

  return (
    <AdminShell adminName="Operations Manager" demo>
      <div className="mb-6 flex items-center justify-between border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <span>Preview mode — realistic sample data, no administrative writes.</span>
        <Link href="/demo" className="font-medium underline">
          Exit preview
        </Link>
      </div>
      <div id="overview" className="space-y-8">
        <AdminHeader
          eyebrow="Operating overview"
          title="What needs attention today"
          body="Growth, revenue, job volume, delivery quality, customer geography, and launch readiness in plain language."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetric label="Total users" value="1,284" note="+146 in 30 days" trend={18.2} />
          <AdminMetric label="Active subscriptions" value="94" note="+11 net in 30 days" trend={11} />
          <AdminMetric label="Monthly recurring revenue" value="$38,506" note="Active paid plan value" />
          <AdminMetric label="30-day takeoff revenue" value="$52,840" note="Packs, plans, and first jobs" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Card>
            <CardHeader>
              <CardTitle>Weekly takeoff volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-3 border-b border-l px-3 pt-6">
                {weeks.map(([label, jobs]) => (
                  <div key={label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                    <div className="bg-primary" style={{ height: `${(jobs / maxJobs) * 100}%` }} />
                    <p className="truncate text-center text-[10px] text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Small label="Jobs / 30 days" value="85" />
                <Small label="Pages / 30 days" value="1,146" />
                <Small label="Units counted" value="24,809" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Launch readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Status icon={CheckCircle2Icon} title="Stripe catalog" body="All six prices connected" tone="green" />
              <Status icon={CheckCircle2Icon} title="Database and storage" body="Healthy and current" tone="green" />
              <Status icon={AlertTriangleIcon} title="Processing queue" body="2 jobs approaching SLA" tone="amber" />
              <Status icon={CircleAlertIcon} title="Unit economics" body="Processor cost feed missing" tone="red" />
              <Status icon={CheckCircle2Icon} title="Webhook events" body="No failed events" tone="green" />
            </CardContent>
          </Card>
        </div>

        <div id="growth" className="grid scroll-mt-20 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>30-day funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {funnel.map(([label, count], index) => {
                const rate = (count / funnel[0][1]) * 100
                return (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>{index + 1}. {label}</span>
                      <strong>{count} · {rate.toFixed(0)}%</strong>
                    </div>
                    <Progress value={rate} />
                  </div>
                )
              })}
            </CardContent>
          </Card>
          <Card id="geography">
            <CardHeader>
              <CardTitle>Top customer markets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ["US · Florida", 284],
                ["US · Texas", 197],
                ["Spain · Madrid", 141],
                ["US · California", 128],
                ["United Kingdom · England", 92],
              ].map(([market, users]) => (
                <div key={String(market)} className="grid grid-cols-[1fr_1fr_50px] items-center gap-3 text-sm">
                  <span>{market}</span>
                  <div className="h-2 bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${(Number(users) / 284) * 100}%` }} />
                  </div>
                  <strong className="text-right">{users}</strong>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div id="quality" className="grid scroll-mt-20 gap-4 sm:grid-cols-3">
          <AdminMetric label="On-time delivery" value="96.4%" note="Target ≥ 95%" />
          <AdminMetric label="Automation failure rate" value="2.3%" note="Target < 5%" />
          <AdminMetric label="Correction request rate" value="6.8%" note="First-pass acceptance 93.2%" />
        </div>

        <section id="documents" className="scroll-mt-20 space-y-5">
          <AdminHeader
            eyebrow="Data protection"
            title="Secure document archive"
            body="Every verified original plan is indexed in the database and retained in private object storage, separate from generated-file cleanup."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetric
              label="Stored source plans"
              value="1,946"
              note="Across all customer projects"
            />
            <AdminMetric
              label="Private storage used"
              value="38.7 GB"
              note="Original verified PDFs"
            />
            <AdminMetric
              label="Presence confirmed"
              value="100%"
              note="Last daily check"
            />
            <AdminMetric
              label="Missing files"
              value="0"
              note="No integrity alerts"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon className="size-5 text-emerald-600" />
                Recent archived originals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                [
                  "Riverside-retail-plans.pdf",
                  "Northstar Contractors",
                  "18 pages · 42.8 MB",
                  "Retained",
                ],
                [
                  "Pine-Street-A100-A601.pdf",
                  "Horizon Build Group",
                  "25 pages · 61.4 MB",
                  "Retained",
                ],
                [
                  "Calle-Alcala-reforma.pdf",
                  "Estudio Obra Madrid",
                  "12 pages · 28.1 MB",
                  "Legal hold",
                ],
              ].map(([filename, customer, detail, status]) => (
                <div
                  key={filename}
                  className="grid gap-3 border p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center bg-blue-50 text-blue-700">
                      <FileLock2Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{filename}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {detail} · SHA-256 registered
                      </p>
                    </div>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {customer}
                  </p>
                  <Badge variant="secondary">{status}</Badge>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Live admin downloads use an audited link that expires after
                five minutes. Preview mode never exposes a real file.
              </p>
            </CardContent>
          </Card>
        </section>

        <Card id="health" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Open operational alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["warning", "2 jobs running beyond the hourly target", "Jobs & operations"],
              ["critical", "Processor cost feed is not configured", "Unit economics"],
              ["info", "3 new customer correction requests", "Quality"],
            ].map(([severity, title, area]) => (
              <div key={title} className="flex items-center gap-3 border p-4">
                <Badge variant="secondary">{severity}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{area}</p>
                </div>
                <button className="text-xs font-medium text-primary">Review</button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div id="users" className="scroll-mt-20 border bg-white p-6">
          <h2 className="text-xl font-semibold">Management areas in the live panel</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Users & account access",
              "Jobs & exception decisions",
              "Plans, payments & credits",
              "Funnel & repeat use",
              "Country & region",
              "Quality & turnaround",
              "Security & data requests",
              "Settings & audit log",
            ].map((area) => (
              <div key={area} className="border p-3 text-sm">{area}</div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div className="border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  )
}

function Status({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: typeof CheckCircle2Icon
  title: string
  body: string
  tone: "green" | "amber" | "red"
}) {
  const color = tone === "green" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-red-600"
  return (
    <div className="flex gap-3 border-b pb-3">
      <Icon className={`mt-0.5 size-4 ${color}`} />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
