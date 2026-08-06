"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { KeyRoundIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Locale } from "@/lib/i18n"

const copy = {
  en: {
    label: "One-time administrator key",
    hint: "Enter the 64-character key exactly as it was issued. It expires and can be used only once.",
    submit: "Activate administrator access",
    invalid:
      "The key could not be redeemed. Confirm that you are signed in with the provisioned email and that the key has not expired.",
    throttled: "Too many attempts. Wait 15 minutes before trying again.",
    success: "Administrator access activated.",
  },
  es: {
    label: "Clave de administrador de un solo uso",
    hint: "Introduce exactamente la clave de 64 caracteres. Caduca y solo puede utilizarse una vez.",
    submit: "Activar acceso de administrador",
    invalid:
      "No se pudo canjear la clave. Comprueba que has iniciado sesión con el correo habilitado y que la clave no ha caducado.",
    throttled:
      "Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.",
    success: "Acceso de administrador activado.",
  },
} satisfies Record<Locale, Record<string, string>>

export function AdminBootstrapForm({ locale }: { locale: Locale }) {
  const router = useRouter()
  const text = copy[locale]
  const [key, setKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(response.status === 429 ? text.throttled : text.invalid)
        return
      }

      setKey("")
      toast.success(text.success)
      router.replace(
        typeof payload?.redirectTo === "string" ? payload.redirectTo : "/admin"
      )
      router.refresh()
    } catch {
      setError(text.invalid)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="admin-bootstrap-key">{text.label}</Label>
        <Input
          id="admin-bootstrap-key"
          type="password"
          value={key}
          minLength={64}
          maxLength={64}
          pattern="[a-f0-9]{64}"
          autoComplete="one-time-code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          onChange={(event) => setKey(event.target.value)}
          required
        />
        <p className="text-xs leading-5 text-muted-foreground">{text.hint}</p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? (
          <Loader2Icon className="animate-spin" />
        ) : (
          <KeyRoundIcon />
        )}
        {text.submit}
      </Button>
    </form>
  )
}
