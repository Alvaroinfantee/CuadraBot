import { OrderStatusContent } from "@/app/orders/[publicToken]/page"

export const metadata = {
  title: "Estado del pedido",
}

export const dynamic = "force-dynamic"

export default function SpanishOrderStatusPage({
  params,
}: {
  params: Promise<{ publicToken: string }>
}) {
  return <OrderStatusContent locale="es" params={params} />
}
