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
import { creditPacks, subscriptionPlans } from "@/lib/takeoff-pricing"

export const metadata = { title: "Credits and billing" }

export default async function BillingPage() {
  const user = await requireUser("/dashboard/billing")
  const [{ credits, subscription }, features] = await Promise.all([
    getCustomerWorkspace(user.id),
    getAppFeatures(),
  ])

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Billing"
        title="Credits and plans"
        description="Buy reusable credits or subscribe for a monthly allocation. Plans are optional, there are no seat licenses, and usage is never unlimited."
        action={subscription ? <BillingPortalButton /> : undefined}
      />

      {features.maintenance || features.configurationError ? (
        <Alert>
          <AlertTitle>New purchases are temporarily paused</AlertTitle>
          <AlertDescription>{features.maintenanceMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <BillingMetric
          label="Available"
          value={credits.balance.toLocaleString()}
          note="Ready to reserve"
          icon={CoinsIcon}
        />
        <BillingMetric
          label="Granted all time"
          value={credits.lifetime_granted.toLocaleString()}
          note="Packs, plans, and adjustments"
          icon={CreditCardIcon}
        />
        <BillingMetric
          label="Used all time"
          value={credits.lifetime_consumed.toLocaleString()}
          note="Settled takeoffs"
          icon={RefreshCwIcon}
        />
      </div>

      {features.subscriptions ? (
      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold">Monthly plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Credits grant after each successfully paid invoice. Launch credits
            do not expire.
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
                  <CardTitle>{plan.name}</CardTitle>
                  {index === 1 ? <Badge>Most flexible</Badge> : null}
                </div>
                <div className="pt-3">
                  <span className="text-3xl font-semibold">
                    ${(plan.priceCents / 100).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground"> / month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-2">
                    <CheckIcon className="size-4 text-primary" />
                    {plan.credits.toLocaleString()} credits each month
                  </li>
                  <li className="flex gap-2">
                    <CheckIcon className="size-4 text-primary" />
                    No launch credit expiry
                  </li>
                  <li className="flex gap-2">
                    <CheckIcon className="size-4 text-primary" />
                    Cancel at period end
                  </li>
                </ul>
                <CheckoutButton
                  sku={plan.sku}
                  variant={index === 1 ? "default" : "outline"}
                >
                  Choose {plan.name}
                </CheckoutButton>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      ) : null}

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold">Credit packs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Best for occasional or seasonal bid volume. Launch credits do not
            expire.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {creditPacks.map((pack) => (
            <Card key={pack.sku}>
              <CardHeader>
                <CardTitle>{pack.name}</CardTitle>
                <div className="pt-3">
                  <span className="text-3xl font-semibold">
                    ${(pack.priceCents / 100).toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    one time
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="border-y py-4">
                  <p className="text-2xl font-semibold">
                    {pack.credits.toLocaleString()} credits
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Includes {pack.bonus.toLocaleString()} bonus credits
                  </p>
                </div>
                <CheckoutButton sku={pack.sku} variant="outline">
                  Buy {pack.name}
                </CheckoutButton>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="border bg-white p-5 text-sm leading-6 text-muted-foreground">
        Stripe hosts payment collection and the billing portal. Cuadrabot
        grants internal takeoff credits only after a signed payment webhook;
        returning from Checkout never grants credits by itself.
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
