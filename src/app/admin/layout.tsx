import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdmin } from "@/lib/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await requireAdmin()
  return (
    <AdminShell adminName={admin.full_name ?? admin.email}>
      {children}
    </AdminShell>
  )
}
