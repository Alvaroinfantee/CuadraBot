import "server-only"

import { cache } from "react"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { defaultCurrency, hasSupabaseServerEnv } from "@/lib/config"
import type { PackagePlan } from "@/lib/types"

export function getStripePriceIdForPackage(slug: string) {
  const bySlug: Record<string, string | undefined> = {
    "basic-render": process.env.STRIPE_BASIC_PRICE_ID,
    "pro-render": process.env.STRIPE_PRO_PRICE_ID ?? process.env.STRIPE_PRICE_PRO,
    "premium-render-pack": process.env.STRIPE_PREMIUM_PRICE_ID,
  }

  return bySlug[slug] ?? null
}

export const fallbackPackages: PackagePlan[] = [
  {
    id: "basic-render",
    slug: "basic-render",
    name: "Basic Render",
    description: "One clear, polished view to validate your idea quickly.",
    price_cents: 14900,
    currency: defaultCurrency,
    stripe_price_id: getStripePriceIdForPackage("basic-render"),
    included_views: 1,
    revision_rounds: 0,
    estimated_delivery_days_min: 3,
    estimated_delivery_days_max: 5,
    active: true,
    sort_order: 1,
  },
  {
    id: "pro-render",
    slug: "pro-render",
    name: "Pro Render",
    description: "The most balanced option for presenting your project with more detail.",
    price_cents: 29900,
    currency: defaultCurrency,
    stripe_price_id: getStripePriceIdForPackage("pro-render"),
    included_views: 2,
    revision_rounds: 2,
    estimated_delivery_days_min: 3,
    estimated_delivery_days_max: 5,
    active: true,
    sort_order: 2,
  },
  {
    id: "premium-render-pack",
    slug: "premium-render-pack",
    name: "Premium Render Pack",
    description: "Four views ready for presentation, sales, or client approval.",
    price_cents: 54900,
    currency: defaultCurrency,
    stripe_price_id: getStripePriceIdForPackage("premium-render-pack"),
    included_views: 4,
    revision_rounds: 2,
    estimated_delivery_days_min: 2,
    estimated_delivery_days_max: 4,
    active: true,
    sort_order: 3,
  },
]

export const getActivePackages = cache(async () => {
  if (!hasSupabaseServerEnv()) {
    return fallbackPackages
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })

  if (error || !data?.length) {
    return fallbackPackages
  }

  return data as PackagePlan[]
})

export async function getPackageBySlug(slug: string) {
  const packages = await getActivePackages()
  return packages.find((plan) => plan.slug === slug) ?? null
}
