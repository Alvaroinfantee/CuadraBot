import { OrderUploadContent } from "@/app/order/upload/page"

export const metadata = {
  title: "Sube tus planos",
}

export default function SpanishOrderUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>
}) {
  return <OrderUploadContent locale="es" searchParams={searchParams} />
}
