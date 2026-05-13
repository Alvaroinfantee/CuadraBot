import Link from "next/link"
import { ArrowRightIcon, CheckIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"
import { commonCopy, getPackageDisplay, localePath, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { PackagePlan } from "@/lib/types"

export function PackageColumns({
  packages,
  cta = true,
  locale = "en",
}: {
  packages: PackagePlan[]
  cta?: boolean
  locale?: Locale
}) {
  const copy = commonCopy[locale]

  return (
    <div className="grid gap-0 border-y md:grid-cols-3">
      {packages.map((plan, index) => {
        const display = getPackageDisplay(locale, plan)

        return (
          <article
            key={plan.slug}
            className={cn(
              "flex flex-col gap-6 px-6 py-8 md:min-h-[34rem]",
              index > 0 && "border-t md:border-l md:border-t-0",
              display.badge && "bg-primary/[0.03]"
            )}
          >
            <div className="flex min-h-32 flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-semibold text-primary">{display.name}</h3>
                {display.badge ? (
                  <Badge className="shrink-0 rounded-sm bg-primary text-primary-foreground">
                    {display.badge}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {display.description}
              </p>
            </div>

            <ul className="flex flex-1 flex-col gap-3 text-sm">
              {display.includes.map((feature) => (
                <li key={feature} className="flex gap-2 leading-6">
                  <CheckIcon data-icon="inline-start" className="mt-0.5 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="border-t pt-5 text-sm leading-6">
              <p className="font-semibold text-foreground">{copy.bestFor}</p>
              <p className="text-muted-foreground">{display.bestFor}</p>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {copy.ready72}
            </p>

            <div className="flex items-end justify-between gap-4">
              <div className="text-3xl font-semibold">
                {formatMoney(plan.price_cents, plan.currency)}
              </div>
              {cta ? (
                <Link
                  href={localePath(locale, `/order?package=${plan.slug}`)}
                  className={buttonVariants({ variant: display.badge ? "default" : "outline" })}
                >
                  {display.cta}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
