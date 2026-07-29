"use server"

import { redirect } from "next/navigation"
import { getSiteUrl } from "@/lib/config"
import { safeRelativePath } from "@/lib/safe-redirect"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function textField(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

function authError(path: string, message: string) {
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

export async function signIn(formData: FormData) {
  const email = textField(formData, "email")
  const password = textField(formData, "password")
  const next = safeRelativePath(textField(formData, "next"))

  if (!email || !password) {
    authError("/login", "Enter your email and password.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) authError("/login", error.message)

  redirect(next)
}

export async function signUp(formData: FormData) {
  const fullName = textField(formData, "fullName")
  const companyName = textField(formData, "companyName")
  const email = textField(formData, "email")
  const password = textField(formData, "password")

  if (fullName.length < 2 || companyName.length < 2) {
    authError("/signup", "Enter your name and company.")
  }

  if (!email || password.length < 10) {
    authError(
      "/signup",
      "Use a valid email and a password with at least 10 characters."
    )
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/dashboard`,
      data: {
        full_name: fullName,
        company_name: companyName,
      },
    },
  })

  if (error) authError("/signup", error.message)

  if (data.session) redirect("/dashboard")

  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account.")
}

export async function sendPasswordReset(formData: FormData) {
  const email = textField(formData, "email")
  if (!email) authError("/forgot-password", "Enter your email.")

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/reset-password`,
  })

  if (error) authError("/forgot-password", error.message)

  redirect(
    "/login?message=If%20the%20account%20exists,%20a%20reset%20link%20is%20on%20the%20way."
  )
}

export async function updatePassword(formData: FormData) {
  const password = textField(formData, "password")
  if (password.length < 10) {
    authError(
      "/reset-password",
      "Use a password with at least 10 characters."
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) authError("/reset-password", error.message)

  redirect("/dashboard?message=Password%20updated.")
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/")
}
