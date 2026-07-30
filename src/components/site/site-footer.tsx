import Link from "next/link"
import {
  commonCopy,
  localizedPublicPath,
  type Locale,
} from "@/lib/i18n"

export function SiteFooter({ locale = "en" }: { locale?: Locale }) {
  const copy = commonCopy[locale]
  return (
    <footer className="border-t bg-[#0b1f3a] py-12 text-slate-300">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 text-sm sm:px-6 lg:grid-cols-[1.3fr_0.7fr_0.7fr] lg:px-8">
        <div>
          <Link
            href={localizedPublicPath("/", locale)}
            className="text-lg font-semibold text-white"
          >
            Cuadrabot
          </Link>
          <p className="mt-3 max-w-md leading-6">
            {copy.footer.description}
          </p>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            {copy.footer.disclaimer}
          </p>
        </div>
        <div>
          <p className="font-medium text-white">{copy.footer.product}</p>
          <nav className="mt-4 flex flex-col gap-3">
            <Link href={localizedPublicPath("/how-it-works", locale)}>
              {copy.nav.howItWorks}
            </Link>
            <Link href={localizedPublicPath("/pricing", locale)}>
              {copy.nav.pricing}
            </Link>
            <Link href={localizedPublicPath("/sample", locale)}>
              {copy.footer.sample}
            </Link>
            <Link href={localizedPublicPath("/accuracy", locale)}>
              {copy.nav.accuracy}
            </Link>
            <Link href={localizedPublicPath("/security", locale)}>
              {copy.nav.security}
            </Link>
          </nav>
        </div>
        <div>
          <p className="font-medium text-white">{copy.footer.company}</p>
          <nav className="mt-4 flex flex-col gap-3">
            <Link href={localizedPublicPath("/faq", locale)}>
              {copy.nav.faq}
            </Link>
            <Link href={localizedPublicPath("/privacy", locale)}>
              {copy.footer.privacy}
            </Link>
            <Link href={localizedPublicPath("/terms", locale)}>
              {copy.footer.terms}
            </Link>
            <Link href={localizedPublicPath("/refund-policy", locale)}>
              {copy.footer.refund}
            </Link>
            <a href="mailto:support@cuadrabot.com">{copy.footer.support}</a>
          </nav>
        </div>
        <div className="border-t border-white/10 pt-6 text-xs text-slate-400 lg:col-span-3">
          © {new Date().getFullYear()} Cuadrabot. {copy.footer.rights}
        </div>
      </div>
    </footer>
  )
}
