import { PageHeader } from "@/components/dashboard/page-header"
import { NewTakeoffForm } from "@/components/takeoff/new-takeoff-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getAppFeatures } from "@/lib/app-settings"
import { getCurrentProfile, requireUser } from "@/lib/auth"
import { getCustomerWorkspace } from "@/lib/customer-dashboard"

export const metadata = { title: "New takeoff" }

export default async function NewTakeoffPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const user = await requireUser("/dashboard/new")
  const [workspace, profile, params, features] = await Promise.all([
    getCustomerWorkspace(user.id),
    getCurrentProfile(),
    searchParams,
    getAppFeatures(),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="New project"
        title="Upload plans for takeoff"
        description="Launch scope: flooring and finishes, drywall and ceilings, or doors and openings. Supported sets remain self-serve up to 250 pages."
      />
      {features.maintenance || features.configurationError ? (
        <Alert>
          <AlertTitle>New takeoffs are temporarily paused</AlertTitle>
          <AlertDescription>{features.maintenanceMessage}</AlertDescription>
        </Alert>
      ) : (
        <NewTakeoffForm
          availableCredits={workspace.credits.balance}
          sampleAvailable={
            features.freeSample && !profile?.free_sample_used_at
          }
          initialMode={
            params.mode === "sample" && features.freeSample
              ? "sample"
              : "standard"
          }
        />
      )}
    </div>
  )
}
