import { AdminHeader } from "@/components/admin/admin-ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAdminSnapshot } from "@/lib/admin-data"

export const metadata = { title: "Admin audit log" }

export default async function AdminAuditPage() {
  const data = await getAdminSnapshot()
  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Accountability"
        title="Administrative audit log"
        body="Who changed what, when, and why. Use this history for incident review, billing decisions, support, and data requests."
      />
      <div className="overflow-hidden border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Administrator</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.audit.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(entry.created_at)}
                </TableCell>
                <TableCell>{entry.actor_email ?? "System"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {entry.action}
                </TableCell>
                <TableCell>
                  {entry.target_type}
                  {entry.target_id ? (
                    <span className="block max-w-48 truncate font-mono text-xs text-muted-foreground">
                      {entry.target_id}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-sm text-sm text-muted-foreground">
                  {entry.reason || "—"}
                </TableCell>
              </TableRow>
            ))}
            {!data.audit.length ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  No administrative changes recorded yet.
                </TableCell>
              </TableRow>
            ) : null}
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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
