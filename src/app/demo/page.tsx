import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRightIcon,
  BarChart3Icon,
  LayoutDashboardIcon,
  UploadCloudIcon,
} from "lucide-react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { canShowDemo } from "@/lib/demo"
import { cn } from "@/lib/utils"

export const metadata = { title: "Launch preview" }

export default function DemoIndexPage() {
  if (!canShowDemo()) notFound()

  const previews = [
    {
      href: "/demo/dashboard",
      icon: LayoutDashboardIcon,
      title: "Customer workspace",
      body: "Credits, active jobs, delivery status, and private outputs.",
    },
    {
      href: "/demo/new",
      icon: UploadCloudIcon,
      title: "New takeoff flow",
      body: "Scope, local file selection, server-verification preview, and fixed quote.",
    },
    {
      href: "/demo/admin",
      icon: BarChart3Icon,
      title: "Admin control panel",
      body: "Growth, subscriptions, operations, geography, quality, and readiness.",
    },
  ] as const

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="min-h-[calc(100vh-4rem)] blueprint-fine-grid">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <Badge variant="outline" className="bg-white">
              Safe preview · no external writes
            </Badge>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">
              Test the takeoff-only Cuadrabot experience.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              These screens use realistic bounded sample data. They do not
              create users, upload plans, charge cards, consume credits, or
              change production state.
            </p>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {previews.map((preview) => {
                const Icon = preview.icon
                return (
                  <Link
                    key={preview.href}
                    href={preview.href}
                    className="group border bg-white p-7 hover:border-primary hover:shadow-lg"
                  >
                    <Icon className="size-6 text-primary" />
                    <h2 className="mt-8 text-xl font-semibold">
                      {preview.title}
                    </h2>
                    <p className="mt-3 min-h-16 text-sm leading-6 text-muted-foreground">
                      {preview.body}
                    </p>
                    <span className="mt-7 flex items-center gap-2 text-sm font-medium text-primary">
                      Open preview
                      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                )
              })}
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline" }), "bg-white")}
              >
                Public website
              </Link>
              <Link href="/signup" className={buttonVariants()}>
                Real account flow
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
