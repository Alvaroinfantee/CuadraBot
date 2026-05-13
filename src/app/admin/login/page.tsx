import Link from "next/link"
import { AdminLoginForm } from "@/components/admin/admin-login-form"

export const metadata = {
  title: "Admin login",
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-xl font-semibold">
          Cuadrabot
        </Link>
        <h1 className="text-4xl font-semibold tracking-normal">Admin login</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Owner access requires Supabase Auth and a profile role of admin.
        </p>
        {params.forbidden ? (
          <p className="text-sm font-medium text-destructive">
            This account does not have admin access.
          </p>
        ) : null}
      </div>
      <AdminLoginForm />
    </main>
  )
}
