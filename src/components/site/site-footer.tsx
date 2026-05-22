import Link from "next/link"
import { commonCopy, localePath, type Locale } from "@/lib/i18n"

export function SiteFooter({ locale = "en" }: { locale?: Locale }) {
  const copy = commonCopy[locale]

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Link href={localePath(locale, "/")} className="text-xl font-semibold">
              Cuadrabot
            </Link>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {copy.blueprintToRender}
            </p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
            <Link href={localePath(locale, "/pricing")} className="hover:text-foreground">
              {copy.projectQuote}
            </Link>
            <Link href={localePath(locale, "/gallery")} className="hover:text-foreground">
              {copy.gallery}
            </Link>
            <Link href={localePath(locale, "/faq")} className="hover:text-foreground">
              {copy.faq}
            </Link>
            <Link href={localePath(locale, "/terms")} className="hover:text-foreground">
              {copy.terms}
            </Link>
            <Link href={localePath(locale, "/privacy")} className="hover:text-foreground">
              {copy.privacy}
            </Link>
            <Link href={localePath(locale, "/refund-policy")} className="hover:text-foreground">
              {copy.refundPolicy}
            </Link>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {copy.serviceDisclaimer}
        </p>
      </div>
    </footer>
  )
}
