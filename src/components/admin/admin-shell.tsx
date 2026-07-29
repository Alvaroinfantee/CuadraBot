"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  BriefcaseBusinessIcon,
  CreditCardIcon,
  FileCheck2Icon,
  FilesIcon,
  GaugeIcon,
  Globe2Icon,
  HeartPulseIcon,
  MenuIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldAlertIcon,
  UsersIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const nav = [
  ["/admin", "Overview", GaugeIcon],
  ["/admin/users", "Users & companies", UsersIcon],
  ["/admin/jobs", "Jobs & exceptions", BriefcaseBusinessIcon],
  ["/admin/documents", "Document archive", FilesIcon],
  ["/admin/billing", "Billing & credits", CreditCardIcon],
  ["/admin/growth", "Funnel & growth", BarChart3Icon],
  ["/admin/geography", "Geography", Globe2Icon],
  ["/admin/quality", "Quality & delivery", FileCheck2Icon],
  ["/admin/health", "Health & alerts", HeartPulseIcon],
  ["/admin/settings", "Settings", SettingsIcon],
  ["/admin/audit", "Audit log", ScrollTextIcon],
] as const

export function AdminShell({
  children,
  adminName,
  demo = false,
}: {
  children: React.ReactNode
  adminName: string
  demo?: boolean
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#f3f5f8]">
      <div className="mx-auto grid min-h-screen max-w-[1800px] lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r bg-[#071426] text-white lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-6 py-6">
            <Link
              href={demo ? "/demo/admin#overview" : "/admin"}
              className="flex items-center gap-3 font-semibold"
            >
              <span className="grid size-8 place-items-center border border-blue-300/50 font-mono text-xs text-blue-300">
                AC
              </span>
              Cuadrabot Control
            </Link>
          </div>
          <div className="border-b border-white/10 px-6 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Signed in
            </p>
            <p className="mt-1 truncate text-sm text-slate-200">{adminName}</p>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
            {nav.map(([href, label, Icon]) => {
              const target = demo
                ? href === "/admin"
                  ? "/demo/admin#overview"
                  : `/demo/admin#${href.split("/").pop()}`
                : href
              const active =
                pathname === target ||
                (!demo && href !== "/admin" && pathname.startsWith(`${href}/`))
              return (
                <Link
                  key={href}
                  href={target}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                    active
                      ? "bg-white text-[#071426]"
                      : "text-slate-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="space-y-2 border-t border-white/10 p-4">
            <Link
              href={demo ? "/demo/dashboard" : "/dashboard"}
              className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeftIcon className="size-4" />
              Customer workspace
            </Link>
            <Link
              href={demo ? "/demo/admin#health" : "/admin/health"}
              className="flex items-center gap-3 rounded-md bg-blue-400/10 px-3 py-3 text-xs text-blue-200"
            >
              <ActivityIcon className="size-4" />
              Operational status
            </Link>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6 lg:px-8">
            <Link
              href={demo ? "/demo/admin#overview" : "/admin"}
              className="font-semibold lg:hidden"
            >
              Cuadrabot Control
            </Link>
            <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <ShieldAlertIcon className="size-4 text-primary" />
              Administrative actions are audited
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="ml-3 grid size-9 place-items-center rounded-md border lg:hidden"
                aria-label="Open admin navigation"
              >
                <MenuIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-[min(34rem,var(--available-height))] w-72"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <span className="block text-[11px] uppercase tracking-[0.12em]">
                      Signed in
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-foreground">
                      {adminName}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {nav.map(([href, label, Icon]) => {
                  const target = demo
                    ? href === "/admin"
                      ? "/demo/admin#overview"
                      : `/demo/admin#${href.split("/").pop()}`
                    : href
                  return (
                    <DropdownMenuItem
                      key={href}
                      render={<Link href={target} />}
                      className="gap-2 px-2 py-2"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {label}
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={
                    <Link href={demo ? "/demo/dashboard" : "/dashboard"} />
                  }
                  className="gap-2 px-2 py-2"
                >
                  <ArrowLeftIcon className="size-4 text-muted-foreground" />
                  Customer workspace
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link
                      href={demo ? "/demo/admin#health" : "/admin/health"}
                    />
                  }
                  className="gap-2 px-2 py-2"
                >
                  <ActivityIcon className="size-4 text-primary" />
                  Operational status
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
