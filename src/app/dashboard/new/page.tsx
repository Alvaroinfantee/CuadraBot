import { PageHeader } from "@/components/dashboard/page-header"
import { NewTakeoffForm } from "@/components/takeoff/new-takeoff-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getAppFeatures } from "@/lib/app-settings"
import { getCurrentProfile, requireUser } from "@/lib/auth"
import { getCustomerWorkspace } from "@/lib/customer-dashboard"
import {
  dashboardCopy,
  localizeCustomerError,
} from "@/lib/dashboard-i18n"
import { getRequestLocale } from "@/lib/i18n-server"

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: dashboardCopy[locale].metadata.newTakeoff }
}

export default async function NewTakeoffPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const user = await requireUser("/dashboard/new")
  const [workspace, profile, params, features, locale] = await Promise.all([
    getCustomerWorkspace(user.id),
    getCurrentProfile(),
    searchParams,
    getAppFeatures(),
    getRequestLocale(),
  ])
  const copy = dashboardCopy[locale].newTakeoff

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />
      {features.maintenance || features.configurationError ? (
        <Alert>
          <AlertTitle>{copy.pausedTitle}</AlertTitle>
          <AlertDescription>
            {localizeCustomerError(
              features.maintenanceMessage,
              locale,
              copy.pausedBody
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {features.freeSample && !profile?.free_sample_used_at ? (
            <Alert className="border-primary/40 bg-blue-50/70">
              <AlertTitle>{copy.trialReadyTitle}</AlertTitle>
              <AlertDescription>{copy.trialReadyBody}</AlertDescription>
            </Alert>
          ) : null}
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
            locale={locale}
          />
        </>
      )}
    </div>
  )
}
