import { NextResponse } from "next/server"
import { getAppFeatures } from "@/lib/app-settings"
import {
  BILLING_CATALOG_VERSION,
  getBillingCatalogConfigurationIssues,
  getPublicBillingCatalog,
} from "@/lib/billing-catalog"

export const dynamic = "force-dynamic"

export async function GET() {
  const features = await getAppFeatures()
  if (features.configurationError) {
    return NextResponse.json(
      { error: "Billing settings are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
  const plans = getPublicBillingCatalog().filter(
    (plan) => features.subscriptions || plan.kind !== "subscription"
  )
  return NextResponse.json(
    {
      catalogVersion: BILLING_CATALOG_VERSION,
      plans,
      configured: getBillingCatalogConfigurationIssues().length === 0,
      subscriptionsEnabled: features.subscriptions,
      maintenance: features.maintenance,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
