"use client"

import { useState } from "react"
import { drywallText, type DrywallLocale } from "@/lib/drywall-i18n"

export function RevisionForm({ projectId, token, locale = "es" }: { projectId: string; token: string; locale?: DrywallLocale }) {
  const t = (spanish: string, english: string) => drywallText(locale, spanish, english)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function submit(formData: FormData) {
    setBusy(true)
    setMessage("")
    const response = await fetch(`/api/drywall/orders/${projectId}/revision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        category: formData.get("category"),
        drawingPage: formData.get("drawingPage"),
        area: formData.get("area"),
        measurementId: formData.get("measurementId"),
        description: formData.get("description"),
      }),
    })
    const result = await response.json().catch(() => null)
    setBusy(false)
    setMessage(response.ok ? t("Corrección registrada. Te responderemos en este mismo portal.", "Correction recorded. We will reply in this portal.") : locale === "en" ? "The correction could not be recorded." : result?.error || "No se pudo registrar la corrección.")
  }

  return (
    <form action={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">{t("Tipo", "Type")}<select name="category" className="mt-2 h-11 w-full rounded-lg border px-3" defaultValue="incorrect_quantity"><option value="incorrect_quantity">{t("Cantidad incorrecta", "Incorrect quantity")}</option><option value="missing_area">{t("Zona omitida", "Missing area")}</option><option value="classification">{t("Clasificación", "Classification")}</option><option value="opening">{t("Hueco", "Opening")}</option><option value="assumption">{t("Supuesto", "Assumption")}</option><option value="file">{t("Archivo", "File")}</option><option value="other">{t("Otro", "Other")}</option></select></label>
      <label className="text-sm font-medium">{t("Plano y página", "Drawing and page")}<input required name="drawingPage" maxLength={120} className="mt-2 h-11 w-full rounded-lg border px-3" placeholder={t("A-101, pág. 4", "A-101, page 4")} /></label>
      <label className="text-sm font-medium">{t("Zona", "Area")}<input required name="area" maxLength={160} className="mt-2 h-11 w-full rounded-lg border px-3" placeholder={t("Planta 2, despacho 2.14", "Floor 2, office 2.14")} /></label>
      <label className="text-sm font-medium">{t("ID de medición", "Measurement ID")}<input required name="measurementId" maxLength={160} className="mt-2 h-11 w-full rounded-lg border px-3" placeholder="PT-018" /></label>
      <label className="text-sm font-medium sm:col-span-2">{t("Qué debe corregirse", "What should be corrected")}<textarea required name="description" minLength={12} maxLength={4000} className="mt-2 min-h-28 w-full rounded-lg border px-3 py-3" /></label>
      <div className="sm:col-span-2"><button disabled={busy} className="h-11 rounded-lg bg-[#153a31] px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? t("Enviando…", "Submitting…") : t("Enviar corrección incluida", "Submit included correction")}</button>{message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}</div>
    </form>
  )
}
