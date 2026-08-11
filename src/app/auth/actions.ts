"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getSiteUrl } from "@/lib/config"
import {
  localizedPublicPath,
  normalizeLocale,
  type Locale,
} from "@/lib/i18n"
import type { AuthNoticeCode } from "@/lib/auth-notices"
import {
  getRequestLocale,
  persistRequestLocale,
} from "@/lib/i18n-server"
import { safeRelativePath } from "@/lib/safe-redirect"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { signInNoticeCode } from "@/lib/auth-errors"
import {
  marketingAccountCreatedCookieName,
} from "@/lib/marketing-consent"

function textField(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

function actionRedirectPath(
  path: string,
  locale: Locale,
  params: Record<string, string | undefined> = {}
) {
  const target = new URL(path, "https://cuadrabot.invalid")
  target.searchParams.delete("lang")
  if (locale === "es") target.searchParams.set("lang", locale)

  for (const [name, value] of Object.entries(params)) {
    if (value) target.searchParams.set(name, value)
  }

  return `${target.pathname}${target.search}${target.hash}`
}

function authError(
  path: string,
  locale: Locale,
  code: AuthNoticeCode,
  params: Record<string, string | undefined> = {}
): never {
  redirect(actionRedirectPath(path, locale, { ...params, error: code }))
}

async function getActionLocale(formData: FormData) {
  const locale = normalizeLocale(textField(formData, "locale"))
  await persistRequestLocale(locale)
  return locale
}

export async function signIn(formData: FormData) {
  const locale = await getActionLocale(formData)
  const email = textField(formData, "email")
  const password = textField(formData, "password")
  const next = safeRelativePath(textField(formData, "next"))

  if (!email || !password) {
    redirect(
      actionRedirectPath("/login", locale, {
        error: "missing_credentials",
        next,
      })
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.warn("Supabase sign-in failed.", {
      code: error.code ?? "unknown",
      status: error.status ?? null,
    })
    redirect(
      actionRedirectPath("/login", locale, {
        error: signInNoticeCode(error),
        next,
      })
    )
  }

  redirect(next)
}

export async function signUp(formData: FormData) {
  const locale = await getActionLocale(formData)
  const fullName = textField(formData, "fullName")
  const companyName = textField(formData, "companyName")
  const email = textField(formData, "email")
  const password = textField(formData, "password")
  const next = safeRelativePath(
    textField(formData, "next"),
    "/dashboard/new?mode=sample"
  )

  if (fullName.length < 2) {
    authError("/signup", locale, "missing_profile", { next })
  }

  if (!email || password.length < 10) {
    authError("/signup", locale, "invalid_signup", { next })
  }

  const confirmationUrl = new URL("/auth/confirm", getSiteUrl())
  confirmationUrl.searchParams.set("next", next)
  confirmationUrl.searchParams.set("created", "1")
  if (locale === "es") confirmationUrl.searchParams.set("lang", locale)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmationUrl.toString(),
      data: {
        full_name: fullName,
        company_name: companyName,
        preferred_locale: locale,
      },
    },
  })

  if (error) authError("/signup", locale, "signup_failed", { next })

  if (data.session) {
    const cookieStore = await cookies()
    cookieStore.set(marketingAccountCreatedCookieName, "1", {
      httpOnly: false,
      maxAge: 15 * 60,
      path: "/",
      sameSite: "lax",
      secure: getSiteUrl().startsWith("https://"),
    })
    redirect(next)
  }

  redirect(
    actionRedirectPath("/login", locale, {
      message: "confirm_email",
      next,
    })
  )
}

export async function sendPasswordReset(formData: FormData) {
  const locale = await getActionLocale(formData)
  const email = textField(formData, "email")
  if (!email) authError("/forgot-password", locale, "missing_email")

  const confirmationUrl = new URL("/auth/confirm", getSiteUrl())
  confirmationUrl.searchParams.set("next", "/reset-password")
  if (locale === "es") confirmationUrl.searchParams.set("lang", locale)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: confirmationUrl.toString(),
  })

  if (error) authError("/forgot-password", locale, "reset_failed")

  redirect(
    actionRedirectPath("/login", locale, {
      message: "reset_sent",
    })
  )
}

export async function updatePassword(formData: FormData) {
  const locale = await getActionLocale(formData)
  const password = textField(formData, "password")
  if (password.length < 10) {
    authError("/reset-password", locale, "short_password")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) authError("/reset-password", locale, "update_failed")

  redirect("/dashboard")
}

export async function signOut() {
  const locale = await getRequestLocale()
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect(localizedPublicPath("/", locale))
}
