import "server-only"

import { Resend } from "resend"
import { getOptionalEnv } from "@/lib/config"

type EmailPayload = {
  to: string
  subject: string
  html: string
  text: string
}

type OwnerJobEmailFile = {
  name: string
  role: string
  signedUrl: string | null
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function field(label: string, value: string | number | null | undefined) {
  return `${label}: ${value || "-"}`
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

export function ownerJobRequestEmail(input: {
  orderNumber: string
  customerName: string | null
  customerEmail: string
  packageName: string
  amount: string
  status: string
  renderType: string | null
  projectType: string | null
  stylePreference: string | null
  numberOfFloors: number | null
  estimatedSquareMeters: number | null
  deadlinePreference: string | null
  customerNotes: string | null
  adminUrl: string
  customerStatusUrl: string
  files: OwnerJobEmailFile[]
}) {
  const subject = `New Cuadrabot job: ${input.orderNumber}`
  const lines = [
    `New Cuadrabot job arrived.`,
    "",
    field("Order", input.orderNumber),
    field("Status", input.status),
    field("Customer", input.customerName),
    field("Customer email", input.customerEmail),
    field("Package", input.packageName),
    field("Amount", input.amount),
    field("Render type", input.renderType),
    field("Project type", input.projectType),
    field("Style preference", input.stylePreference),
    field("Floors", input.numberOfFloors),
    field("Estimated square meters", input.estimatedSquareMeters),
    field("Deadline preference", input.deadlinePreference),
    "",
    "Customer notes:",
    input.customerNotes || "-",
    "",
    "Files:",
    ...(
      input.files.length
        ? input.files.map((file) => `${file.role}: ${file.name}${file.signedUrl ? ` - ${file.signedUrl}` : ""}`)
        : ["No files found."]
    ),
    "",
    `Admin: ${input.adminUrl}`,
    `Customer status page: ${input.customerStatusUrl}`,
  ]
  const fileItems = input.files.length
    ? input.files
        .map((file) =>
          `<li><strong>${escapeHtml(file.role)}</strong>: ${
            file.signedUrl
              ? `<a href="${escapeHtml(file.signedUrl)}">${escapeHtml(file.name)}</a>`
              : escapeHtml(file.name)
          }</li>`
        )
        .join("")
    : "<li>No files found.</li>"
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <h1 style="font-size:22px">New Cuadrabot job</h1>
      <p><strong>${escapeHtml(input.orderNumber)}</strong> is paid and ready for processing.</p>
      <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
        <tr><td><strong>Status</strong></td><td>${escapeHtml(input.status)}</td></tr>
        <tr><td><strong>Customer</strong></td><td>${escapeHtml(input.customerName || "-")}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(input.customerEmail)}</td></tr>
        <tr><td><strong>Package</strong></td><td>${escapeHtml(input.packageName)}</td></tr>
        <tr><td><strong>Amount</strong></td><td>${escapeHtml(input.amount)}</td></tr>
        <tr><td><strong>Render type</strong></td><td>${escapeHtml(input.renderType || "-")}</td></tr>
        <tr><td><strong>Project type</strong></td><td>${escapeHtml(input.projectType || "-")}</td></tr>
        <tr><td><strong>Style</strong></td><td>${escapeHtml(input.stylePreference || "-")}</td></tr>
        <tr><td><strong>Floors</strong></td><td>${escapeHtml(input.numberOfFloors ?? "-")}</td></tr>
        <tr><td><strong>Square meters</strong></td><td>${escapeHtml(input.estimatedSquareMeters ?? "-")}</td></tr>
        <tr><td><strong>Deadline</strong></td><td>${escapeHtml(input.deadlinePreference || "-")}</td></tr>
      </table>
      <h2 style="font-size:18px">Customer notes</h2>
      <p style="white-space:pre-wrap">${escapeHtml(input.customerNotes || "-")}</p>
      <h2 style="font-size:18px">Blueprint files</h2>
      <ul>${fileItems}</ul>
      <p><a href="${escapeHtml(input.adminUrl)}">Open admin order</a></p>
      <p><a href="${escapeHtml(input.customerStatusUrl)}">Customer status page</a></p>
    </div>`

  return { subject, text: lines.join("\n"), html }
}

export function ownerJobReminderEmail(input: {
  orderNumber: string
  customerEmail: string
  packageName: string
  amount: string
  adminUrl: string
}) {
  const subject = `Reminder: Cuadrabot job ${input.orderNumber}`
  const text = `A new paid Cuadrabot job arrived.\n\nOrder: ${input.orderNumber}\nCustomer: ${input.customerEmail}\nPackage: ${input.packageName}\nAmount: ${input.amount}\nAdmin: ${input.adminUrl}`
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <h1 style="font-size:22px">Cuadrabot job reminder</h1>
      <p>A new paid job arrived: <strong>${escapeHtml(input.orderNumber)}</strong>.</p>
      <p>${escapeHtml(input.packageName)} · ${escapeHtml(input.amount)} · ${escapeHtml(input.customerEmail)}</p>
      <p><a href="${escapeHtml(input.adminUrl)}">Open admin order</a></p>
    </div>`

  return { subject, text, html }
}
