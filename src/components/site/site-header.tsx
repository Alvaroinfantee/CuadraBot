import Link from "next/link"
import { ArrowRightIcon, MenuIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/security", label: "Security" },
  { href: "/faq", label: "FAQ" },
] as const

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold">
          <span className="flex size-8 items-center justify-center border border-primary/30 font-mono text-sm text-primary">
            C
          </span>
          Cuadrabot
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
          >
            Check my plans free
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-9 place-items-center border lg:hidden"
              aria-label="Open navigation"
            >
              <MenuIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {nav.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  render={<Link href={item.href} />}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem render={<Link href="/login" />}>
                Log in
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/signup" />}>
                Check my plans free
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
