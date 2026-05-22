"use client"

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import {
  AlertCircleIcon,
  ArrowRightIcon,
  FileTextIcon,
  FileUpIcon,
  Loader2Icon,
  RulerIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { maxUploadMb } from "@/lib/config"
import { type Locale } from "@/lib/i18n"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import {
  formatTakeoffMoney,
  takeoffInternalPackageSlug,
  type TakeoffQuote,
} from "@/lib/takeoff-quote"
import type { QuoteCurrency } from "@/lib/project-quote"

type QuoteResponse = {
  quote?: TakeoffQuote
  error?: string
}

export function TakeoffQuoteOrder({ locale = "en" }: { locale?: Locale }) {
  const copy = getTakeoffCopy(locale)
  const [currency, setCurrency] = useState<QuoteCurrency>(locale === "es" ? "eur" : "usd")
  const [files, setFiles] = useState<File[]>([])
  const [quote, setQuote] = useState<TakeoffQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [progress, setProgress] = useState(0)
  const [isQuoting, setIsQuoting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canSubmit = Boolean(quote && files.length && customerName.trim() && customerEmail.trim())
  const totalFileSize = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files]
  )

  async function requestQuote(nextFiles: File[], nextCurrency: QuoteCurrency) {
    setQuote(null)
    setQuoteError(null)

    if (!nextFiles.length) return

    const invalidFile = nextFiles.find((file) => !isPdfFile(file))

    if (invalidFile) {
      setQuoteError(copy.errors.pdfOnly)
      return
    }

    setIsQuoting(true)

    try {
      const formData = new FormData()
      formData.set("currency", nextCurrency)
      nextFiles.forEach((file) => formData.append("files", file))

      const response = await fetch("/api/takeoff/quote", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as QuoteResponse

      if (!response.ok || !payload.quote) {
        throw new Error(payload.error ?? copy.errors.quote)
      }

      setQuote(payload.quote)
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : copy.errors.quote)
    } finally {
      setIsQuoting(false)
    }
  }

  function updateFiles(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? [])
    setFiles(nextFiles)
    void requestQuote(nextFiles, currency)
  }

  function removeFile(fileName: string) {
    const nextFiles = files.filter((file) => file.name !== fileName)
    setFiles(nextFiles)
    void requestQuote(nextFiles, currency)
  }

  function updateCurrency(nextCurrency: string | null) {
    if (!nextCurrency) return

    const typedCurrency = nextCurrency as QuoteCurrency
    setCurrency(typedCurrency)
    void requestQuote(files, typedCurrency)
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!quote || !files.length) {
      toast.error(copy.errors.noQuote)
      return
    }

    if (!customerName.trim() || !customerEmail.trim()) {
      toast.error(copy.errors.contact)
      return
    }

    setIsSubmitting(true)
    setProgress(5)

    try {
      const draftResponse = await fetch("/api/orders/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          package_slug: takeoffInternalPackageSlug,
          render_type: "Other",
          project_type: "Other",
          style_preference: "Other",
          deadline_preference: copy.deadlineValue,
          customer_notes: notes,
          customer_name: customerName,
          customer_email: customerEmail,
          takeoff_quote: {
            currency: quote.currency,
            pageCount: quote.pageCount,
            files: quote.files,
          },
        }),
      })
      const draft = await draftResponse.json()

      if (!draftResponse.ok) {
        throw new Error(draft.error ?? copy.errors.createOrder)
      }

      const supabase = createSupabaseBrowserClient()
      const order = draft.order as {
        id: string
        public_token: string
        order_number: string
      }

      for (const [index, file] of files.entries()) {
        const signResponse = await fetch(`/api/orders/${order.id}/files/sign`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-order-token": order.public_token,
          },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/pdf",
            sizeBytes: file.size,
          }),
        })
        const signed = await signResponse.json()

        if (!signResponse.ok) {
          throw new Error(signed.error ?? `${copy.errors.prepareUpload} ${file.name}.`)
        }

        const { error: uploadError } = await supabase.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file)

        if (uploadError) {
          throw new Error(uploadError.message)
        }

        setProgress(Math.round(((index + 1) / files.length) * 70) + 15)
      }

      const checkoutResponse = await fetch(`/api/orders/${order.id}/checkout`, {
        method: "POST",
        headers: {
          "x-order-token": order.public_token,
          "x-locale": locale,
        },
      })
      const checkout = await checkoutResponse.json()

      if (!checkoutResponse.ok) {
        throw new Error(checkout.error ?? copy.errors.checkout)
      }

      setProgress(100)
      window.location.assign(checkout.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.errors.generic)
      setIsSubmitting(false)
      setProgress(0)
    }
  }

  return (
    <form onSubmit={submitOrder} className="grid gap-6 lg:grid-cols-[0.92fr_0.58fr]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{copy.formTitle}</CardTitle>
          <CardDescription>{copy.formDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Alert>
            <RulerIcon />
            <AlertTitle>{copy.scaleTitle}</AlertTitle>
            <AlertDescription>{copy.scaleDescription}</AlertDescription>
          </Alert>

          <FieldGroup className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel>{copy.currency}</FieldLabel>
              <Select items={copy.currencyOptions} value={currency} onValueChange={updateCurrency}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder={copy.currency} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {copy.currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{copy.rate}</FieldLabel>
              <div className="flex h-10 items-center rounded-lg border px-3 text-sm">
                {formatTakeoffMoney(3000, currency)} / {copy.page}
              </div>
              <FieldDescription>{copy.rateDescription}</FieldDescription>
            </Field>
          </FieldGroup>

          <Field data-invalid={Boolean(quoteError)}>
            <FieldLabel htmlFor="takeoff-files">{copy.files}</FieldLabel>
            <label
              htmlFor="takeoff-files"
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-4 border border-dashed bg-background p-8 text-center transition-colors hover:bg-muted/50"
            >
              <FileUpIcon className="text-primary" />
              <span className="font-medium">{copy.chooseFiles}</span>
              <span className="max-w-lg text-sm leading-6 text-muted-foreground">
                {copy.fileHelp} {maxUploadMb}MB.
              </span>
            </label>
            <Input
              id="takeoff-files"
              type="file"
              multiple
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={updateFiles}
            />
            <FieldDescription>{copy.privateFiles}</FieldDescription>
            <FieldError errors={quoteError ? [{ message: quoteError }] : undefined} />
          </Field>

          {files.length ? (
            <div className="flex flex-col gap-2">
              {files.map((file) => (
                <div key={file.name} className="flex items-center justify-between gap-3 border px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileTextIcon className="text-primary" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeFile(file.name)}
                  >
                    <XIcon />
                    <span className="sr-only">{copy.remove} {file.name}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <Field>
            <FieldLabel htmlFor="takeoff-notes">{copy.notes}</FieldLabel>
            <Textarea
              id="takeoff-notes"
              rows={5}
              placeholder={copy.notesPlaceholder}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>

          <FieldGroup className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="takeoff-name">{copy.name}</FieldLabel>
              <Input
                id="takeoff-name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="takeoff-email">{copy.email}</FieldLabel>
              <Input
                id="takeoff-email"
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {copy.footer}
          </p>
          <Badge variant="secondary">{copy.deliveryBadge}</Badge>
        </CardFooter>
      </Card>

      <Card className="rounded-lg lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>{copy.estimateTitle}</CardTitle>
          <CardDescription>{copy.estimateDescription}</CardDescription>
          <CardAction>
            <Badge variant={quote ? "default" : "outline"}>
              {quote ? copy.instantBadge : copy.waitingBadge}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {quote ? (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">{copy.recommendedQuote}</p>
                <div className="text-5xl font-semibold tracking-normal">
                  {formatTakeoffMoney(quote.totalCents, quote.currency)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {quote.pageCount} {copy.pages} x {formatTakeoffMoney(quote.rateCentsPerPage, quote.currency)}
                </p>
              </div>
              <div className="grid gap-0 border-y text-sm">
                <SummaryRow label={copy.pdfPages} value={String(quote.pageCount)} />
                <SummaryRow label={copy.pdfFiles} value={String(quote.files.length)} />
                <SummaryRow label={copy.totalSize} value={formatFileSize(totalFileSize)} />
                <SummaryRow label={copy.delivery} value={copy.deliveryValue} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 border p-4 text-sm leading-6 text-muted-foreground">
              <AlertCircleIcon className="text-primary" />
              {isQuoting ? copy.readingPdf : copy.emptyState}
            </div>
          )}

          {isSubmitting ? (
            <div className="flex flex-col gap-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{copy.uploading}</p>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" size="lg" className="h-12" disabled={!canSubmit || isQuoting || isSubmitting}>
            {isQuoting || isSubmitting ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : null}
            {copy.startOrder}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            {copy.paymentNote}
          </p>
        </CardFooter>
      </Card>
    </form>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

function getTakeoffCopy(locale: Locale) {
  const common = {
    currencyOptions: [
      { label: "USD", value: "usd" },
      { label: "EUR", value: "eur" },
    ],
  }

  if (locale === "es") {
    return {
      ...common,
      formTitle: "Cotizador de takeoff",
      formDescription:
        "Sube el PDF de planos y calculamos una cotizacion instantanea por pagina.",
      scaleTitle: "El PDF debe incluir escala",
      scaleDescription:
        "Para medir correctamente, los planos deben traer una escala clara o cotas suficientes dentro del PDF.",
      currency: "Moneda",
      rate: "Tarifa",
      page: "pagina",
      pages: "paginas",
      rateDescription: "Precio fijo por pagina detectada en el PDF.",
      files: "PDF de planos",
      chooseFiles: "Elige PDF o arrastralos aqui",
      fileHelp: "Solo PDF. El maximo por pedido es",
      privateFiles:
        "Los archivos permanecen privados y se suben antes del pago seguro.",
      remove: "Quitar",
      notes: "Notas",
      notesPlaceholder:
        "Cuentanos que partidas necesitas medir, prioridades o cualquier instruccion especial.",
      name: "Nombre",
      email: "Email",
      footer: "Entrega del takeoff en una semana como maximo.",
      deliveryBadge: "7 dias max.",
      estimateTitle: "Estimado de takeoff",
      estimateDescription: "Basado en las paginas detectadas en el PDF.",
      instantBadge: "Instantaneo",
      waitingBadge: "Sube PDF",
      recommendedQuote: "Precio recomendado",
      pdfPages: "Paginas PDF",
      pdfFiles: "Archivos PDF",
      totalSize: "Tamano total",
      delivery: "Entrega",
      deliveryValue: "Maximo 7 dias",
      deadlineValue: "Takeoff delivery within 7 days",
      emptyState: "Sube uno o mas PDF para generar la cotizacion.",
      readingPdf: "Leyendo paginas del PDF...",
      startOrder: "Continuar al pago seguro",
      uploading: "Subiendo PDF y preparando el checkout seguro.",
      paymentNote:
        "Stripe confirma el pago antes de que el takeoff entre en produccion.",
      errors: {
        pdfOnly: "Solo se aceptan archivos PDF para takeoff.",
        quote: "No se pudo generar la cotizacion del takeoff.",
        noQuote: "Sube un PDF valido para generar la cotizacion.",
        contact: "Agrega nombre y email para continuar.",
        createOrder: "No se pudo crear el pedido.",
        prepareUpload: "No se pudo preparar la subida de",
        checkout: "No se pudo crear la sesion de Stripe Checkout.",
        generic: "Algo salio mal.",
      },
    }
  }

  return {
    ...common,
    formTitle: "Takeoff quote",
    formDescription:
      "Upload the blueprint PDF and we calculate an instant per-page quote.",
    scaleTitle: "The PDF must include scale",
    scaleDescription:
      "To measure correctly, plans need a clear scale or enough dimensions inside the PDF.",
    currency: "Currency",
    rate: "Rate",
    page: "page",
    pages: "pages",
    rateDescription: "Fixed price per detected PDF page.",
    files: "Blueprint PDF",
    chooseFiles: "Choose PDFs or drop them here",
    fileHelp: "PDF only. Maximum order upload is",
    privateFiles:
      "Files stay private and are uploaded before secure payment.",
    remove: "Remove",
    notes: "Notes",
    notesPlaceholder:
      "Tell us what quantities you need measured, priorities, or any special instructions.",
    name: "Name",
    email: "Email",
    footer: "Takeoff delivery is one week max.",
    deliveryBadge: "7 days max",
    estimateTitle: "Takeoff estimate",
    estimateDescription: "Based on detected pages in the PDF.",
    instantBadge: "Instant",
    waitingBadge: "Upload PDF",
    recommendedQuote: "Recommended quote",
    pdfPages: "PDF pages",
    pdfFiles: "PDF files",
    totalSize: "Total size",
    delivery: "Delivery",
    deliveryValue: "7 days max",
    deadlineValue: "Takeoff delivery within 7 days",
    emptyState: "Upload one or more PDFs to generate the quote.",
    readingPdf: "Reading PDF pages...",
    startOrder: "Continue to secure checkout",
    uploading: "Uploading PDFs and preparing secure checkout.",
    paymentNote:
      "Stripe confirms payment before the takeoff enters production.",
    errors: {
      pdfOnly: "Only PDF files are accepted for takeoff.",
      quote: "Could not generate the takeoff quote.",
      noQuote: "Upload a valid PDF to generate the quote.",
      contact: "Add name and email to continue.",
      createOrder: "Could not create order.",
      prepareUpload: "Could not prepare upload for",
      checkout: "Could not create Stripe Checkout session.",
      generic: "Something went wrong.",
    },
  }
}
