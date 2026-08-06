import Link from "next/link"
import { notFound } from "next/navigation"
import { DemoTakeoffForm } from "@/components/demo/demo-takeoff-form"
import { PageHeader } from "@/components/dashboard/page-header"
import { canShowDemo } from "@/lib/demo"

export default function DemoNewTakeoffPage() {
  if (!canShowDemo()) notFound()
  return (
    <main className="min-h-screen bg-[#f5f7fa] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>Preview mode — your selected file is never uploaded.</span>
          <Link href="/demo" className="font-medium underline">
            Exit preview
          </Link>
        </div>
        <PageHeader
          eyebrow="New project preview"
          title="Upload a legend-based plan set"
          description="Test the category, PDF, fixed-quote, and confirmation states for fixture, device, and supported cable or conduit takeoffs without creating data or consuming credits."
        />
        <div className="mt-8">
          <DemoTakeoffForm />
        </div>
      </div>
    </main>
  )
}
