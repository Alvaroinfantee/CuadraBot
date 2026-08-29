import { Suspense } from "react"
import { LocalOrderFlow } from "@/components/takeoff/local-order-flow"

export const metadata = {
  title: "Upload plans and order a drywall takeoff",
  alternates: {
    canonical: "/en/order",
    languages: { es: "/pedido", en: "/en/order" },
  },
}

export default function EnglishOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f7f4]" />}>
      <LocalOrderFlow locale="en" />
    </Suspense>
  )
}
