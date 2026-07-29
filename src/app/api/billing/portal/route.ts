import { NextResponse } from "next/server"
import { getActiveUser } from "@/lib/auth"
import { getSiteUrl } from "@/lib/config"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getStripe,
  StripeConfigurationError,
} from "@/lib/stripe"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  let user: Awaited<ReturnType<typeof getActiveUser>>

  try {
    user = await getActiveUser()
  } catch (error) {
    console.error("Billing authentication is not configured.", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Billing authentication is not configured.",
        code: "deployment_not_configured",
      },
      { status: 503 }
    )
  }

  if (!user) {
    return NextResponse.json(
      { error: "Authentication is required.", code: "authentication_required" },
      { status: 401 }
    )
  }

  try {
    const supabase = createSupabaseAdminClient()
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("stripe_customer_id,status")
      .eq("id", user.id)
      .maybeSingle()

    if (error) {
      throw new Error(`Could not read billing profile: ${error.message}`)
    }

    if (profile?.status !== "active") {
      return NextResponse.json(
        {
          error: "This workspace is not active.",
          code: "workspace_not_active",
        },
        { status: 403 }
      )
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        {
          error: "There is no billing account to manage yet.",
          code: "billing_account_not_found",
        },
        { status: 409 }
      )
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: new URL("/dashboard/billing", getSiteUrl()).toString(),
    })

    return NextResponse.json(
      { url: session.url },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (error) {
    console.error("Could not create Stripe Billing Portal Session.", error)

    if (error instanceof StripeConfigurationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          missing: [error.envName],
        },
        { status: 503 }
      )
    }

    if (
      error instanceof Error &&
      (error.message.startsWith("Missing required environment variable:") ||
        error.message.startsWith("Missing Supabase "))
    ) {
      return NextResponse.json(
        {
          error: error.message,
          code: "deployment_not_configured",
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: "Billing management is temporarily unavailable.",
        code: "billing_portal_unavailable",
      },
      { status: 500 }
    )
  }
}
