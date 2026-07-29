import { updatePassword } from "@/app/auth/actions"
import { AuthCard } from "@/components/auth/auth-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const metadata = { title: "Choose a new password" }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Choose a new password"
      body="Use at least 10 characters and avoid a password used on another service."
      footer="Your active Cuadrabot session will continue after the update."
    >
      <form action={updatePassword} className="space-y-5">
        {params.error ? (
          <Alert variant="destructive">
            <AlertDescription>{params.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={10}
            autoComplete="new-password"
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full">
          Update password
        </Button>
      </form>
    </AuthCard>
  )
}
