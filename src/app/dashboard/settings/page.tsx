import { updateCompanyProfile } from "@/app/dashboard/actions"
import { PageHeader } from "@/components/dashboard/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCurrentProfile, requireUser } from "@/lib/auth"

export const metadata = { title: "Company settings" }

export default async function CompanySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  await requireUser("/dashboard/settings")
  const [profile, params] = await Promise.all([
    getCurrentProfile(),
    searchParams,
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace profile"
        title="Company settings"
        description="Keep contact and coarse location information accurate for support, tax operations, and regional reporting."
      />
      {params.saved ? (
        <Alert>
          <AlertDescription>Company settings saved.</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateCompanyProfile} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Your name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    defaultValue={profile?.full_name ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    defaultValue={profile?.company_name ?? ""}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="countryCode">Country code</Label>
                  <Input
                    id="countryCode"
                    name="countryCode"
                    maxLength={2}
                    placeholder="US"
                    defaultValue={profile?.country_code ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">Region / state</Label>
                  <Input
                    id="region"
                    name="region"
                    defaultValue={profile?.region ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={profile?.city ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  placeholder="America/New_York"
                  defaultValue={profile?.timezone ?? ""}
                />
              </div>
              <Button type="submit">Save profile</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy and account requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              Request a copy, correction, deletion, or account closure by
              emailing from the account address. We verify identity and retain
              billing records where law requires.
            </p>
            <a
              href="mailto:privacy@cuadrabot.com?subject=Cuadrabot data request"
              className="inline-flex font-medium text-primary"
            >
              Email privacy@cuadrabot.com
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
