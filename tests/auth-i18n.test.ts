import assert from "node:assert/strict"
import test from "node:test"
import { localizeAuthNotice } from "../src/lib/auth-notices"

test("auth notices use stable codes and render in the selected language", () => {
  assert.equal(
    localizeAuthNotice("invalid_credentials", "es"),
    "El correo o la contraseña no son correctos."
  )
  assert.equal(
    localizeAuthNotice("reset_sent", "en"),
    "If the account exists, a password reset link is on the way."
  )
})

test("legacy auth notices are translated instead of leaking stale language", () => {
  assert.equal(
    localizeAuthNotice("The confirmation link is invalid.", "es"),
    "El enlace de confirmación no es válido o ha caducado."
  )
  assert.equal(
    localizeAuthNotice(
      "El correo o la contraseña no son correctos.",
      "en"
    ),
    "The email or password is not correct."
  )
})

test("untrusted auth query text is never rendered verbatim", () => {
  assert.equal(
    localizeAuthNotice("<script>arbitrary</script>", "es"),
    null
  )
  assert.equal(
    localizeAuthNotice(
      "arbitrary provider error",
      "es",
      "request_failed"
    ),
    "No pudimos completar esa solicitud de cuenta. Inténtalo de nuevo."
  )
})
