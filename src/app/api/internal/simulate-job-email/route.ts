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
  const adminUrl = `${siteUrl}/admin/orders/demo-takeoff-preview`
  const customerStatusUrl = `${siteUrl}/pricing`
  const shared = {
    orderNumber,
    customerEmail: "client@example.com",
    packageName: "PDF Takeoff",
    amount: "$90",
    adminUrl,
  }

  const ownerEmail = ownerJobRequestEmail({
    ...shared,
    customerName: "Demo Client",
    status: "paid_pending_processing",
    renderType: "Takeoff",
    projectType: "Other",
    stylePreference: "Other",
    numberOfFloors: null,
    estimatedSquareMeters: null,
    deadlinePreference: "Takeoff delivery within 7 days",
    customerNotes:
      "Simulation only. Client wants a PDF takeoff for flooring, walls, and openings. Plans include scale and dimensions.",
    customerStatusUrl,
    files: [
      {
        role: "customer_upload",
        name: "demo-takeoff-plans.pdf",
        signedUrl: null,
      },
      {
        role: "customer_upload",
        name: "demo-scope-notes.pdf",
        signedUrl: null,
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
