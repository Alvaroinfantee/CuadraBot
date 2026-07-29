import Link from "next/link"
import { sendPasswordReset } from "@/app/auth/actions"
import { AuthCard } from "@/components/auth/auth-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const metadata = { title: "Reset password" }

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Reset your password"
      body="We will email a secure reset link if the address belongs to a Cuadrabot account."
      footer={
        <Link href="/login" className="font-medium text-primary">
          Back to login
        </Link>
      }
    >
      <form action={sendPasswordReset} className="space-y-5">
        {params.error ? (
          <Alert variant="destructive">
            <AlertDescription>{params.error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <Button type="submit" size="lg" className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  )
}
