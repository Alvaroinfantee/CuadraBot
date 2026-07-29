import { notFound } from "next/navigation"
import { requestCorrection } from "@/app/dashboard/actions"
import { PageHeader } from "@/components/dashboard/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { requireUser } from "@/lib/auth"
import { getCustomerJob } from "@/lib/customer-dashboard"
import {
  INCLUDED_CORRECTION_WINDOW_DAYS,
  isIncludedCorrectionWindowOpen,
} from "@/lib/project-file-retention"

export const metadata = { title: "Request a correction" }

export default async function CorrectionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser(`/dashboard/jobs/${id}/correction`)
  const { job, events } = await getCustomerJob(user.id, id)
  if (!job) notFound()
  const alreadyRequested = events.some(
    (event) => event.event_type === "correction_requested"
  )
  const correctionWindowOpen =
    !job.project_files_purged_at &&
    isIncludedCorrectionWindowOpen(job.completed_at ?? "")

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Included support"
        title="Request a correction"
        description={`Describe one in-scope correction for ${job.project_name}. New documents, revisions, or added trade scope require a new quote.`}
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Correction details</CardTitle>
        </CardHeader>
        <CardContent>
          {alreadyRequested ? (
            <Alert>
              <AlertTitle>Correction already requested</AlertTitle>
              <AlertDescription>
                The request is in the support queue. You can follow its status
                on the takeoff page.
              </AlertDescription>
            </Alert>
          ) : job.status !== "completed" ? (
            <Alert>
              <AlertTitle>Delivery is not complete</AlertTitle>
              <AlertDescription>
                A correction can be requested after the verified files are
                delivered.
              </AlertDescription>
            </Alert>
          ) : !correctionWindowOpen ? (
            <Alert>
              <AlertTitle>Included correction window closed</AlertTitle>
              <AlertDescription>
                Included corrections are available for{" "}
                {INCLUDED_CORRECTION_WINDOW_DAYS} days after delivery while
                the original project files are retained. Start a new takeoff
                for revised or additional work.
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
                placeholder="Identify the sheet, code or area, what you expected, and why. Keep the request within the approved scope and original plan set."
              />
              <Button type="submit">Send correction request</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
