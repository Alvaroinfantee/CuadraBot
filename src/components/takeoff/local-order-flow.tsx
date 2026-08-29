"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
} from "lucide-react"
import {
  createEmptyDrywallOrder,
  type DrywallFile,
  type DrywallOrderDraft,
  type DrywallPage,
  MEASUREMENT_POLICY_VERSION,
  readDrywallOrder,
  saveDrywallOrder,
} from "@/lib/drywall-order-client"
import {
  createSignedResumableUploadTask,
  signedTusNeedsStandardFallback,
  SUPABASE_TUS_CHUNK_SIZE_BYTES,
  uploadSmallFileToSignedUrl,
  type ResumableUploadTask,
  type SignedResumableUploadGrant,
} from "@/lib/supabase/resumable-upload"

const inputClass = "mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#17816b] focus:ring-2 focus:ring-[#17816b]/15"
const textareaClass = "mt-2 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-[#17816b] focus:ring-2 focus:ring-[#17816b]/15"

export function LocalOrderFlow() {
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<DrywallOrderDraft>(createEmptyDrywallOrder)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [rangeStart, setRangeStart] = useState("1")
  const [rangeEnd, setRangeEnd] = useState("4")
  const [customSubmitted, setCustomSubmitted] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const activeUploadTask = useRef<ResumableUploadTask | null>(null)

  useEffect(() => {
    const saved = readDrywallOrder()
    const marketingKeys = ["gclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
    const captured = { ...saved.marketing }
    marketingKeys.forEach((key) => {
      const value = searchParams.get(key)
      if (value) captured[key] = value.slice(0, 500)
    })
    captured.landing_path ||= window.location.pathname
    captured.referrer ||= externalReferrerHost()
    captured.device ||= window.innerWidth < 768 ? "mobile" : "desktop"
    captured.country ||= "ES"
    saved.marketing = captured
    saved.sessionId ||= crypto.randomUUID()
    saved.firstVisitAt ||= new Date().toISOString()
    const hydrateTimer = window.setTimeout(() => {
      setOrder(saved)
      setHydrated(true)
      track("landing_page_view", { session_id: saved.sessionId })
    }, 0)
    return () => window.clearTimeout(hydrateTimer)
  }, [searchParams])

  useEffect(() => {
    if (hydrated) saveDrywallOrder(order)
  }, [order, hydrated])

  const selectedCount = order.pages.filter((page) => page.selected).length
  const totalUploadBytes = order.files.reduce((sum, file) => sum + file.size, 0)
  const isExceptional = ["hospital", "aeropuerto", "industrial_complejo"].includes(order.projectType)
  const isEligible = selectedCount > 0 && selectedCount <= 20 && !isExceptional && Boolean(order.email && order.projectName && order.location)

  function patch<K extends keyof DrywallOrderDraft>(key: K, value: DrywallOrderDraft[K]) {
    setOrder((current) => ({ ...current, [key]: value }))
  }

  function advance(next: number) {
    setError("")
    if (next === 2 && (!order.email || !order.projectName || !order.location || !order.projectType)) {
      setError("Completa el email, el nombre, la ubicacion y el tipo de proyecto.")
      return
    }
    if (next === 3 && (!order.files.length || selectedCount === 0 || !order.uploadVerified)) {
      setError("Carga y verifica al menos un PDF y selecciona una hoja relevante.")
      return
    }
    if (next === 4 && (!order.scope.defaultHeight || !order.scope.partitions)) {
      setError("Completa las respuestas de alcance obligatorias.")
      return
    }
    patch("step", next)
    window.scrollTo({ top: 0, behavior: "smooth" })
    if (next === 3) track("sheet_selection_completed", { selected_sheet_count: selectedCount })
    if (next === 4) {
      track("scope_form_completed", {})
      track(isEligible ? "project_eligible" : "project_custom_review", { selected_sheet_count: selectedCount })
    }
  }

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    setError("")
    if (order.files.length || order.projectId) {
      setError("Para sustituir los planos, inicia un pedido nuevo desde esta página.")
      return
    }
    const incoming = Array.from(fileList)
    if (order.files.length + incoming.length > 10) {
      setError("Puedes cargar un maximo de 10 archivos PDF.")
      return
    }
    if (totalUploadBytes + incoming.reduce((sum, file) => sum + file.size, 0) > 500 * 1024 * 1024) {
      setError("El total del proyecto no puede superar 500 MB.")
      return
    }
    if (incoming.some((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
      setError("Solo se aceptan archivos PDF.")
      return
    }

    setUploading(true)
    setUploadProgress(5)
    track("upload_started", { file_count: incoming.length })
    try {
      const analysed = incoming.map((source) => ({
        source,
        name: source.name,
        size: source.size,
      }))
      setUploadProgress(15)

      const draftResponse = await fetch("/api/drywall/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: order.email,
          company: order.company,
          projectName: order.projectName,
          location: order.location,
          projectType: order.projectType,
          bidDate: order.bidDate,
          notes: order.notes,
          sessionId: order.sessionId,
          marketing: order.marketing,
          files: analysed.map((file) => ({
            filename: file.name,
            mimeType: file.source.type || "application/pdf",
            sizeBytes: file.size,
          })),
        }),
      })
      const draft = await draftResponse.json().catch(() => null)
      if (!draftResponse.ok || !draft?.project?.id || !draft?.accessToken) {
        throw new Error(draft?.error || "No pudimos preparar la carga privada.")
      }
      if (!Array.isArray(draft.uploads) || draft.uploads.length !== analysed.length) {
        throw new Error("La preparación de archivos quedó incompleta.")
      }

      const nextFiles: DrywallFile[] = []
      analysed.forEach((file, index) => {
        const id = String(draft.uploads[index].fileId)
        nextFiles.push({ id, name: file.name, size: file.size, pageCount: 0, checksum: "", uploaded: false })
      })
      setOrder((current) => ({
        ...current,
        projectId: draft.project.id,
        accessToken: draft.accessToken,
        files: nextFiles,
        pages: [],
        uploadVerified: false,
      }))

      for (let index = 0; index < analysed.length; index += 1) {
        const serverFileId = String(draft.uploads[index].fileId)
        const grant = draft.uploads[index] as SignedResumableUploadGrant
        const source = analysed[index].source
        if (source.size <= SUPABASE_TUS_CHUNK_SIZE_BYTES) {
          await uploadSmallFileToSignedUrl({ file: source, grant })
        } else {
          const task = createSignedResumableUploadTask({
            file: source,
            grant,
            onProgress(bytesUploaded, bytesTotal) {
              const fileFraction = bytesTotal ? bytesUploaded / bytesTotal : 0
              const overall = (index + fileFraction) / analysed.length
              setUploadProgress(20 + Math.round(overall * 55))
            },
          })
          activeUploadTask.current = task
          try {
            await task.start()
          } catch (uploadError) {
            if (!signedTusNeedsStandardFallback(uploadError)) throw uploadError
            await uploadSmallFileToSignedUrl({ file: source, grant })
          } finally {
            activeUploadTask.current = null
          }
        }
        setOrder((current) => ({
          ...current,
          files: current.files.map((file) =>
            file.id === serverFileId ? { ...file, uploaded: true } : file
          ),
        }))
      }

      setUploadProgress(80)
      const verifyResponse = await fetch(`/api/drywall/orders/${draft.project.id}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: draft.accessToken }),
      })
      const verified = await verifyResponse.json().catch(() => null)
      if (!verifyResponse.ok) {
        throw new Error(verified?.error || "No pudimos verificar los PDF cargados.")
      }
      if (!Array.isArray(verified?.files) || verified.files.length !== analysed.length) {
        throw new Error("La verificación del servidor quedó incompleta.")
      }
      const verifiedFiles: DrywallFile[] = []
      const verifiedPages: DrywallPage[] = []
      let remainingSelections = 20
      for (const file of verified.files) {
        const pageCount = Number(file.pageCount)
        if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 500) {
          throw new Error("El servidor devolvió un número de páginas no válido.")
        }
        verifiedFiles.push({
          id: String(file.id),
          name: String(file.filename),
          size: Number(file.sizeBytes),
          pageCount,
          checksum: String(file.checksum),
          uploaded: true,
        })
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          const selected = remainingSelections > 0
          if (selected) remainingSelections -= 1
          verifiedPages.push({ id: `${file.id}-${pageNumber}`, fileId: String(file.id), fileName: String(file.filename), pageNumber, sheetName: `Hoja ${pageNumber}`, selected })
        }
      }
      setOrder((current) => ({ ...current, files: verifiedFiles, pages: verifiedPages, uploadVerified: true }))
      setUploadProgress(100)
      track("upload_completed", { file_count: analysed.length, page_count: verifiedPages.length })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No pudimos procesar el PDF.")
      setOrder((current) => ({
        ...current,
        projectId: "",
        accessToken: "",
        files: [],
        pages: [],
        uploadVerified: false,
      }))
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  function selectRange() {
    const start = Number(rangeStart)
    const end = Number(rangeEnd)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      setError("Introduce un intervalo de paginas valido.")
      return
    }
    setOrder((current) => ({ ...current, pages: current.pages.map((page, index) => ({ ...page, selected: index + 1 >= start && index + 1 <= end ? true : page.selected })) }))
  }

  async function startCheckout() {
    if (!order.acceptedScope || !order.uploadAuthority) {
      setError("Acepta el alcance, las condiciones y confirma tu derecho a compartir los planos.")
      return
    }
    if (!order.projectId || !order.accessToken || !order.uploadVerified) {
      setError("La carga privada no está lista para el pago.")
      return
    }
    setCheckoutBusy(true)
    setError("")
    try {
      const selectedByFile = order.files
        .map((file) => ({
          fileId: file.id,
          pageNumbers: order.pages
            .filter((page) => page.fileId === file.id && page.selected)
            .map((page) => page.pageNumber),
        }))
        .filter((selection) => selection.pageNumbers.length)
      const response = await fetch(`/api/drywall/orders/${order.projectId}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessToken: order.accessToken,
          acceptedScope: order.acceptedScope,
          uploadAuthority: order.uploadAuthority,
          selectedPages: selectedByFile,
          scope: order.scope,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || "No pudimos abrir el pago seguro.")
      if (result.customReview) {
        setCustomSubmitted(true)
        track("project_custom_review", { selected_sheet_count: selectedCount })
        return
      }
      if (!result.url) throw new Error("Stripe no devolvió una URL de pago.")
      track("checkout_started", { value: 149, currency: "EUR", ...order.marketing })
      window.location.assign(result.url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "No pudimos abrir el pago seguro.")
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (!hydrated) return <div className="grid min-h-[60vh] place-items-center"><LoaderCircleIcon className="size-7 animate-spin text-[#17816b]" /></div>

  return (
    <div className="min-h-screen bg-[#f5f7f4] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-[#153a31] text-sm text-white">C</span> Cuadrabot</Link>
          <div className="flex items-center gap-3"><span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex"><LockKeyholeIcon className="size-3.5" /> Borrador guardado</span><span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">Carga privada</span></div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#e35e38]">Pedido · 149 € + IVA</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Tu medicion de pladur</h1></div>
          <div className="hidden text-right text-xs leading-5 text-slate-500 sm:block">Hasta 20 hojas<br />Entrega en 2 dias laborables</div>
        </div>

        <Stepper step={order.step} />
        {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />{error}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_310px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            {order.step === 1 && <ProjectStep order={order} patch={patch} onNext={() => advance(2)} />}
            {order.step === 2 && (
              <UploadStep order={order} selectedCount={selectedCount} totalUploadBytes={totalUploadBytes} uploading={uploading} uploadProgress={uploadProgress} rangeStart={rangeStart} rangeEnd={rangeEnd} setRangeStart={setRangeStart} setRangeEnd={setRangeEnd} addFiles={addFiles} selectRange={selectRange} setOrder={setOrder} onBack={() => patch("step", 1)} onNext={() => advance(3)} />
            )}
            {order.step === 3 && <ScopeStep order={order} patch={patch} onBack={() => patch("step", 2)} onNext={() => advance(4)} />}
            {order.step === 4 && (
              <CheckoutStep order={order} selectedCount={selectedCount} isEligible={isEligible} isExceptional={isExceptional} customSubmitted={customSubmitted} checkoutBusy={checkoutBusy} patch={patch} startCheckout={startCheckout} onBack={() => patch("step", 3)} />
            )}
          </section>
          <OrderSummary order={order} selectedCount={selectedCount} />
        </div>
      </main>
    </div>
  )
}

function ProjectStep({ order, patch, onNext }: { order: DrywallOrderDraft; patch: <K extends keyof DrywallOrderDraft>(key: K, value: DrywallOrderDraft[K]) => void; onNext: () => void }) {
  return <div><StepHeading number="01" title="Datos del proyecto" body="Creamos un proyecto temporal antes de la carga. No necesitas cuenta ni contraseña." />
    <div className="mt-7 grid gap-5 sm:grid-cols-2">
      <Field label="Email de trabajo *"><input aria-label="Email de trabajo" type="email" className={inputClass} value={order.email} onChange={(event) => patch("email", event.target.value)} placeholder="nombre@empresa.es" /></Field>
      <Field label="Empresa (opcional)"><input aria-label="Empresa" className={inputClass} value={order.company} onChange={(event) => patch("company", event.target.value)} placeholder="Construcciones Ejemplo SL" /></Field>
      <Field label="Nombre del proyecto *"><input aria-label="Nombre del proyecto" className={inputClass} value={order.projectName} onChange={(event) => patch("projectName", event.target.value)} placeholder="Reforma oficinas Serrano" /></Field>
      <Field label="Ubicacion *"><input aria-label="Ubicacion" className={inputClass} value={order.location} onChange={(event) => patch("location", event.target.value)} placeholder="Madrid" /></Field>
      <Field label="Tipo de proyecto *"><select aria-label="Tipo de proyecto" className={inputClass} value={order.projectType} onChange={(event) => patch("projectType", event.target.value)}><option value="">Selecciona</option><option value="vivienda">Vivienda</option><option value="oficinas">Oficinas</option><option value="comercial">Comercial</option><option value="hotel">Hotel pequeno/mediano</option><option value="hospital">Hospital</option><option value="aeropuerto">Aeropuerto</option><option value="industrial_complejo">Complejo industrial mayor</option><option value="otro">Otro</option></select></Field>
      <Field label="Fecha deseada de oferta (opcional)"><input aria-label="Fecha de oferta" type="date" className={inputClass} value={order.bidDate} onChange={(event) => patch("bidDate", event.target.value)} /></Field>
      <div className="sm:col-span-2"><Field label="Notas breves"><textarea aria-label="Notas del proyecto" className={textareaClass} value={order.notes} onChange={(event) => patch("notes", event.target.value)} placeholder="Indica plantas, zonas o cualquier contexto util." /></Field></div>
    </div>
    <div className="mt-8 flex justify-end"><PrimaryButton onClick={onNext}>Continuar a planos <ArrowRightIcon /></PrimaryButton></div>
  </div>
}

type UploadProps = { order: DrywallOrderDraft; selectedCount: number; totalUploadBytes: number; uploading: boolean; uploadProgress: number; rangeStart: string; rangeEnd: string; setRangeStart: (value: string) => void; setRangeEnd: (value: string) => void; addFiles: (files: FileList | null) => void; selectRange: () => void; setOrder: React.Dispatch<React.SetStateAction<DrywallOrderDraft>>; onBack: () => void; onNext: () => void }
function UploadStep(props: UploadProps) {
  const { order, selectedCount, totalUploadBytes, uploading, uploadProgress, rangeStart, rangeEnd, setRangeStart, setRangeEnd, addFiles, selectRange, setOrder, onBack, onNext } = props
  return <div><StepHeading number="02" title="Planos y hojas relevantes" body="PDF sin contraseña. Hasta 10 archivos, 500 MB en total y 20 hojas seleccionadas para el precio fijo." />
    <label className="mt-7 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-[#fafbf9] p-6 text-center hover:border-[#17816b]">
      <UploadCloudIcon className="size-8 text-[#17816b]" /><strong className="mt-3 text-sm">Arrastra tus PDF o selecciona archivos</strong><span className="mt-1 text-xs text-slate-500">Se validan tipo, integridad, proteccion y numero de paginas.</span>
      <input aria-label="Subir archivos PDF" type="file" className="sr-only" accept="application/pdf,.pdf" multiple onChange={(event) => addFiles(event.target.files)} />
    </label>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><span className="text-slate-500">{order.files.length}/10 archivos · {(totalUploadBytes / 1024 / 1024).toFixed(1)} MB</span>{order.uploadVerified ? <span className="font-semibold text-emerald-700">PDF verificados por el servidor</span> : null}</div>
    {(uploading || uploadProgress > 0) && <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-slate-500"><span>{uploading ? "Procesando y calculando SHA-256..." : "Carga comprobada"}</span><span>{uploadProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#17816b] transition-all" style={{ width: `${uploadProgress}%` }} /></div></div>}
    {order.files.length > 0 && <div className="mt-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="font-semibold">Selecciona las hojas</h3><p className={`mt-1 text-sm ${selectedCount > 20 ? "font-semibold text-red-700" : "text-slate-500"}`}>{selectedCount} hojas seleccionadas {selectedCount > 20 ? "· Este proyecto requiere una revision personalizada." : "· maximo 20"}</p></div><div className="flex gap-2"><button type="button" className="mini-button" onClick={() => setOrder((current) => ({ ...current, pages: current.pages.map((page) => ({ ...page, selected: true })) }))}>Todas</button><button type="button" className="mini-button" onClick={() => setOrder((current) => ({ ...current, pages: current.pages.map((page) => ({ ...page, selected: false })) }))}>Ninguna</button></div></div>
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3"><Field label="Desde"><input aria-label="Rango desde" type="number" min="1" className="h-9 w-20 rounded-md border border-slate-300 px-2 text-sm" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></Field><Field label="Hasta"><input aria-label="Rango hasta" type="number" min="1" className="h-9 w-20 rounded-md border border-slate-300 px-2 text-sm" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} /></Field><button type="button" onClick={selectRange} className="h-9 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white">Seleccionar intervalo</button></div>
      <div className="mt-4 grid max-h-[480px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">{order.pages.map((page, index) => <button aria-label={`Pagina ${page.pageNumber} ${page.selected ? "seleccionada" : "no seleccionada"}`} type="button" key={page.id} onClick={() => setOrder((current) => ({ ...current, pages: current.pages.map((item) => item.id === page.id ? { ...item, selected: !item.selected } : item) }))} className={`relative overflow-hidden rounded-lg border-2 text-left transition ${page.selected ? "border-[#17816b] ring-2 ring-[#17816b]/10" : "border-slate-200"}`}><div className="relative aspect-[4/3] bg-white p-3"><div className="absolute inset-2 border border-slate-300" /><div className="absolute left-[28%] top-[20%] h-[55%] border-l border-slate-300" /><div className="absolute left-[8%] top-[48%] w-[82%] border-t border-slate-300" />{page.selected && <CheckCircle2Icon className="absolute right-2 top-2 size-5 fill-white text-[#17816b]" />}<span className="absolute bottom-2 left-2 rounded bg-white px-1 font-mono text-[9px] text-slate-500">A-{String(100 + index)}</span></div><div className="border-t bg-slate-50 p-2"><div className="truncate text-[10px] text-slate-500">{page.fileName}</div><div className="mt-0.5 truncate text-xs font-semibold">Pag. {page.pageNumber} · {page.sheetName}</div></div></button>)}</div>
    </div>}
    <Navigation onBack={onBack} onNext={onNext} nextLabel={selectedCount > 20 ? "Continuar a revision" : "Continuar al alcance"} />
  </div>
}

function ScopeStep({ order, patch, onBack, onNext }: { order: DrywallOrderDraft; patch: <K extends keyof DrywallOrderDraft>(key: K, value: DrywallOrderDraft[K]) => void; onBack: () => void; onNext: () => void }) {
  const updateScope = (key: keyof DrywallOrderDraft["scope"], value: string) => patch("scope", { ...order.scope, [key]: value })
  return <div><StepHeading number="03" title="Alcance de la medicion" body="Las respuestas quedan guardadas con el pedido y evitan combinar planos contradictorios o inventar condiciones." />
    <div className="mt-7 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Las dimensiones poco claras, cuadros ausentes o revisiones en conflicto pueden requerir una aclaracion. El plazo se pausa mientras esperamos tu respuesta.</div>
    <div className="mt-7 grid gap-6 sm:grid-cols-2">
      <Choice label="1. ¿Incluye tabiques de pladur?" value={order.scope.partitions} onChange={(value) => updateScope("partitions", value)} />
      <Choice label="2. ¿Incluye techos de placa de yeso?" value={order.scope.ceilings} onChange={(value) => updateScope("ceilings", value)} />
      <Choice label="3. ¿Incluye cuadros de tipos de muro?" value={order.scope.wallSchedules} onChange={(value) => updateScope("wallSchedules", value)} />
      <Choice label="4. ¿Incluye planos de falsos techos?" value={order.scope.reflectedCeilings} onChange={(value) => updateScope("reflectedCeilings", value)} />
      <Choice label="5. ¿Se ven cotas o escalas?" value={order.scope.visibleScale} onChange={(value) => updateScope("visibleScale", value)} />
      <Field label="6. Altura de tabique por defecto (m) *"><input aria-label="Altura por defecto" type="number" min="1" max="20" step="0.01" className={inputClass} value={order.scope.defaultHeight} onChange={(event) => updateScope("defaultHeight", event.target.value)} /></Field>
      <Choice label="7. ¿Deducir huecos claramente acotados?" value={order.scope.deductOpenings} onChange={(value) => updateScope("deductOpenings", value)} />
      <Field label="8. ¿Hay planos o revisiones que sustituyen a otros?"><textarea aria-label="Planos sustituidos" className={textareaClass} value={order.scope.supersededDrawings} onChange={(event) => updateScope("supersededDrawings", event.target.value)} placeholder="Ej.: A-101 Rev.03 sustituye Rev.02" /></Field>
      <Field label="9. Areas que deben excluirse"><textarea aria-label="Areas excluidas" className={textareaClass} value={order.scope.excludedAreas} onChange={(event) => updateScope("excludedAreas", event.target.value)} placeholder="Ej.: nucleo de ascensores" /></Field>
      <Field label="10. Informacion para el medidor"><textarea aria-label="Notas para el medidor" className={textareaClass} value={order.scope.estimatorNotes} onChange={(event) => updateScope("estimatorNotes", event.target.value)} placeholder="Cualquier criterio especial del proyecto" /></Field>
    </div>
    <div className="mt-6 rounded-lg bg-[#edf4f1] p-4 text-sm leading-6 text-[#153a31]"><strong>Regla de huecos por defecto:</strong> se deducen puertas y ventanas claramente acotadas de la superficie, se registran aparte y nunca se descuentan de la longitud lineal del tabique.</div>
    <Navigation onBack={onBack} onNext={onNext} nextLabel="Revisar y pagar" />
  </div>
}

type CheckoutProps = { order: DrywallOrderDraft; selectedCount: number; isEligible: boolean; isExceptional: boolean; customSubmitted: boolean; checkoutBusy: boolean; patch: <K extends keyof DrywallOrderDraft>(key: K, value: DrywallOrderDraft[K]) => void; startCheckout: () => Promise<void>; onBack: () => void }
function CheckoutStep({ order, selectedCount, isEligible, isExceptional, customSubmitted, checkoutBusy, patch, startCheckout, onBack }: CheckoutProps) {
  if (!isEligible) return <div><StepHeading number="04" title="Revision personalizada" body="Este proyecto queda guardado, pero no puede comprar por error el producto estandar de 149 €." /><div className="mt-7 rounded-xl border border-amber-300 bg-amber-50 p-6"><AlertTriangleIcon className="size-6 text-amber-700" /><h3 className="mt-3 text-xl font-semibold text-amber-950">Este proyecto requiere una revision personalizada.</h3><p className="mt-2 text-sm leading-6 text-amber-900">{selectedCount > 20 ? `Has seleccionado ${selectedCount} hojas; el producto estandar admite un maximo de 20.` : isExceptional ? "El tipo de proyecto se considera excepcional para el alcance fijo." : "Falta informacion necesaria para confirmar el alcance fijo."}</p>{customSubmitted ? <div className="mt-5 flex items-center gap-2 rounded-lg bg-white p-4 text-sm font-semibold text-[#153a31]"><CheckCircle2Icon className="size-5" /> Proyecto enviado para revision. No se ha realizado ningun cargo.</div> : <><AgreementChecks order={order} patch={patch} /><button type="button" disabled={checkoutBusy} onClick={startCheckout} className="mt-5 h-11 rounded-lg bg-[#153a31] px-5 text-sm font-semibold text-white disabled:opacity-60">{checkoutBusy ? "Enviando..." : "Enviar para revision personalizada"}</button></>}</div><div className="mt-8"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeftIcon className="size-4" /> Volver</button></div></div>
  return <div><StepHeading number="04" title="Precio y condiciones" body="Pago unico. La pasarela de produccion recoge razon social, direccion de facturacion y NIF/IVA, y emite el recibo o factura." />
    <div className="mt-7 overflow-hidden rounded-xl border border-slate-200"><div className="flex justify-between border-b bg-slate-50 p-5"><div><strong className="block">Medicion de pladur</strong><span className="mt-1 block text-xs text-slate-500">{selectedCount} hojas · un proyecto · una correccion</span></div><strong>149,00 €</strong></div><div className="space-y-3 p-5 text-sm"><div className="flex justify-between text-slate-600"><span>Base imponible</span><span>149,00 €</span></div><div className="flex justify-between text-slate-600"><span>IVA estimado (21 %)</span><span>31,29 €</span></div><div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total estimado</span><span>180,29 €</span></div><p className="text-xs leading-5 text-slate-500">El IVA definitivo depende de los datos de facturacion y se muestra antes de confirmar el pago.</p></div></div>
    <AgreementChecks order={order} patch={patch} />
    <div className="mt-7 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><strong>Pago protegido por Stripe:</strong> la tarjeta se introduce únicamente en el checkout alojado por Stripe. Cuadrabot no recibe ni almacena los datos completos de la tarjeta.</div>
    <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row"><button type="button" onClick={onBack} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold"><ArrowLeftIcon className="size-4" /> Volver</button><button type="button" disabled={checkoutBusy} onClick={startCheckout} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#e35e38] px-6 font-semibold text-white shadow-sm hover:bg-[#c94f2e] disabled:opacity-60"><LockKeyholeIcon className="size-4" /> {checkoutBusy ? "Abriendo Stripe..." : "Ir al pago seguro"}</button></div>
  </div>
}

function OrderSummary({ order, selectedCount }: { order: DrywallOrderDraft; selectedCount: number }) {
  return <aside className="h-fit rounded-2xl border border-slate-200 bg-[#102f28] p-6 text-white lg:sticky lg:top-6"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheckIcon className="size-4 text-[#7dd8bd]" /> Resumen del pedido</div><dl className="mt-6 space-y-4 text-sm"><SummaryRow label="Proyecto" value={order.projectName || "Sin nombre"} /><SummaryRow label="Hojas" value={`${selectedCount} / 20`} warning={selectedCount > 20} /><SummaryRow label="Entrega" value="2 dias laborables" /><SummaryRow label="Archivos finales" value="Excel + PDF marcado" /><SummaryRow label="Revision" value="1 incluida" /><SummaryRow label="Precio" value="149 € + IVA" /></dl><div className="mt-6 border-t border-white/15 pt-5 text-xs leading-5 text-white/60"><div className="flex gap-2"><LockKeyholeIcon className="mt-0.5 size-3.5 shrink-0" /><span>Produccion: almacenamiento privado, enlaces temporales y eliminacion por defecto a los 90 dias.</span></div><div className="mt-3 font-mono text-[10px] text-white/35">POLITICA {MEASUREMENT_POLICY_VERSION}</div></div></aside>
}

function AgreementChecks({ order, patch }: { order: DrywallOrderDraft; patch: <K extends keyof DrywallOrderDraft>(key: K, value: DrywallOrderDraft[K]) => void }) {
  return <div className="mt-6 space-y-4"><label className="flex cursor-pointer items-start gap-3 text-sm leading-6"><input aria-label="Aceptar alcance y condiciones" type="checkbox" className="mt-1 size-4 accent-[#17816b]" checked={order.acceptedScope} onChange={(event) => patch("acceptedScope", event.target.checked)} /><span>Acepto el <Link href="/alcance" className="underline">alcance y exclusiones</Link>, los <Link href="/terminos" className="underline">terminos</Link>, la <Link href="/privacidad" className="underline">privacidad</Link>, la <Link href="/confidencialidad" className="underline">confidencialidad</Link> y la <Link href="/reembolsos" className="underline">politica de reembolso</Link>. Entiendo que la medicion usa solo la revision cargada, no verifica obra y debe comprobarse antes de una compra u oferta vinculante.</span></label><label className="flex cursor-pointer items-start gap-3 text-sm leading-6"><input aria-label="Confirmar derecho a compartir" type="checkbox" className="mt-1 size-4 accent-[#17816b]" checked={order.uploadAuthority} onChange={(event) => patch("uploadAuthority", event.target.checked)} /><span>Confirmo que tengo derecho a facilitar estos documentos y que nuevas revisiones quedan fuera de la correccion incluida.</span></label></div>
}

function Stepper({ step }: { step: number }) { return <div className="grid grid-cols-4 gap-2">{["Proyecto", "Planos", "Alcance", "Pago"].map((label, index) => { const number = index + 1; const active = number <= step; return <div key={label}><div className={`h-1 rounded-full ${active ? "bg-[#17816b]" : "bg-slate-200"}`} /><div className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${number === step ? "text-slate-900" : "text-slate-400"}`}>{number}. {label}</div></div> })}</div> }
function StepHeading({ number, title, body }: { number: string; title: string; body: string }) { return <div><span className="font-mono text-xs font-bold text-[#e35e38]">{number}</span><h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{body}</p></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-semibold text-slate-700">{label}{children}</label> }
function Choice({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <fieldset><legend className="text-xs font-semibold text-slate-700">{label}</legend><div className="mt-3 flex gap-2">{[["si", "Si"], ["no", "No"], ["no_se", "No lo se"]].map(([key, text]) => <label key={key} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold ${value === key ? "border-[#17816b] bg-[#edf4f1] text-[#153a31]" : "border-slate-200"}`}><input type="radio" className="sr-only" checked={value === key} onChange={() => onChange(key)} />{text}</label>)}</div></fieldset> }
function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#153a31] px-5 text-sm font-semibold text-white hover:bg-[#1e4b40] [&_svg]:size-4">{children}</button> }
function Navigation({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) { return <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t pt-6 sm:flex-row"><button type="button" onClick={onBack} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold"><ArrowLeftIcon className="size-4" /> Volver</button><PrimaryButton onClick={onNext}>{nextLabel}<ChevronRightIcon /></PrimaryButton></div> }
function SummaryRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="flex justify-between gap-3"><dt className="text-white/55">{label}</dt><dd className={`text-right font-semibold ${warning ? "text-amber-300" : ""}`}>{value}</dd></div> }
function track(event: string, payload: Record<string, unknown>) { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event, ...payload }) }
function externalReferrerHost() { if (!document.referrer) return ""; try { const referrer = new URL(document.referrer); return referrer.origin === window.location.origin ? "" : referrer.hostname.slice(0, 255) } catch { return "" } }
