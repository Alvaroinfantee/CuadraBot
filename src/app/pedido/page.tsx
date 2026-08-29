import { Suspense } from "react"
import { LocalOrderFlow } from "@/components/takeoff/local-order-flow"

export const metadata = { title: "Subir planos y pedir medicion" }

export default function OrderPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#f5f7f4]" />}><LocalOrderFlow /></Suspense>
}
