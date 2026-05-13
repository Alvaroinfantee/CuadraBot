import { NextResponse } from "next/server"
import {
  getSiteUrl,
  jobReminderEmail,
  ownerRequestEmail,
  simulationEmailToken,
} from "@/lib/config"
import {
  ownerJobReminderEmail,
  ownerJobRequestEmail,
  sendTransactionalEmail,
} from "@/lib/email"
import { getBearerToken, jsonError } from "@/lib/http"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!simulationEmailToken) {
    return jsonError("Simulation email token is not configured.", 503)
  }

  if (getBearerToken(request) !== simulationEmailToken) {
    return jsonError("Unauthorized.", 401)
  }

  const siteUrl = getSiteUrl()
  const orderNumber = `CB-DEMO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`
  const adminUrl = `${siteUrl}/admin/orders/demo-preview`
  const customerStatusUrl = `${siteUrl}/demo/client-order`
  const shared = {
    orderNumber,
    customerEmail: "client@example.com",
    packageName: "Render Pro",
    amount: "$299",
    adminUrl,
  }

  const ownerEmail = ownerJobRequestEmail({
    ...shared,
    customerName: "Demo Client",
    status: "paid_pending_processing",
    renderType: "Exterior",
    projectType: "House",
    stylePreference: "Modern Mediterranean",
    numberOfFloors: 2,
    estimatedSquareMeters: 240,
    deadlinePreference: "As soon as possible",
    customerNotes:
      "Simulation only. Client wants a clean exterior render from the uploaded elevation and floor plan, with warm evening lighting and neutral materials.",
    customerStatusUrl,
    files: [
      {
        role: "customer_upload",
        name: "demo-floor-plan-and-elevation.png",
        signedUrl: `${siteUrl}/images/gallery-mediterranean-villa.png`,
      },
      {
        role: "customer_upload",
        name: "demo-site-reference.png",
        signedUrl: `${siteUrl}/images/gallery-multi-unit-development.png`,
      },
    ],
  })
  const reminderEmail = ownerJobReminderEmail(shared)

  const [ownerResult, reminderResult] = await Promise.all([
    sendTransactionalEmail({
      to: ownerRequestEmail,
      ...ownerEmail,
    }),
    sendTransactionalEmail({
      to: jobReminderEmail,
      ...reminderEmail,
    }),
  ])

  return NextResponse.json({
    ok: true,
    orderNumber,
    ownerRequestEmail,
    jobReminderEmail,
    customerStatusUrl,
    ownerEmail: ownerResult,
    reminderEmail: reminderResult,
  })
}
