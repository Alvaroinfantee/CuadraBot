import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { commonCopy, localePath, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function SiteHeader({ locale = "en" }: { locale?: Locale }) {
  const copy = commonCopy[locale]
  const alternateLocale: Locale = locale === "en" ? "es" : "en"
  const nav = [
    { href: "/#how-it-works", label: copy.howItWorks },
    { href: "/pricing", label: copy.projectQuote },
    { href: "/#why-cuadrabot", label: copy.whyCuadrabot },
    { href: "/faq", label: copy.faq },
  ]

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={localePath(locale, "/")} className="flex items-center gap-2 font-heading text-xl font-semibold tracking-normal">
          <span className="flex size-7 items-center justify-center rounded-sm border border-primary/25 text-sm text-primary">
            C
          </span>
          Cuadrabot
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={localePath(locale, item.href)} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={localePath(alternateLocale, "/")} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {alternateLocale.toUpperCase()}
          </Link>
          <Link href="/admin/login" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block">
            {copy.logIn}
          </Link>
          <Link href={localePath(locale, "/pricing")} className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
            {copy.startRender}
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </div>
      </div>
    </header>
  )
}
