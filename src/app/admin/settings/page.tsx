import { updateSetting } from "@/app/admin/actions"
import { updateProjectFileRetention } from "@/app/admin/retention-actions"
import { AdminHeader } from "@/components/admin/admin-ui"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAdminSnapshot } from "@/lib/admin-data"
import {
  DEFAULT_PROJECT_FILE_RETENTION_DAYS,
  MAX_PROJECT_FILE_RETENTION_DAYS,
  MIN_PROJECT_FILE_RETENTION_DAYS,
  parseProjectFileRetentionDays,
  PROJECT_FILE_RETENTION_SETTING_KEY,
} from "@/lib/project-file-retention"

export const metadata = { title: "Admin settings" }

const editable = new Set([
  "features.free_sample",
  "features.subscriptions",
  "features.maintenance",
])

export default async function AdminSettingsPage() {
  const data = await getAdminSnapshot()
  const retentionSetting = data.settings.find(
    (setting) => setting.key === PROJECT_FILE_RETENTION_SETTING_KEY
  )
  const parsedRetention = parseProjectFileRetentionDays(retentionSetting?.value)
  const displayedRetentionDays = parsedRetention.ok
    ? parsedRetention.days
    : DEFAULT_PROJECT_FILE_RETENTION_DAYS

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Configuration"
        title="Product settings"
        body="Manage launch switches and generated-file retention without editing code. Every update requires a reason and is written to the audit log."
      />
      <Alert>
        <AlertTitle>Settings are not secret storage</AlertTitle>
        <AlertDescription>
          Stripe keys, Supabase keys, worker secrets, and processor credentials
          belong in the deployment secret manager, never in this table.
        </AlertDescription>
      </Alert>
      {!parsedRetention.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Retention setting needs attention</AlertTitle>
          <AlertDescription>
            Scheduled generated-file deletion is paused because the setting is
            missing or invalid. Saving the form below restores a valid value.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Generated-file retention</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Keep processor inputs and generated takeoff deliverables for this
            many days after a job is completed, failed, or canceled. Verified
            original plans in the secure source archive are not deleted by this
            control. Account, billing, credit, job, and audit records are also
            unaffected.
          </p>
        </CardHeader>
        <CardContent>
          <form action={updateProjectFileRetention} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-file-retention-days">
                Generated-file window in days
              </Label>
              <Input
                id="project-file-retention-days"
                name="days"
                type="number"
                min={MIN_PROJECT_FILE_RETENTION_DAYS}
                max={MAX_PROJECT_FILE_RETENTION_DAYS}
                step={1}
                defaultValue={displayedRetentionDays}
                required
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Allowed range: {MIN_PROJECT_FILE_RETENTION_DAYS}–
                {MAX_PROJECT_FILE_RETENTION_DAYS} days. Launch default:{" "}
                {DEFAULT_PROJECT_FILE_RETENTION_DAYS} days. Changes affect the
                generated-file commitment and should be approved by the
                operator responsible for privacy and support. Source-plan
                deletion is a separate, audited request workflow.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-file-retention-reason">
                Reason for changing retention
              </Label>
              <Input
                id="project-file-retention-reason"
                name="reason"
                minLength={5}
                maxLength={500}
                placeholder="For example: approved annual privacy review"
                required
              />
            </div>
            <Button type="submit">Save retention window</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        {data.settings
          .filter(
            (setting) => setting.key !== PROJECT_FILE_RETENTION_SETTING_KEY
          )
          .map((setting) => (
            <Card key={setting.key}>
              <CardHeader>
                <CardTitle className="font-mono text-base">
                  {setting.key}
                </CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  {setting.description}
                </p>
              </CardHeader>
              <CardContent>
                {editable.has(setting.key) ? (
                  <form action={updateSetting} className="space-y-4">
                    <input type="hidden" name="key" value={setting.key} />
                    <div className="space-y-2">
                      <Label htmlFor={`${setting.key}-value`}>JSON value</Label>
                      <Input
                        id={`${setting.key}-value`}
                        name="value"
                        defaultValue={JSON.stringify(setting.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${setting.key}-reason`}>Reason</Label>
                      <Input
                        id={`${setting.key}-reason`}
                        name="reason"
                        placeholder="Why is this changing?"
                        required
                      />
                    </div>
                    <Button type="submit">Save setting</Button>
                  </form>
                ) : (
                  <pre className="overflow-x-auto border bg-muted/30 p-4 text-xs">
                    {JSON.stringify(setting.value, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  )
}
