import { redirect } from "next/navigation"

export const metadata = {
  title: "Takeoff quote",
}

export default function ClientOrderPreviewPage() {
  redirect("/pricing")
}
