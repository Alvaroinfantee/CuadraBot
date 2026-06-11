import { redirect } from "next/navigation"

export const metadata = {
  title: "Takeoff quote",
}

export default function QuotePage() {
  redirect("/pricing")
}
