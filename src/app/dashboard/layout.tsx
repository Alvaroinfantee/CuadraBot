import { getCurrentProfile, requireUser } from "@/lib/auth"
import { getCustomerWorkspace } from "@/lib/customer-dashboard"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { commonCopy } from "@/lib/i18n"
import { getRequestLocale } from "@/lib/i18n-server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser("/dashboard")
  const [profile, workspace, locale] = await Promise.all([
    getCurrentProfile(),
    getCustomerWorkspace(user.id),
    getRequestLocale(),
  ])
  const copy = commonCopy[locale]

  return (
    <DashboardShell
      name={profile?.full_name ?? user.email ?? copy.dashboard.userFallback}
      company={profile?.company_name ?? copy.dashboard.companyFallback}
      credits={workspace.credits.balance}
      isAdmin={profile?.role === "admin"}
      locale={locale}
    >
      {children}
    </DashboardShell>
  )
}
