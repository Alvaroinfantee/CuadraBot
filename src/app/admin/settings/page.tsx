import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { requireAdmin } from "@/lib/auth"

export const metadata = {
  title: "Admin settings",
}

export const dynamic = "force-dynamic"

const requiredEnv = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "FROM_EMAIL",
  "WORKER_API_KEY",
]

const optionalEnv = [
  "DEFAULT_CURRENCY",
  "MAX_UPLOAD_MB",
  "ADMIN_EMAIL",
  "BLENDER_OUTPUT_BUCKET",
  "CUSTOMER_UPLOAD_BUCKET",
]

export default async function AdminSettingsPage() {
  await requireAdmin()

  return (
    <AdminShell title="Settings">
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 border p-6">
          <h2 className="text-2xl font-semibold">Environment</h2>
          <EnvList names={requiredEnv} required />
        </div>
        <div className="flex flex-col gap-4 border p-6">
          <h2 className="text-2xl font-semibold">Optional settings</h2>
          <EnvList names={optionalEnv} />
        </div>
      </section>
      <section className="border p-6">
        <h2 className="mb-3 text-2xl font-semibold">Worker security model</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          The website never exposes the owner PC, Blender, MCP server, or local network. The local worker authenticates with a bearer API key, polls the public API, downloads signed URLs for claimed jobs, runs local rendering, and uploads final files back through authenticated worker endpoints.
        </p>
      </section>
    </AdminShell>
  )
}

function EnvList({ names, required = false }: { names: string[]; required?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {names.map((name) => {
        const configured = Boolean(process.env[name])
        return (
          <div key={name} className="flex items-center justify-between gap-4 border px-3 py-2 text-sm">
            <span className="font-mono">{name}</span>
            <Badge variant={configured ? "secondary" : "outline"} className="rounded-sm">
              {configured ? "Configured" : required ? "Required" : "Default"}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
