import { AdminHeader, AdminMetric } from "@/components/admin/admin-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminMarketingSnapshot } from "@/lib/marketing-intelligence"

export const metadata = { title: "Marketing intelligence" }

export default async function AdminMarketingPage() {
  const data = await getAdminMarketingSnapshot()
  const pagesPerVisitor = data.metrics.visitors
    ? data.metrics.pageViews / data.metrics.visitors
    : 0

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Consented first-party data"
        title="Marketing intelligence"
        body={`A ${data.windowDays}-day view of acquisition, audience, and site activity under the visitor's regional privacy choice.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric
          label="Consented visitors"
          value={data.metrics.visitors.toLocaleString()}
          note="Distinct privacy-safe browser IDs"
        />
        <AdminMetric
          label="Sessions"
          value={data.metrics.sessions.toLocaleString()}
          note="30-minute rolling sessions"
        />
        <AdminMetric
          label="Page views"
          value={data.metrics.pageViews.toLocaleString()}
          note={`${pagesPerVisitor.toFixed(1)} per consented visitor`}
        />
        <AdminMetric
          label="Located events"
          value={data.metrics.locatedEvents.toLocaleString()}
          note="Country classification or verified account geography"
        />
      </div>

      <Notice
        retentionDays={data.retentionDays}
        retentionPolicy={data.retentionPolicy}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Campaign attribution">
          <Table
            headers={["Source / medium", "Campaign", "Visitors", "Sessions", "Views"]}
            rows={data.campaigns.map((row) => [
              `${row.source} / ${row.medium}`,
              row.campaign,
              row.visitors,
              row.sessions,
              row.pageViews,
            ])}
            empty="No consented campaign visits in this window."
          />
        </DataCard>

        <DataCard title="Device, browser, and operating system">
          <Table
            headers={["Device", "Browser", "OS", "Visitors"]}
            rows={data.devices.map((row) => [
              row.device,
              row.browser,
              row.os,
              row.visitors,
            ])}
            empty="No consented device data in this window."
          />
        </DataCard>

        <DataCard title="Language and timezone">
          <Table
            headers={["Language", "Timezone", "Visitors"]}
            rows={data.languages.map((row) => [
              row.language,
              row.timezone,
              row.visitors,
            ])}
            empty="No consented audience data in this window."
          />
        </DataCard>

        <DataCard title="Coarse geography">
          <Table
            headers={["Country", "Region", "Visitors"]}
            rows={data.locations.map((row) => [
              row.country,
              row.region,
              row.visitors,
            ])}
            empty="No coarse country or account geography is available yet."
          />
        </DataCard>
      </div>

      <DataCard title="Top pages">
        <Table
          headers={["Path", "Views", "Visitors"]}
          rows={data.pages.map((row) => [row.path, row.pageViews, row.visitors])}
          empty="No consented page views in this window."
        />
      </DataCard>
    </div>
  )
}

function Notice({
  retentionDays,
  retentionPolicy,
}: {
  retentionDays: number | null
  retentionPolicy: string
}) {
  const retentionCopy =
    retentionPolicy === "board_pending"
      ? "Automatic age-based deletion is disabled while the retention policy awaits a documented board decision."
      : retentionDays
        ? `The approved age-based retention schedule is ${retentionDays.toLocaleString()} days.`
        : "No age-based deletion schedule is active."

  return (
    <div className="border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
      This dashboard excludes visitors whose regional rules require opt-in and
      who do not consent, as well as every visitor who opts out or sends Global
      Privacy Control. Cuadrabot stores purpose-built IDs and campaign fields—not
      raw IP addresses, arbitrary browser cookies, payment data, or uploaded
      plans. {retentionCopy} Individual privacy rights and legal holds remain
      separate controls.
    </div>
  )
}

function DataCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[]
  rows: Array<Array<string | number>>
  empty: string
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`} className="border-b last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 align-top">
                  {typeof cell === "number" ? cell.toLocaleString() : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
