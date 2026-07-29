import { getCurrentProfile, requireUser } from "@/lib/auth"
import { getCustomerWorkspace } from "@/lib/customer-dashboard"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser("/dashboard")
  const [profile, workspace] = await Promise.all([
    getCurrentProfile(),
    getCustomerWorkspace(user.id),
  ])

  return (
    <DashboardShell
      name={profile?.full_name ?? user.email ?? "Cuadrabot user"}
      company={profile?.company_name ?? "Company workspace"}
      credits={workspace.credits.balance}
      isAdmin={profile?.role === "admin"}
    >
      {children}
    </DashboardShell>
  )
}
