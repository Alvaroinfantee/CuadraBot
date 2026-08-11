import Link from "next/link"
import {
  ArrowRightIcon,
  CheckIcon,
  CoinsIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  creditPacks,
  servicePriceCards,
  subscriptionPlans,
} from "@/lib/takeoff-pricing"
import { buildLocalizedMetadata, freeTrialSignupPath } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const metadata = buildLocalizedMetadata({
  locale: "en",
  path: "/pricing",
  title: "Pricing",
  description:
    "Fixed prices for self-serve legend-driven fixture, device, and supported cable or conduit takeoffs, plus credits and optional plans.",
})

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="border-b blueprint-fine-grid">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Transparent pricing
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">
              Buy legend-driven takeoff capacity, not another seat license.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Start with one real blueprint sheet free, no credit card required.
              Paid takeoffs use credits from a reusable pack or monthly plan
              after the PDF, page count, and selected scopes are verified.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={freeTrialSignupPath("en")}
                className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
              >
                Start free trial
                <ArrowRightIcon />
              </Link>
              <Link
                href="/sample"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 bg-white px-6"
                )}
              >
                View sample output
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b bg-blue-50/70 py-12">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
            <div>
              <Badge>Free trial</Badge>
              <h2 className="mt-4 text-3xl font-semibold">
                One real blueprint sheet for $0
              </h2>
              <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
                Choose one legend-based scope and receive the annotated PDF and
                Excel quantity workbook. No credit card, no credits, one trial
                per user.
              </p>
            </div>
            <Link
              href={freeTrialSignupPath("en")}
              className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")}
            >
              Upload one sheet free
              <ArrowRightIcon />
            </Link>
          </div>
        </section>

        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                  Per takeoff
                </p>
                <h2 className="mt-3 text-3xl font-semibold">
                  Fixed self-serve legend scopes
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                One correction is included within the approved scope. Work
                beyond 25 pages moves to the fixed $499 Large Set tier and
                remains self-serve.
              </p>
            </div>
            <div className="mt-10 grid gap-px border bg-border md:grid-cols-2 xl:grid-cols-5">
              {servicePriceCards.map((price, index) => (
                <article key={price.tier} className="bg-white p-6">
                  <div className="flex min-h-7 items-start justify-between gap-3">
                    <p className="font-medium">{price.name}</p>
                    {index === 1 ? <Badge>Popular</Badge> : null}
                  </div>
                  <p className="mt-6 text-4xl font-semibold">
                    ${(price.priceCents / 100).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {price.credits} credits
                  </p>
                  <p className="mt-6 min-h-18 text-sm leading-6 text-muted-foreground">
                    {price.description}
                  </p>
                  <ul className="mt-6 space-y-3 border-t pt-5 text-sm">
                    {[
                      "Marked PDF",
                      "Excel quantities by legend code",
                      "Automated validation",
                      "One correction",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckIcon className="size-4 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b bg-[#f5f7fa] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Optional monthly plans
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Predictable credits for repeat takeoff volume
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Monthly credits grant after each paid invoice and never become
                an unlimited-use promise. Launch credits do not expire.
              </p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {subscriptionPlans.map((plan, index) => (
                <article
                  key={plan.sku}
                  className={cn(
                    "border bg-white p-7",
                    index === 1 && "border-primary shadow-lg"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    {index === 1 ? <Badge>Most flexible</Badge> : null}
                  </div>
                  <p className="mt-6">
                    <span className="text-4xl font-semibold">
                      ${(plan.priceCents / 100).toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / month
                    </span>
                  </p>
                  <div className="mt-6 border-y py-5">
                    <p className="text-2xl font-semibold">
                      {plan.credits.toLocaleString()} credits
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No launch expiry · cancel at period end
                    </p>
                  </div>
                  <Link
                    href="/signup"
                    className={cn(
                      buttonVariants({
                        variant: index === 1 ? "default" : "outline",
                      }),
                      "mt-6 w-full"
                    )}
                  >
                    Create account
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Credit packs
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Add capacity without a subscription
              </h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Launch credit packs do not expire and include a larger bonus at
                higher volumes.
              </p>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {creditPacks.map((pack) => (
                <article key={pack.sku} className="border p-7">
                  <CoinsIcon className="size-5 text-primary" />
                  <h3 className="mt-5 text-xl font-semibold">{pack.name}</h3>
                  <p className="mt-5 text-4xl font-semibold">
                    ${(pack.priceCents / 100).toLocaleString()}
                  </p>
                  <p className="mt-6 text-2xl font-semibold">
                    {pack.credits.toLocaleString()} credits
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {pack.bonus.toLocaleString()} bonus credits included
                  </p>
                  <Link
                    href="/signup"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "mt-6 w-full"
                    )}
                  >
                    Create account
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0b1f3a] py-14 text-white">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
            <div className="flex gap-4">
              <ShieldCheckIcon className="mt-1 size-6 shrink-0 text-blue-300" />
              <div>
                <h2 className="text-xl font-semibold">
                  Credits move only after confirmation.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  System failures release reserved credits. Payment fulfillment
                  comes from signed Stripe webhooks, never from a redirect or a
                  browser-supplied amount.
                </p>
              </div>
            </div>
            <Link
              href="/signup"
              className={cn(buttonVariants({ variant: "secondary" }), "shrink-0")}
            >
              Create account
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
