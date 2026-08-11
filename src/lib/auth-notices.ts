import type { Locale } from "@/lib/i18n"

export const authNoticeCodes = [
  "missing_credentials",
  "invalid_credentials",
  "missing_profile",
  "invalid_signup",
  "signup_failed",
  "confirm_email",
  "missing_email",
  "reset_failed",
  "reset_sent",
  "short_password",
  "update_failed",
  "confirmation_invalid",
  "request_failed",
] as const

export type AuthNoticeCode = (typeof authNoticeCodes)[number]

const authNoticeCodeSet = new Set<string>(authNoticeCodes)

const noticeCopy: Record<Locale, Record<AuthNoticeCode, string>> = {
  en: {
    missing_credentials: "Enter your email and password.",
    invalid_credentials: "The email or password is not correct.",
    missing_profile: "Enter your name.",
    invalid_signup:
      "Use a valid email and a password with at least 10 characters.",
    signup_failed:
      "We could not create the account with those details. Check the information and try again.",
    confirm_email: "Check your email to confirm your account.",
    missing_email: "Enter your email.",
    reset_failed: "We could not send the reset email. Try again in a moment.",
    reset_sent:
      "If the account exists, a password reset link is on the way.",
    short_password: "Use a password with at least 10 characters.",
    update_failed: "We could not update the password. Try again.",
    confirmation_invalid: "The confirmation link is invalid or has expired.",
    request_failed: "We could not complete that account request. Try again.",
  },
  es: {
    missing_credentials: "Introduce tu correo y contraseña.",
    invalid_credentials: "El correo o la contraseña no son correctos.",
    missing_profile: "Introduce tu nombre.",
    invalid_signup:
      "Usa un correo válido y una contraseña de al menos 10 caracteres.",
    signup_failed:
      "No pudimos crear la cuenta con esos datos. Comprueba la información e inténtalo de nuevo.",
    confirm_email: "Revisa tu correo para confirmar la cuenta.",
    missing_email: "Introduce tu correo.",
    reset_failed:
      "No pudimos enviar el correo de recuperación. Inténtalo de nuevo en unos minutos.",
    reset_sent:
      "Si la cuenta existe, recibirás un enlace para restablecer la contraseña.",
    short_password: "Usa una contraseña de al menos 10 caracteres.",
    update_failed:
      "No pudimos actualizar la contraseña. Inténtalo de nuevo.",
    confirmation_invalid:
      "El enlace de confirmación no es válido o ha caducado.",
    request_failed:
      "No pudimos completar esa solicitud de cuenta. Inténtalo de nuevo.",
  },
}

const legacyNoticeCodes: Record<string, AuthNoticeCode> = {}
for (const locale of ["en", "es"] as const) {
  for (const code of authNoticeCodes) {
    legacyNoticeCodes[noticeCopy[locale][code]] = code
  }
}

Object.assign(legacyNoticeCodes, {
  "Enter your email and password.": "missing_credentials",
  "Use a valid email and a password with at least 10 characters.":
    "invalid_signup",
  "Enter your name and company.": "missing_profile",
  "Check your email to confirm your account.": "confirm_email",
  "Enter your email.": "missing_email",
  "If the account exists, a reset link is on the way.": "reset_sent",
  "Use a password with at least 10 characters.": "short_password",
  "The confirmation link is invalid.": "confirmation_invalid",
})

export function localizeAuthNotice(
  value: unknown,
  locale: Locale,
  fallbackCode?: AuthNoticeCode
) {
  if (typeof value !== "string" || !value) return null
  const code = authNoticeCodeSet.has(value)
    ? (value as AuthNoticeCode)
    : legacyNoticeCodes[value]
  const resolvedCode = code ?? fallbackCode
  return resolvedCode ? noticeCopy[locale][resolvedCode] : null
}
