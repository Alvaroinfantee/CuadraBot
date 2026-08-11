import type { Metadata } from "next"
import Link from "next/link"
import { signIn } from "@/app/auth/actions"
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
import { safeRelativePath } from "@/lib/safe-redirect"

type LoginSearchParams = {
  error?: string
  message?: string
  next?: string
  lang?: string
}

const copy = {
  en: {
    metadataTitle: "Log in",
    eyebrow: "Customer workspace",
    title: "Welcome back",
    body: "Log in to submit plans, follow processing, download deliverables, and manage credits.",
    newUser: "New to Cuadrabot?",
    createAccount: "Create an account",
    email: "Work email",
    password: "Password",
    forgot: "Forgot password?",
    submit: "Log in",
  },
  es: {
    metadataTitle: "Iniciar sesión",
    eyebrow: "Espacio de trabajo",
    title: "Te damos la bienvenida",
    body: "Inicia sesión para enviar planos, seguir el procesamiento, descargar entregables y gestionar tus créditos.",
    newUser: "¿Aún no usas Cuadrabot?",
    createAccount: "Crear una cuenta",
    email: "Correo de trabajo",
    password: "Contraseña",
    forgot: "¿Has olvidado la contraseña?",
    submit: "Iniciar sesión",
  },
} satisfies Record<Locale, Record<string, string>>

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const locale = await getRequestLocale(params.lang)
  return buildLocalizedAuthMetadata({
    locale,
    title: copy[locale].metadataTitle,
    description: copy[locale].body,
  })
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>
}) {
  const params = await searchParams
  const locale = await getRequestLocale(params.lang)
  const text = copy[locale]
  const next = safeRelativePath(params.next)
  const errorMessage = localizeAuthNotice(
    params.error,
    locale,
    "request_failed"
  )
  const successMessage = localizeAuthNotice(params.message, locale)

  return (
    <AuthCard
      locale={locale}
      eyebrow={text.eyebrow}
      title={text.title}
      body={text.body}
      footer={
        <>
          {text.newUser}{" "}
          <Link
            href={localizedAuthPath(
              `/signup?next=${encodeURIComponent(next)}`,
              locale
            )}
            className="font-medium text-primary"
          >
            {text.createAccount}
          </Link>
        </>
      }
    >
      <form action={signIn} className="space-y-5">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {successMessage ? (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">{text.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">{text.password}</Label>
            <Link
              href={localizedAuthPath("/forgot-password", locale)}
              className="text-xs font-medium text-primary"
            >
              {text.forgot}
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
          {text.submit}
        </Button>
      </form>
    </AuthCard>
  )
}
