import type { AuthNoticeCode } from "@/lib/auth-notices"

type SignInFailure = {
  code?: string | null
}

export function signInNoticeCode(error: SignInFailure): AuthNoticeCode {
  return error.code === "invalid_credentials"
    ? "invalid_credentials"
    : "request_failed"
}
