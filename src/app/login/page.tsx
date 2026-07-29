import Link from "next/link"
import { signIn } from "@/app/auth/actions"
import { AuthCard } from "@/components/auth/auth-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const metadata = { title: "Log in" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    message?: string
    next?: string
  }>
}) {
  const params = await searchParams

  return (
    <AuthCard
      eyebrow="Customer workspace"
      title="Welcome back"
      body="Log in to submit plans, follow processing, download deliverables, and manage credits."
      footer={
        <>
          New to Cuadrabot?{" "}
          <Link href="/signup" className="font-medium text-primary">
            Create an account
          </Link>
        </>
      }
    >
      <form action={signIn} className="space-y-5">
        {params.error ? (
          <Alert variant="destructive">
            <AlertDescription>{params.error}</AlertDescription>
          </Alert>
        ) : null}
        {params.message ? (
          <Alert>
            <AlertDescription>{params.message}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full">
          Log in
        </Button>
      </form>
    </AuthCard>
  )
}
