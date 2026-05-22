import { redirect } from "next/navigation"

export const metadata = {
  title: "Project quote",
}

export default function QuotePage() {
  redirect("/pricing")
}
