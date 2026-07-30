"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3Icon,
  CoinsIcon,
  FilePlus2Icon,
  FilesIcon,
  GaugeIcon,
  LifeBuoyIcon,
  LogOutIcon,
  MenuIcon,
  SettingsIcon,
  ShieldCheckIcon,
  WalletCardsIcon,
} from "lucide-react"
import { LocaleSwitcher } from "@/components/i18n/locale-switcher"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  commonCopy,
  localeTag,
  localizedPublicPath,
  type Locale,
} from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function DashboardShell({
  children,
  name,
  company,
  credits,
  isAdmin = false,
  demo = false,
  locale = "en",
}: {
  children: React.ReactNode
  name: string
  company: string
  credits: number
  isAdmin?: boolean
  demo?: boolean
  locale?: Locale
}) {
  const pathname = usePathname()
  const copy = commonCopy[locale]
  const customerNav = [
    { href: "/dashboard", label: copy.dashboard.overview, icon: GaugeIcon },
    {
      href: "/dashboard/new",
      label: copy.dashboard.newTakeoff,
      icon: FilePlus2Icon,
    },
    { href: "/dashboard/jobs", label: copy.dashboard.takeoffs, icon: FilesIcon },
    {
      href: "/dashboard/billing",
      label: copy.dashboard.billing,
      icon: WalletCardsIcon,
    },
    {
      href: "/dashboard/settings",
      label: copy.dashboard.settings,
      icon: SettingsIcon,
    },
  ]
  const signoutPath =
    locale === "es" ? "/auth/signout?next=/es" : "/auth/signout?next=/"

  return (
    <div lang={locale} className="min-h-screen bg-[#f5f7fa]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r bg-[#0b1f3a] text-slate-100 lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-6 py-6">
            <Link
              href={localizedPublicPath("/", locale)}
              className="flex items-center gap-3 text-xl font-semibold"
            >
              <span className="grid size-8 place-items-center border border-blue-300/50 font-mono text-sm text-blue-300">
                C
              </span>
              Cuadrabot
            </Link>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-6">
            {customerNav.map((item) => {
              const Icon = item.icon
              const href = demo
                ? item.href === "/dashboard"
                  ? "/demo/dashboard"
                  : item.href === "/dashboard/new"
                    ? "/demo/new"
                    : `/demo/dashboard#${item.href.split("/").pop()}`
                : item.href
              const selected =
                pathname === href ||
                (href !== "/dashboard" && pathname.startsWith(`${href}/`))
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                    selected
                      ? "bg-white text-[#0b1f3a]"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
            {isAdmin ? (
              <Link
                href={demo ? "/demo/admin" : "/admin"}
                className="mt-5 flex items-center gap-3 border-t border-white/10 px-3 pt-5 text-sm text-blue-300 hover:text-white"
              >
                <BarChart3Icon className="size-4" />
                {copy.dashboard.admin}
              </Link>
            ) : null}
          </nav>
          <div className="space-y-4 border-t border-white/10 p-5">
            <div className="rounded-md bg-white/10 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                <CoinsIcon className="size-4" />
                {copy.dashboard.available}
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {credits.toLocaleString(localeTag(locale))}{" "}
                {copy.dashboard.credits}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                <p className="truncate text-xs text-slate-400">{company}</p>
              </div>
              <form action={signoutPath} method="post">
                <button
                  type="submit"
                  className="rounded p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label={copy.dashboard.logout}
                >
                  <LogOutIcon className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="flex min-h-16 items-center justify-between gap-4 border-b bg-white px-4 sm:px-6 lg:px-8">
            <Link href={demo ? "/demo/dashboard" : "/dashboard"} className="font-semibold lg:hidden">
              Cuadrabot
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <Badge variant="outline" className="hidden gap-1.5 sm:flex">
                <ShieldCheckIcon className="size-3.5 text-emerald-600" />
                {copy.dashboard.privateWorkspace}
              </Badge>
              <LocaleSwitcher locale={locale} compact />
              <Link
                href="mailto:support@cuadrabot.com"
                className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"
              >
                <LifeBuoyIcon className="size-4" />
                {copy.dashboard.help}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="grid size-9 place-items-center rounded-md border lg:hidden"
                  aria-label={copy.dashboard.openNavigation}
                >
                  <MenuIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="max-h-[min(34rem,var(--available-height))] w-72"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <span className="block truncate text-sm font-medium text-foreground">
                        {name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs">
                        {company}
                      </span>
                      <span className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                        <CoinsIcon className="size-3.5" />
                        {credits.toLocaleString(localeTag(locale))}{" "}
                        {copy.dashboard.creditsAvailable}
                      </span>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {customerNav.map((item) => {
                    const Icon = item.icon
                    const href = demo
                      ? item.href === "/dashboard"
                        ? "/demo/dashboard"
                        : item.href === "/dashboard/new"
                          ? "/demo/new"
                          : `/demo/dashboard#${item.href.split("/").pop()}`
                      : item.href
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        render={<Link href={href} />}
                        className="gap-2 px-2 py-2"
                      >
                        <Icon className="size-4 text-muted-foreground" />
                        {item.label}
                      </DropdownMenuItem>
                    )
                  })}
                  {isAdmin ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        render={
                          <Link href={demo ? "/demo/admin" : "/admin"} />
                        }
                        className="gap-2 px-2 py-2"
                      >
                        <BarChart3Icon className="size-4 text-primary" />
                        {copy.dashboard.admin}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    render={<Link href="mailto:support@cuadrabot.com" />}
                    className="gap-2 px-2 py-2"
                  >
                    <LifeBuoyIcon className="size-4 text-muted-foreground" />
                    {copy.dashboard.help}
                  </DropdownMenuItem>
                  {!demo ? (
                    <DropdownMenuItem
                      render={
                        <button
                          type="submit"
                          form="mobile-dashboard-signout"
                        />
                      }
                      className="gap-2 px-2 py-2"
                    >
                      <LogOutIcon className="size-4 text-muted-foreground" />
                      {copy.dashboard.logout}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              {!demo ? (
                <form
                  id="mobile-dashboard-signout"
                  action={signoutPath}
                  method="post"
                  className="hidden"
                />
              ) : null}
            </div>
          </header>
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
