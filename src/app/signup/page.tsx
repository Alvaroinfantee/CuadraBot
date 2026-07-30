import type { Metadata } from "next"
import Link from "next/link"
import { signUp } from "@/app/auth/actions"
import { AuthCard } from "@/components/auth/auth-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
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

type SignupSearchParams = {
  error?: string
  lang?: string
}

const copy = {
  en: {
    metadataTitle: "Create account",
    eyebrow: "Free one-sheet sample",
    title: "Start with a real plan",
    body: "Create your company workspace. Your first one-sheet sample is free and plans stay private.",
    existing: "Already have an account?",
    login: "Log in",
    name: "Your name",
    company: "Company",
    email: "Work email",
    password: "Password",
    passwordHelp: "At least 10 characters.",
    submit: "Create workspace",
    agreement: "By continuing, you agree to the",
    terms: "terms",
    and: "and",
    privacy: "privacy policy",
  },
  es: {
    metadataTitle: "Crear una cuenta",
    eyebrow: "Muestra gratuita de una hoja",
    title: "Empieza con un plano real",
    body: "Crea el espacio de trabajo de tu empresa. La primera muestra de una hoja es gratuita y tus planos permanecen privados.",
    existing: "¿Ya tienes una cuenta?",
    login: "Iniciar sesión",
    name: "Tu nombre",
    company: "Empresa",
    email: "Correo de trabajo",
    password: "Contraseña",
    passwordHelp: "Al menos 10 caracteres.",
    submit: "Crear espacio de trabajo",
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
            href={localizedAuthPath("/login", locale)}
            className="font-medium text-primary"
          >
            {text.login}
          </Link>
        </>
      }
    >
      <form action={signUp} className="space-y-5">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" name="locale" value={locale} />
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
              required
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
