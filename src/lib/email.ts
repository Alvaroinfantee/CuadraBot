import "server-only"

import { Resend } from "resend"
import { getOptionalEnv } from "@/lib/config"

type EmailPayload = {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendTransactionalEmail(payload: EmailPayload) {
  const apiKey = getOptionalEnv("RESEND_API_KEY")
  const from = getOptionalEnv("FROM_EMAIL") ?? "Cuadrabot <orders@cuadrabot.com>"

  if (!apiKey) {
    console.info("Skipping email because RESEND_API_KEY is not configured", {
      to: payload.to,
      subject: payload.subject,
    })
    return { status: "skipped", providerMessageId: null }
  }

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  })

  if (error) {
    throw new Error(error.message)
  }

  return { status: "sent", providerMessageId: data?.id ?? null }
}

export function orderConfirmationEmail(input: {
  orderNumber: string
  statusUrl: string
  packageName: string
}) {
  const subject = `Cuadrabot order ${input.orderNumber} is queued`
  const text = `We received your blueprint files and payment for ${input.packageName}. Your project is queued for rendering. Track it here: ${input.statusUrl}`
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <h1 style="font-size:22px">Your Cuadrabot order is queued</h1>
      <p>We received your blueprint files and payment for <strong>${input.packageName}</strong>.</p>
      <p>Your project is now queued for rendering. You can track status and download final renders here:</p>
      <p><a href="${input.statusUrl}">${input.statusUrl}</a></p>
      <p style="color:#555">Cuadrabot provides visualization services and does not replace licensed architectural, engineering, permitting, or construction documentation.</p>
    </div>`

  return { subject, text, html }
}

export function orderCompletedEmail(input: {
  orderNumber: string
  statusUrl: string
}) {
  const subject = `Cuadrabot order ${input.orderNumber} is ready`
  const text = `Your Cuadrabot renderings are ready. Download them here: ${input.statusUrl}`
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <h1 style="font-size:22px">Your renderings are ready</h1>
      <p>Your Cuadrabot order <strong>${input.orderNumber}</strong> is complete.</p>
      <p><a href="${input.statusUrl}">Download your final renders</a></p>
    </div>`

  return { subject, text, html }
}
