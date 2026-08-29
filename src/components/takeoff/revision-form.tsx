"use client"

import { useState } from "react"

export function RevisionForm({ projectId, token }: { projectId: string; token: string }) {
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
    setMessage(response.ok ? "Corrección registrada. Te responderemos en este mismo portal." : result?.error || "No se pudo registrar la corrección.")
  }

  return (
    <form action={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Tipo<select name="category" className="mt-2 h-11 w-full rounded-lg border px-3" defaultValue="incorrect_quantity"><option value="incorrect_quantity">Cantidad incorrecta</option><option value="missing_area">Zona omitida</option><option value="classification">Clasificación</option><option value="opening">Hueco</option><option value="assumption">Supuesto</option><option value="file">Archivo</option><option value="other">Otro</option></select></label>
      <label className="text-sm font-medium">Plano y página<input required name="drawingPage" maxLength={120} className="mt-2 h-11 w-full rounded-lg border px-3" placeholder="A-101, pág. 4" /></label>
      <label className="text-sm font-medium">Zona<input required name="area" maxLength={160} className="mt-2 h-11 w-full rounded-lg border px-3" placeholder="Planta 2, despacho 2.14" /></label>
      <label className="text-sm font-medium">ID de medición<input required name="measurementId" maxLength={160} className="mt-2 h-11 w-full rounded-lg border px-3" placeholder="PT-018" /></label>
      <label className="text-sm font-medium sm:col-span-2">Qué debe corregirse<textarea required name="description" minLength={12} maxLength={4000} className="mt-2 min-h-28 w-full rounded-lg border px-3 py-3" /></label>
      <div className="sm:col-span-2"><button disabled={busy} className="h-11 rounded-lg bg-[#153a31] px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Enviando…" : "Enviar corrección incluida"}</button>{message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}</div>
    </form>
  )
}
