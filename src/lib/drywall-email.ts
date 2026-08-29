import "server-only"

import { Resend } from "resend"
import { getOptionalEnv } from "@/lib/config"

type Message = {
  to: string | string[]
  subject: string
  html: string
}

export async function sendDrywallEmail(message: Message) {
  const apiKey = getOptionalEnv("RESEND_API_KEY")
  const from =
    getOptionalEnv("FROM_EMAIL") ?? "Cuadrabot <pedidos@cuadrabot.com>"
  if (!apiKey) return { sent: false, reason: "not_configured" as const }

  const { error } = await new Resend(apiKey).emails.send({ from, ...message })
  if (error) throw new Error(error.message)
  return { sent: true as const }
}

export function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
