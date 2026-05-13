import { OrderContent } from "@/app/order/page"

export const metadata = {
  title: "Inicia tu render",
}

export default function SpanishOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string; cancelled?: string }>
}) {
  return <OrderContent locale="es" searchParams={searchParams} />
}
