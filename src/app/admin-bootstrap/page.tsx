import Link from "next/link"
import { AdminBootstrapForm } from "@/components/admin/admin-bootstrap-form"
import { AuthCard } from "@/components/auth/auth-card"
import { requireUser } from "@/lib/auth"
import { getRequestLocale } from "@/lib/i18n-server"

export const metadata = { title: "Administrator recovery" }

export default async function AdminBootstrapPage() {
  await requireUser("/admin-bootstrap")
  const locale = await getRequestLocale()

  const text =
    locale === "es"
      ? {
          eyebrow: "Recuperación segura",
          title: "Activar acceso de administrador",
          body: "Esta página requiere una sesión autenticada, el correo habilitado previamente y una clave temporal de un solo uso.",
          footer: "Volver al espacio de trabajo",
        }
      : {
          eyebrow: "Secure recovery",
          title: "Activate administrator access",
          body: "This page requires an authenticated session, the exact pre-provisioned email, and a short-lived one-time key.",
          footer: "Return to the workspace",
        }

  return (
    <AuthCard
      locale={locale}
      eyebrow={text.eyebrow}
      title={text.title}
      body={text.body}
      footer={
        <Link href="/dashboard" className="font-medium text-primary">
          {text.footer}
        </Link>
      }
    >
      <AdminBootstrapForm locale={locale} />
    </AuthCard>
  )
}
