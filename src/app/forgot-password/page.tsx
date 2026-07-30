import type { Metadata } from "next"
import Link from "next/link"
import { sendPasswordReset } from "@/app/auth/actions"
import { AuthCard } from "@/components/auth/auth-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { localizeAuthNotice } from "@/lib/auth-notices"
import {
  buildLocalizedAuthMetadata,
  localizedAuthPath,
  type Locale,
} from "@/lib/i18n"
import { getRequestLocale } from "@/lib/i18n-server"

type ForgotPasswordSearchParams = {
  error?: string
  lang?: string
}

const copy = {
  en: {
    metadataTitle: "Reset password",
    eyebrow: "Account recovery",
    title: "Reset your password",
    body: "We will email a secure reset link if the address belongs to a Cuadrabot account.",
    back: "Back to login",
    email: "Work email",
    submit: "Send reset link",
  },
  es: {
    metadataTitle: "Restablecer la contraseña",
    eyebrow: "Recuperación de cuenta",
    title: "Restablece tu contraseña",
    body: "Enviaremos un enlace seguro si la dirección pertenece a una cuenta de Cuadrabot.",
    back: "Volver al inicio de sesión",
    email: "Correo de trabajo",
    submit: "Enviar enlace",
  },
} satisfies Record<Locale, Record<string, string>>

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ForgotPasswordSearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const locale = await getRequestLocale(params.lang)
  return buildLocalizedAuthMetadata({
    locale,
    title: copy[locale].metadataTitle,
    description: copy[locale].body,
  })
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<ForgotPasswordSearchParams>
}) {
  const params = await searchParams
  const locale = await getRequestLocale(params.lang)
  const text = copy[locale]
  const errorMessage = localizeAuthNotice(
    params.error,
    locale,
    "reset_failed"
  )

  return (
    <AuthCard
      locale={locale}
      eyebrow={text.eyebrow}
      title={text.title}
      body={text.body}
      footer={
        <Link
          href={localizedAuthPath("/login", locale)}
          className="font-medium text-primary"
        >
          {text.back}
        </Link>
      }
    >
      <form action={sendPasswordReset} className="space-y-5">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" name="locale" value={locale} />
        <div className="space-y-2">
          <Label htmlFor="email">{text.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
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
