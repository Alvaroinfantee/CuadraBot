import { OrderContent } from "@/app/order/page"

export const metadata = {
  title: "Inicia tu render",
}

export default function SpanishOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <OrderContent locale="es" searchParams={searchParams} />
}
