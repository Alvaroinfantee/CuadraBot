import { updateCompanyProfile } from "@/app/dashboard/actions"
import { PageHeader } from "@/components/dashboard/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCurrentProfile, requireUser } from "@/lib/auth"
import { dashboardCopy } from "@/lib/dashboard-i18n"
import { getRequestLocale } from "@/lib/i18n-server"

export async function generateMetadata() {
  const locale = await getRequestLocale()
  return { title: dashboardCopy[locale].metadata.settings }
}

export default async function CompanySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  await requireUser("/dashboard/settings")
  const [profile, params, locale] = await Promise.all([
    getCurrentProfile(),
    searchParams,
    getRequestLocale(),
  ])
  const copy = dashboardCopy[locale].settings

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />
      {params.saved ? (
        <Alert>
          <AlertDescription>{copy.saved}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.profile}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateCompanyProfile} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{copy.yourName}</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    defaultValue={profile?.full_name ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">{copy.company}</Label>
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
                  <Label htmlFor="countryCode">{copy.countryCode}</Label>
                  <Input
                    id="countryCode"
                    name="countryCode"
                    maxLength={2}
                    placeholder="US"
                    defaultValue={profile?.country_code ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">{copy.region}</Label>
                  <Input
                    id="region"
                    name="region"
                    defaultValue={profile?.region ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{copy.city}</Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={profile?.city ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">{copy.timezone}</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  placeholder="America/New_York"
                  defaultValue={profile?.timezone ?? ""}
                />
              </div>
              <Button type="submit">{copy.save}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.privacyTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>{copy.privacyBody}</p>
            <a
              href={`mailto:privacy@cuadrabot.com?subject=${encodeURIComponent(
                copy.privacySubject
              )}`}
              className="inline-flex font-medium text-primary"
            >
              {copy.privacyEmail}
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
