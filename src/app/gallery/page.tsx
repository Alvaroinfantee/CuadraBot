import { redirect } from "next/navigation"

export const metadata = {
  title: "Takeoff quote",
}

export default function GalleryPage() {
  redirect("/pricing")
}
