import { redirect } from "next/navigation"

export const metadata = {
  title: "Cotizar takeoff",
}

export default function SpanishGalleryPage() {
  redirect("/es/pricing")
}
