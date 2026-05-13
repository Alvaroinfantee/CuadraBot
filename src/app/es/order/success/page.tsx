import { OrderSuccessContent } from "@/app/order/success/page"

export const metadata = {
  title: "Pedido confirmado",
}

export const dynamic = "force-dynamic"

export default function SpanishOrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  return <OrderSuccessContent locale="es" searchParams={searchParams} />
}
