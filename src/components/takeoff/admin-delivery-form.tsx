"use client"

import { useState } from "react"
import {
  createSignedResumableUploadTask,
  signedTusNeedsStandardFallback,
  SUPABASE_TUS_CHUNK_SIZE_BYTES,
  uploadSmallFileToSignedUrl,
  type SignedResumableUploadGrant,
} from "@/lib/supabase/resumable-upload"

type PreparedUpload = SignedResumableUploadGrant & { deliverableId: string }

export function AdminDeliveryForm({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function submit(formData: FormData) {
    const markedPdf = formData.get("markedPdf")
    const workbook = formData.get("workbook")
    if (!(markedPdf instanceof File) || !(workbook instanceof File) || !markedPdf.size || !workbook.size) {
      setMessage("Selecciona el PDF marcado y el Excel.")
      return
    }
    setBusy(true)
    setMessage("Calculando huellas SHA-256…")
    try {
      const files = [
        { file: markedPdf, fileType: "marked_pdf" },
        { file: workbook, fileType: "quantity_workbook" },
      ]
      const metadata = await Promise.all(files.map(async ({ file, fileType }) => ({
        fileType,
        filename: file.name,
        mimeType: file.type || (fileType === "marked_pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        sizeBytes: file.size,
        checksum: hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
      })))
      const common = {
        reviewerName: String(formData.get("reviewerName") ?? ""),
        assumptionsConfirmed: formData.get("assumptionsConfirmed") === "on",
        qaConfirmed: formData.get("qaConfirmed") === "on",
      }
      const preparedResponse = await fetch(`/api/admin/drywall/${projectId}/deliverables`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "prepare", ...common, files: metadata }),
      })
      const prepared = await preparedResponse.json().catch(() => null)
      if (!preparedResponse.ok || !Array.isArray(prepared?.uploads)) throw new Error(prepared?.error || "No se pudo preparar la entrega.")

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index].file
        const grant = prepared.uploads[index] as PreparedUpload
        setMessage(`Subiendo ${file.name}…`)
        if (file.size <= SUPABASE_TUS_CHUNK_SIZE_BYTES) {
          await uploadSmallFileToSignedUrl({ file, grant })
        } else {
          const task = createSignedResumableUploadTask({ file, grant, contentType: metadata[index].mimeType })
          try { await task.start() } catch (error) {
            if (!signedTusNeedsStandardFallback(error)) throw error
            await uploadSmallFileToSignedUrl({ file, grant })
          }
        }
      }
      setMessage("Verificando archivos en el servidor…")
      const finalizedResponse = await fetch(`/api/admin/drywall/${projectId}/deliverables`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "finalize", ...common, deliverableIds: prepared.uploads.map((item: PreparedUpload) => item.deliverableId) }),
      })
      const finalized = await finalizedResponse.json().catch(() => null)
      if (!finalizedResponse.ok) throw new Error(finalized?.error || "No se pudo publicar la entrega.")
      setMessage(finalized.emailSent ? "Entrega publicada y cliente notificado." : "Entrega publicada. El email requiere atención en Alertas.")
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo publicar la entrega.")
    } finally {
      setBusy(false)
    }
  }

  return <form action={submit} className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium sm:col-span-2">Revisor responsable<input name="reviewerName" required minLength={2} maxLength={120} className="mt-2 h-11 w-full border px-3" /></label>
    <label className="text-sm font-medium">PDF marcado<input name="markedPdf" required type="file" accept="application/pdf,.pdf" className="mt-2 block w-full text-sm" /></label>
    <label className="text-sm font-medium">Excel de mediciones<input name="workbook" required type="file" accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" className="mt-2 block w-full text-sm" /></label>
    <label className="flex items-start gap-3 text-sm sm:col-span-2"><input name="qaConfirmed" required type="checkbox" className="mt-1" /><span>He comprobado alcance, versión de plano, escala/cotas, páginas, tipos, unidades, huecos, duplicados, fórmulas, referencias cruzadas, totales, PDF marcado, Excel, nombres, legibilidad y consistencia final.</span></label>
    <label className="flex items-start gap-3 text-sm sm:col-span-2"><input name="assumptionsConfirmed" required type="checkbox" className="mt-1" /><span>Los supuestos, exclusiones y cualquier dimensión no verificable están documentados en los entregables.</span></label>
    <div className="sm:col-span-2"><button disabled={busy} className="h-11 bg-[#153a31] px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Publicando…" : "Verificar y publicar entrega"}</button>{message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}</div>
  </form>
}

function hex(buffer: ArrayBuffer) { return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("") }
