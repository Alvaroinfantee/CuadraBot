import type { Metadata } from "next"
import Link from "next/link"
import { signUp } from "@/app/auth/actions"
import { AuthCard } from "@/components/auth/auth-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { localizeAuthNotice } from "@/lib/auth-notices"
import {
  buildLocalizedAuthMetadata,
  localizedAuthPath,
  localizedPublicPath,
  type Locale,
} from "@/lib/i18n"
import { getRequestLocale } from "@/lib/i18n-server"
import { safeRelativePath } from "@/lib/safe-redirect"

type SignupSearchParams = {
  error?: string
  lang?: string
  next?: string
}

const copy = {
  en: {
    metadataTitle: "Create account",
    eyebrow: "Private company workspace",
    title: "Create your Cuadrabot account",
    body: "Create your private workspace and run one real blueprint sheet free. No credit card required.",
    trialTitle: "Your free trial is included",
    trialBody:
      "$0 today · no credit card · one real sheet · annotated PDF + Excel workbook. One trial per user.",
    existing: "Already have an account?",
    login: "Log in",
    name: "Your name",
    company: "Company (optional)",
    email: "Work email",
    password: "Password",
    passwordHelp: "At least 10 characters.",
    submit: "Create account",
    agreement: "By continuing, you agree to the",
    terms: "terms",
    and: "and",
    privacy: "privacy policy",
  },
  es: {
    metadataTitle: "Crear una cuenta",
    eyebrow: "Espacio de trabajo privado",
    title: "Crea tu cuenta de Cuadrabot",
    body: "Crea tu espacio de trabajo privado y prueba una hoja de un plano real gratis. No se requiere tarjeta.",
    trialTitle: "Tu prueba gratuita está incluida",
    trialBody:
      "0 $ hoy · sin tarjeta · una hoja real · PDF anotado + libro de Excel. Una prueba por usuario.",
    existing: "¿Ya tienes una cuenta?",
    login: "Iniciar sesión",
    name: "Tu nombre",
    company: "Empresa (opcional)",
    email: "Correo de trabajo",
    password: "Contraseña",
    passwordHelp: "Al menos 10 caracteres.",
    submit: "Crear una cuenta",
    agreement: "Al continuar, aceptas los",
    terms: "términos",
    and: "y la",
    privacy: "política de privacidad",
  },
} satisfies Record<Locale, Record<string, string>>

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SignupSearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const locale = await getRequestLocale(params.lang)
  return buildLocalizedAuthMetadata({
    locale,
    title: copy[locale].metadataTitle,
    description: copy[locale].body,
  })
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SignupSearchParams>
}) {
  const params = await searchParams
  const locale = await getRequestLocale(params.lang)
  const text = copy[locale]
  const next = safeRelativePath(
    params.next,
    "/dashboard/new?mode=sample"
  )
  const errorMessage = localizeAuthNotice(
    params.error,
    locale,
    "signup_failed"
  )

  return (
    <AuthCard
      locale={locale}
      eyebrow={text.eyebrow}
      title={text.title}
      body={text.body}
      footer={
        <>
          {text.existing}{" "}
          <Link
            href={localizedAuthPath(
              `/login?next=${encodeURIComponent(next)}`,
              locale
            )}
            className="font-medium text-primary"
          >
            {text.login}
          </Link>
        </>
      }
    >
      <form action={signUp} className="space-y-5">
        <Alert className="border-primary/40 bg-blue-50/70">
          <AlertTitle>{text.trialTitle}</AlertTitle>
          <AlertDescription>{text.trialBody}</AlertDescription>
        </Alert>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">{text.name}</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">{text.company}</Label>
            <Input
              id="companyName"
              name="companyName"
              autoComplete="organization"
            />
          </div>
        </div>
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
          <p className="text-xs text-muted-foreground">
            {text.passwordHelp}
          </p>
        </div>
        <Button type="submit" size="lg" className="w-full">
          {text.submit}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          {text.agreement}{" "}
          <Link
            href={localizedPublicPath("/terms", locale)}
            className="underline"
          >
            {text.terms}
          </Link>{" "}
          {text.and}{" "}
          <Link
            href={localizedPublicPath("/privacy", locale)}
            className="underline"
          >
            {text.privacy}
          </Link>
          .
        </p>
      </form>
    </AuthCard>
  )
}
