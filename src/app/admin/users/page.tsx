import { updateUserStatus } from "@/app/admin/actions"
import { AdminHeader } from "@/components/admin/admin-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAdminSnapshot } from "@/lib/admin-data"

export const metadata = { title: "Users and companies" }

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const [data, params] = await Promise.all([getAdminSnapshot(), searchParams])
  const query = params.q?.trim().toLowerCase() ?? ""
  const profiles = query
    ? data.profiles.filter((profile) =>
        [
          profile.email,
          profile.full_name,
          profile.company_name,
          profile.country_code,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query))
      )
    : data.profiles
  const credits = new Map(data.credits.map((row) => [row.user_id, row]))
  const jobCounts = new Map<string, number>()
  for (const job of data.jobs) {
    jobCounts.set(job.user_id, (jobCounts.get(job.user_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Customers"
        title="Users and companies"
        body="Find a workspace, understand its activity and balance, and safely suspend or restore access. Every status change is recorded."
        action={
          <form className="flex gap-2">
            <Input
              name="q"
              defaultValue={params.q}
              placeholder="Search name, company, email..."
              className="w-72 bg-white"
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        }
      />

      <div className="overflow-hidden border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User / company</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Jobs</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => {
              const account = credits.get(profile.id)
              return (
                <TableRow key={profile.id}>
                  <TableCell>
                    <p className="font-medium">
                      {profile.company_name || profile.full_name || "Unnamed"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {profile.email}
                    </p>
                    {profile.role === "admin" ? (
                      <Badge variant="outline" className="mt-2">
                        Admin
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[profile.city, profile.region, profile.country_code]
                      .filter(Boolean)
                      .join(", ") || "Unknown"}
                  </TableCell>
                  <TableCell>{jobCounts.get(profile.id) ?? 0}</TableCell>
                  <TableCell>
                    <p className="font-medium">
                      {(account?.balance ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(account?.lifetime_consumed ?? 0).toLocaleString()} used
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {profile.last_seen_at
                      ? formatDate(profile.last_seen_at)
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <form action={updateUserStatus} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={profile.id} />
                      <input
                        type="hidden"
                        name="reason"
                        value="Updated from user management"
                      />
                      <Select
                        name="status"
                        defaultValue={
                          profile.status === "active" ? "active" : "suspended"
                        }
                        items={[
                          { value: "active", label: "Active" },
                          { value: "suspended", label: "Suspended" },
                        ]}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button type="submit" size="sm" variant="outline">
                        Save
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {profiles.length.toLocaleString()} of{" "}
        {data.metrics.totalUsers.toLocaleString()} users.
      </p>
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
