import {
  CheckIcon,
  CoinsIcon,
  CreditCardIcon,
  RefreshCwIcon,
} from "lucide-react"
import {
  BillingPortalButton,
  CheckoutButton,
} from "@/components/billing/checkout-button"
import { PageHeader } from "@/components/dashboard/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAppFeatures } from "@/lib/app-settings"
import { requireUser } from "@/lib/auth"
import { getCustomerWorkspace } from "@/lib/customer-dashboard"
import {
  dashboardCopy,
  formatDashboardNumber,
  formatUsd,
  localizeCustomerError,
  localizedCreditPackName,
} from "@/lib/dashboard-i18n"
import { getRequestLocale } from "@/lib/i18n-server"
import { localizeSubscriptionPlanName } from "@/lib/i18n"
import { creditPacks, subscriptionPlans } from "@/lib/takeoff-pricing"

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: dashboardCopy[locale].metadata.billing }
}

export default async function BillingPage() {
  const user = await requireUser("/dashboard/billing")
  const [{ credits, subscription }, features, locale] = await Promise.all([
    getCustomerWorkspace(user.id),
    getAppFeatures(),
    getRequestLocale(),
  ])
  const copy = dashboardCopy[locale].billing

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={
          subscription ? <BillingPortalButton locale={locale} /> : undefined
        }
      />

      {features.maintenance || features.configurationError ? (
        <Alert>
          <AlertTitle>{copy.pausedTitle}</AlertTitle>
          <AlertDescription>
            {localizeCustomerError(
              features.maintenanceMessage,
              locale,
              copy.pausedBody
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <BillingMetric
          label={copy.available}
          value={formatDashboardNumber(credits.balance, locale)}
          note={copy.readyToReserve}
          icon={CoinsIcon}
        />
        <BillingMetric
          label={copy.grantedAllTime}
          value={formatDashboardNumber(credits.lifetime_granted, locale)}
          note={copy.grantsNote}
          icon={CreditCardIcon}
        />
        <BillingMetric
          label={copy.usedAllTime}
          value={formatDashboardNumber(credits.lifetime_consumed, locale)}
          note={copy.settledTakeoffs}
          icon={RefreshCwIcon}
        />
      </div>

      {features.subscriptions ? (
      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold">{copy.monthlyPlans}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.monthlyBody}
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {subscriptionPlans.map((plan, index) => (
            <Card
              key={plan.sku}
              className={index === 1 ? "border-primary shadow-md" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>
                    {localizeSubscriptionPlanName(
                      plan.sku,
                      plan.name,
                      locale
                    )}
                  </CardTitle>
                  {index === 1 ? <Badge>{copy.mostFlexible}</Badge> : null}
                </div>
                <div className="pt-3">
                  <span className="text-3xl font-semibold">
                    {formatUsd(plan.priceCents, locale)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    {copy.perMonth}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2">
                    <CheckIcon className="size-4 text-primary" />
                    {formatDashboardNumber(plan.credits, locale)}{" "}
                    {copy.creditsEachMonth}
                  </li>
                  <li className="flex gap-2">
                    <CheckIcon className="size-4 text-primary" />
                    {copy.noExpiry}
                  </li>
                  <li className="flex gap-2">
                    <CheckIcon className="size-4 text-primary" />
                    {copy.cancelAtPeriodEnd}
                  </li>
                </ul>
                <CheckoutButton
                  sku={plan.sku}
                  variant={index === 1 ? "default" : "outline"}
                  locale={locale}
                >
                  {copy.choose}{" "}
                  {localizeSubscriptionPlanName(
                    plan.sku,
                    plan.name,
                    locale
                  )}
                </CheckoutButton>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      ) : null}

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold">{copy.creditPacks}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.packsBody}
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {creditPacks.map((pack) => (
            <Card key={pack.sku}>
              <CardHeader>
                <CardTitle>
                  {localizedCreditPackName(pack.sku, locale)}
                </CardTitle>
                <div className="pt-3">
                  <span className="text-3xl font-semibold">
                    {formatUsd(pack.priceCents, locale)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    {copy.oneTime}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="border-y py-4">
                  <p className="text-2xl font-semibold">
                    {formatDashboardNumber(pack.credits, locale)}{" "}
                    {dashboardCopy[locale].detail.credits}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {copy.includes}{" "}
                    {formatDashboardNumber(pack.bonus, locale)}{" "}
                    {copy.bonusCredits}
                  </p>
                </div>
                <CheckoutButton
                  sku={pack.sku}
                  variant="outline"
                  locale={locale}
                >
                  {copy.buy} {localizedCreditPackName(pack.sku, locale)}
                </CheckoutButton>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="border bg-white p-5 text-sm leading-6 text-muted-foreground">
        {copy.stripeNote}
      </div>
    </div>
  )
}

function BillingMetric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string
  value: string
  note: string
  icon: typeof CoinsIcon
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="size-4 text-primary" />
        </div>
        <p className="mt-3 text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}
