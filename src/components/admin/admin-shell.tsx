import Link from "next/link"
import { logoutAdmin } from "@/lib/admin-actions"
import { Button } from "@/components/ui/button"

const nav = [
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/settings", label: "Settings" },
]

export function AdminShell({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/admin/orders" className="text-xl font-semibold">
            Cuadrabot Admin
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
            <form action={logoutAdmin}>
              <Button variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-normal">{title}</h1>
        {children}
      </main>
    </div>
  )
}
