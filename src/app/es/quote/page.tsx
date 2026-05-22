import { redirect } from "next/navigation"

export const metadata = {
  title: "Cotizar proyecto",
}

export default function SpanishQuotePage() {
  redirect("/es/pricing")
}
