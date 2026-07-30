import type { Metadata } from "next"
import { updatePassword } from "@/app/auth/actions"
import { AuthCard } from "@/components/auth/auth-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { localizeAuthNotice } from "@/lib/auth-notices"
import {
  buildLocalizedAuthMetadata,
  type Locale,
} from "@/lib/i18n"
import { getRequestLocale } from "@/lib/i18n-server"

type ResetPasswordSearchParams = {
  error?: string
  lang?: string
}

const copy = {
  en: {
    metadataTitle: "Choose a new password",
    eyebrow: "Account recovery",
    title: "Choose a new password",
    body: "Use at least 10 characters and avoid a password used on another service.",
    footer: "Your active Cuadrabot session will continue after the update.",
    password: "New password",
    submit: "Update password",
  },
  es: {
    metadataTitle: "Elige una nueva contraseña",
    eyebrow: "Recuperación de cuenta",
    title: "Elige una nueva contraseña",
    body: "Usa al menos 10 caracteres y evita una contraseña que utilices en otro servicio.",
    footer: "Tu sesión activa de Cuadrabot continuará después del cambio.",
    password: "Nueva contraseña",
    submit: "Actualizar contraseña",
  },
} satisfies Record<Locale, Record<string, string>>

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ResetPasswordSearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const locale = await getRequestLocale(params.lang)
  return buildLocalizedAuthMetadata({
    locale,
    title: copy[locale].metadataTitle,
    description: copy[locale].body,
  })
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<ResetPasswordSearchParams>
}) {
  const params = await searchParams
  const locale = await getRequestLocale(params.lang)
  const text = copy[locale]
  const errorMessage = localizeAuthNotice(
    params.error,
    locale,
    "update_failed"
  )

  return (
    <AuthCard
      locale={locale}
      eyebrow={text.eyebrow}
      title={text.title}
      body={text.body}
      footer={text.footer}
    >
      <form action={updatePassword} className="space-y-5">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" name="locale" value={locale} />
        <div className="space-y-2">
          <Label htmlFor="password">{text.password}</Label>
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
          {text.submit}
        </Button>
      </form>
    </AuthCard>
  )
}
