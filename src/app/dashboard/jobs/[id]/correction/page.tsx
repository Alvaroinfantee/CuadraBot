import { notFound } from "next/navigation"
import { requestCorrection } from "@/app/dashboard/actions"
import { PageHeader } from "@/components/dashboard/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { requireUser } from "@/lib/auth"
import { getCustomerJob } from "@/lib/customer-dashboard"
import { dashboardCopy } from "@/lib/dashboard-i18n"
import { getRequestLocale } from "@/lib/i18n-server"
import {
  INCLUDED_CORRECTION_WINDOW_DAYS,
  isIncludedCorrectionWindowOpen,
} from "@/lib/project-file-retention"

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: dashboardCopy[locale].metadata.correction }
}

export default async function CorrectionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser(`/dashboard/jobs/${id}/correction`)
  const [{ job, events }, locale] = await Promise.all([
    getCustomerJob(user.id, id),
    getRequestLocale(),
  ])
  if (!job) notFound()
  const copy = dashboardCopy[locale].correction
  const alreadyRequested = events.some(
    (event) => event.event_type === "correction_requested"
  )
  const correctionWindowOpen =
    !job.project_files_purged_at &&
    isIncludedCorrectionWindowOpen(job.completed_at ?? "")

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={`${copy.descriptionStart} ${job.project_name}. ${copy.descriptionEnd}`}
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{copy.details}</CardTitle>
        </CardHeader>
        <CardContent>
          {alreadyRequested ? (
            <Alert>
              <AlertTitle>{copy.alreadyTitle}</AlertTitle>
              <AlertDescription>{copy.alreadyBody}</AlertDescription>
            </Alert>
          ) : job.status !== "completed" ? (
            <Alert>
              <AlertTitle>{copy.incompleteTitle}</AlertTitle>
              <AlertDescription>{copy.incompleteBody}</AlertDescription>
            </Alert>
          ) : !correctionWindowOpen ? (
            <Alert>
              <AlertTitle>{copy.closedTitle}</AlertTitle>
              <AlertDescription>
                {copy.closedStart} {INCLUDED_CORRECTION_WINDOW_DAYS}{" "}
                {copy.closedEnd}
              </AlertDescription>
            </Alert>
          ) : (
            <form action={requestCorrection} className="space-y-5">
              <input type="hidden" name="jobId" value={job.id} />
              <Textarea
                name="message"
                rows={8}
                required
                minLength={10}
                maxLength={4_000}
                placeholder={copy.placeholder}
              />
              <Button type="submit">{copy.submit}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
