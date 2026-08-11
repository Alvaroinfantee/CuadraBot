import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import {
  commonCopy,
  freeTrialSignupPath,
  localizedAuthPath,
  localizedPublicPath,
  type Locale,
} from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function PageHero({
  eyebrow,
  title,
  body,
  primary,
  primaryHref = "/signup",
  secondary,
  secondaryHref = "/sample",
  locale = "en",
}: {
  eyebrow: string
  title: string
  body: string
  primary?: string
  primaryHref?: string
  secondary?: string
  secondaryHref?: string
  locale?: Locale
}) {
  const primaryTarget =
    primaryHref === "/signup"
      ? freeTrialSignupPath(locale)
      : primaryHref === "/login"
        ? localizedAuthPath(primaryHref, locale)
        : primaryHref
  const secondaryTarget =
    secondaryHref === "/sample"
      ? localizedPublicPath("/sample", locale)
      : secondaryHref
  const primaryLabel = primary ?? commonCopy[locale].nav.freeCta
  return (
    <section className="border-b blueprint-fine-grid">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-5xl text-5xl font-semibold tracking-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          {body}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={primaryTarget}
            className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
          >
            {primaryLabel}
            <ArrowRightIcon />
          </Link>
          {secondary ? (
            <Link
              href={secondaryTarget}
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-12 bg-white px-6"
              )}
            >
              {secondary}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function CtaBand({ locale = "en" }: { locale?: Locale }) {
  const copy =
    locale === "es"
      ? {
          title: "Prueba Cuadrabot gratis con una hoja real.",
          body:
            "Sin tarjeta. Sube una hoja con una leyenda legible y recibe el plano anotado y el libro de cantidades en Excel. Una prueba por usuario.",
        }
      : {
          title: "Try Cuadrabot free on one real sheet.",
          body:
            "No credit card. Upload one sheet with a readable legend and receive the annotated plan and Excel quantity workbook. One trial per user.",
        }
  return (
    <section className="blueprint-grid py-16">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.title}
        </h2>
        <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
          {copy.body}
        </p>
        <Link
          href={freeTrialSignupPath(locale)}
          className={cn(buttonVariants({ size: "lg" }), "mt-7 h-12 px-7")}
        >
          {commonCopy[locale].nav.freeCta}
          <ArrowRightIcon />
        </Link>
      </div>
    </section>
  )
}
