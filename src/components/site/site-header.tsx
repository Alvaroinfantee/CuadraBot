import Link from "next/link"
import { ArrowRightIcon, MenuIcon } from "lucide-react"
import { LocaleSwitcher } from "@/components/i18n/locale-switcher"
import { buttonVariants } from "@/components/ui/button"
import {
  commonCopy,
  freeTrialSignupPath,
  localizedAuthPath,
  localizedPublicPath,
  type Locale,
} from "@/lib/i18n"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function SiteHeader({ locale = "en" }: { locale?: Locale }) {
  const copy = commonCopy[locale]
  const nav = [
    { href: "/how-it-works" as const, label: copy.nav.howItWorks },
    { href: "/pricing" as const, label: copy.nav.pricing },
    { href: "/accuracy" as const, label: copy.nav.accuracy },
    { href: "/security" as const, label: copy.nav.security },
    { href: "/faq" as const, label: copy.nav.faq },
  ]
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={localizedPublicPath("/", locale)}
          className="flex items-center gap-2 text-xl font-semibold"
        >
          <span className="flex size-8 items-center justify-center border border-primary/30 font-mono text-sm text-primary">
            C
          </span>
          Cuadrabot
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={localizedPublicPath(item.href, locale)}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitcher locale={locale} compact />
          <Link
            href={localizedAuthPath("/login", locale)}
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block"
          >
            {copy.nav.login}
          </Link>
          <Link
            href={freeTrialSignupPath(locale)}
            className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
          >
            {copy.nav.freeCta}
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-9 place-items-center border lg:hidden"
              aria-label={copy.nav.openNavigation}
            >
              <MenuIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {nav.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  render={
                    <Link href={localizedPublicPath(item.href, locale)} />
                  }
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                render={<Link href={localizedAuthPath("/login", locale)} />}
              >
                {copy.nav.login}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<Link href={freeTrialSignupPath(locale)} />}
              >
                {copy.nav.freeCta}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
