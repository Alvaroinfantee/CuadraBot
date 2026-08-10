"use client"

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CoinsIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileUpIcon,
  Loader2Icon,
  LockIcon,
  RulerIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { maxUploadMb } from "@/lib/config"
import {
  dashboardCopy,
  localizeCustomerError,
} from "@/lib/dashboard-i18n"
import {
  localeTag,
  localizedTradeLabels,
  localizeTakeoffPrice,
  type Locale,
} from "@/lib/i18n"
import { emitMarketingEvent } from "@/lib/marketing-analytics"
import { buttonVariants } from "@/components/ui/button"
import {
  createSignedResumableUploadTask,
  ResumableUploadCancelledError,
  type ResumableUploadTask,
  type SignedResumableUploadGrant,
} from "@/lib/supabase/resumable-upload"
import type { TakeoffPricingTier } from "@/lib/takeoff-pricing"
import {
  selectableTakeoffTrades,
  type SelectableTakeoffTrade,
} from "@/lib/takeoff-types"
import { cn } from "@/lib/utils"

type Quote = {
  tier: TakeoffPricingTier
  name: string
  credits: number
  priceCents: number
  description: string
  selfServe: boolean
  pageCount: number
}

type DraftUpload = SignedResumableUploadGrant & {
  jobId: string
}

export function NewTakeoffForm({
  availableCredits,
  sampleAvailable,
  initialMode = "standard",
  locale = "en",
}: {
  availableCredits: number
  sampleAvailable: boolean
  initialMode?: "sample" | "standard"
  locale?: Locale
}) {
  const router = useRouter()
  const copy = dashboardCopy[locale].form
  const [mode, setMode] = useState<"sample" | "standard">(
    initialMode === "sample" && sampleAvailable ? "sample" : "standard"
  )
  const [projectName, setProjectName] = useState("")
  const [trades, setTrades] = useState<SelectableTakeoffTrade[]>([])
  const [notes, setNotes] = useState("")
  const [samplePage, setSamplePage] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [draftUpload, setDraftUpload] = useState<DraftUpload | null>(null)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const activeUploadTask = useRef<ResumableUploadTask | null>(null)
  const canPrepare =
    projectName.trim().length >= 2 && trades.length > 0 && Boolean(file)
  const insufficient = Boolean(
    quote && quote.selfServe && quote.credits > availableCredits
  )
  const localizedQuote = useMemo(
    () =>
      quote
        ? localizeTakeoffPrice(
            {
              tier: quote.tier,
              name: quote.name,
              credits: quote.credits,
              priceCents: quote.priceCents,
              turnaroundHours: null,
              selfServe: quote.selfServe,
              description: quote.description,
            },
            locale
          )
        : null,
    [locale, quote]
  )
  const fileSize = useMemo(
    () =>
      file
        ? new Intl.NumberFormat(localeTag(locale), {
            style: "unit",
            unit: "megabyte",
            maximumFractionDigits: 1,
          }).format(file.size / 1024 / 1024)
        : "",
    [file, locale]
  )

  function toggleTrade(trade: SelectableTakeoffTrade) {
    resetPreparedDraft()
    setTrades((current) =>
      current.includes(trade)
        ? current.filter((value) => value !== trade)
        : [...current, trade]
    )
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null
    if (
      nextFile &&
      nextFile.type !== "application/pdf" &&
      !nextFile.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error(copy.invalidPdf)
      event.target.value = ""
      setFile(null)
      resetPreparedDraft()
      return
    }
    setFile(nextFile)
    resetPreparedDraft()
  }

  function resetPreparedDraft() {
    setQuote(null)
    setJobId(null)
    setDraftUpload(null)
    setUploadComplete(false)
    setProgress(0)
  }

  async function cancelUpload() {
    await activeUploadTask.current?.cancel()
  }

  async function prepareQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || !canPrepare) return

    setBusy(true)
    setProgress(5)
    try {
      let currentDraft = draftUpload
      if (!currentDraft) {
        const draftResponse = await fetch("/api/takeoff/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectName,
            mode,
            trades,
            notes,
            samplePage: mode === "sample" ? samplePage : undefined,
            filename: file.name,
            mimeType: file.type || "application/pdf",
            sizeBytes: file.size,
          }),
        })
        const draft = await draftResponse.json()
        if (!draftResponse.ok) {
          throw new Error(
            localizeCustomerError(draft.error, locale, copy.createError)
          )
        }

        currentDraft = {
          jobId: draft.job.id,
          endpoint: draft.upload.endpoint,
          bucket: draft.upload.bucket,
          path: draft.upload.path,
          token: draft.upload.token,
        }
        setJobId(currentDraft.jobId)
        setDraftUpload(currentDraft)
      }

      setProgress(20)
      if (!uploadComplete) {
        const uploadTask = createSignedResumableUploadTask({
          file,
          grant: currentDraft,
          onProgress(bytesUploaded, bytesTotal) {
            const uploadedFraction =
              bytesTotal > 0 ? bytesUploaded / bytesTotal : 0
            setProgress(20 + Math.round(uploadedFraction * 55))
          },
        })
        activeUploadTask.current = uploadTask
        await uploadTask.start()
        activeUploadTask.current = null
        setUploadComplete(true)
      }

      setProgress(75)
      const quoteResponse = await fetch(
        `/api/takeoff/jobs/${currentDraft.jobId}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            samplePage: mode === "sample" ? samplePage : undefined,
            confirm: false,
          }),
        }
      )
      const prepared = await quoteResponse.json()
      if (!quoteResponse.ok) {
        throw new Error(
          localizeCustomerError(prepared.error, locale, copy.verifyError)
        )
      }

      setQuote(prepared.quote)
      setJobId(currentDraft.jobId)
      setProgress(100)
      toast.success(copy.verifiedToast)
    } catch (error) {
      if (error instanceof ResumableUploadCancelledError) {
        toast.info(copy.uploadCancelled)
      } else {
        toast.error(
          error instanceof Error
            ? localizeCustomerError(error.message, locale, copy.verifyError)
            : copy.genericError,
        )
      }
      setProgress(0)
    } finally {
      activeUploadTask.current = null
      setBusy(false)
    }
  }

  async function confirmTakeoff() {
    if (!jobId || !quote || insufficient) return
    setBusy(true)
    try {
      const response = await fetch(`/api/takeoff/jobs/${jobId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          samplePage: mode === "sample" ? samplePage : undefined,
          confirm: true,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        if (response.status === 402) {
          const requiredCredits =
            typeof payload.required === "number"
              ? payload.required
              : quote.credits
          throw new Error(
            `${copy.insufficientStart} ${requiredCredits.toLocaleString(
              localeTag(locale)
            )} ${copy.insufficientEnd}`
          )
        }
        throw new Error(
          localizeCustomerError(payload.error, locale, copy.queueError)
        )
      }
      emitMarketingEvent("takeoff_started")
      toast.success(copy.queuedToast)
      router.push(`/dashboard/jobs/${jobId}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.genericError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <form onSubmit={prepareQuote}>
        <Card>
          <CardHeader>
            <CardTitle>{copy.projectAndScope}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode("standard")
                  resetPreparedDraft()
                }}
                className={cn(
                  "border p-4 text-left",
                  mode === "standard"
                    ? "border-primary bg-blue-50/60"
                    : "hover:border-primary/50"
                )}
              >
                <p className="font-medium">{copy.verifiedTakeoff}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copy.verifiedTakeoffBody}
                </p>
              </button>
              <button
                type="button"
                disabled={busy || !sampleAvailable}
                onClick={() => {
                  setMode("sample")
                  resetPreparedDraft()
                }}
                className={cn(
                  "border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50",
                  mode === "sample"
                    ? "border-primary bg-blue-50/60"
                    : "hover:border-primary/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{copy.freeSample}</p>
                  <Badge variant="secondary">
                    {sampleAvailable ? copy.available : copy.used}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copy.freeSampleBody}
                </p>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-name">{copy.projectName}</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(event) => {
                  setProjectName(event.target.value)
                  resetPreparedDraft()
                }}
                placeholder={copy.projectPlaceholder}
                disabled={busy}
                required
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">
                {copy.measurePrompt}
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {selectableTakeoffTrades.map((trade) => {
                  const selected = trades.includes(trade)
                  return (
                    <label
                      key={trade}
                      className={cn(
                        "flex cursor-pointer gap-3 border p-4 text-sm",
                        selected
                          ? "border-primary bg-blue-50/60"
                          : "hover:border-primary/50"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selected}
                        disabled={
                          busy ||
                          (mode === "sample" && !selected && trades.length >= 1)
                        }
                        onChange={() => toggleTrade(trade)}
                      />
                      <span>{localizedTradeLabels[locale][trade]}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <Alert>
              <AlertTitle>{copy.scopeRequirementsTitle}</AlertTitle>
              <AlertDescription>
                {copy.scopeRequirementsBody}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="plan-file">{copy.planSet}</Label>
              <label
                htmlFor="plan-file"
                className="grid min-h-44 cursor-pointer place-items-center border border-dashed bg-muted/20 p-6 text-center hover:border-primary"
              >
                {file ? (
                  <div>
                    <FileTextIcon className="mx-auto size-8 text-primary" />
                    <p className="mt-3 font-medium">{file.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fileSize}
                    </p>
                  </div>
                ) : (
                  <div>
                    <FileUpIcon className="mx-auto size-8 text-primary" />
                    <p className="mt-3 font-medium">{copy.chooseFile}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {copy.fileLimitStart} {maxUploadMb}
                      {copy.fileLimitEnd}
                    </p>
                  </div>
                )}
              </label>
              <Input
                id="plan-file"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={busy}
                onChange={chooseFile}
              />
            </div>

            {mode === "sample" ? (
              <div className="space-y-2">
                <Label htmlFor="sample-page">{copy.samplePage}</Label>
                <Input
                  id="sample-page"
                  type="number"
                  min={1}
                  max={250}
                  value={samplePage}
                  disabled={busy}
                  onChange={(event) => {
                    setSamplePage(Math.max(1, Number(event.target.value)))
                    resetPreparedDraft()
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {copy.samplePageBody}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="notes">{copy.instructions}</Label>
              <Textarea
                id="notes"
              rows={5}
              value={notes}
              disabled={busy}
              onChange={(event) => {
                setNotes(event.target.value)
                resetPreparedDraft()
              }}
                placeholder={copy.instructionsPlaceholder}
              />
            </div>

            {busy ? (
              <div className="space-y-3">
                <Progress value={progress} />
                {activeUploadTask.current ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={cancelUpload}
                  >
                    {copy.cancelUpload}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={!canPrepare || busy}
              className="w-full"
            >
              {busy ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  {copy.verifying}
                </>
              ) : (
                <>
                  {copy.uploadQuote}
                  <ArrowRightIcon />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>

      <div className="space-y-6">
        <Card className={cn(quote && "border-primary")}>
          <CardHeader>
            <CardTitle>{copy.fixedQuote}</CardTitle>
          </CardHeader>
          <CardContent>
            {quote ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {localizedQuote?.name}
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <p className="text-4xl font-semibold">
                      {quote.credits.toLocaleString(localeTag(locale))}
                    </p>
                    <p className="pb-1 text-sm text-muted-foreground">
                      {copy.credits}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 border-y py-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {copy.verifiedPages}
                    </span>
                    <span className="font-medium">
                      {quote.pageCount.toLocaleString(localeTag(locale))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {copy.availableCredits}
                    </span>
                    <span className="font-medium">
                      {availableCredits.toLocaleString(localeTag(locale))}{" "}
                      {copy.credits}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {copy.deliveryTarget}
                    </span>
                    <span className="font-medium">{copy.inHours}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {copy.includedDeliverables}
                  </p>
                  <div className="mt-3 space-y-3">
                    {[
                      {
                        icon: FileTextIcon,
                        title: copy.annotatedPdfIncluded,
                        body: copy.annotatedPdfIncludedBody,
                      },
                      {
                        icon: FileSpreadsheetIcon,
                        title: copy.workbookIncluded,
                        body: copy.workbookIncludedBody,
                      },
                    ].map(({ icon: Icon, title, body }) => (
                      <div key={title} className="flex items-start gap-3">
                        <span className="grid size-8 shrink-0 place-items-center bg-blue-50 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <div>
                          <p className="text-sm font-medium">{title}</p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                            {body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {localizedQuote?.description}
                </p>
                {insufficient ? (
                  <Alert variant="destructive">
                    <AlertTitle>{copy.moreCreditsTitle}</AlertTitle>
                    <AlertDescription>
                      {copy.addCreditsStart}{" "}
                      {(quote.credits - availableCredits).toLocaleString(
                        localeTag(locale)
                      )}{" "}
                      {copy.addCreditsEnd}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={confirmTakeoff}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <CheckCircle2Icon />
                    )}
                    {copy.reserveAndStart}
                  </Button>
                )}
                {insufficient && (
                  <Link
                    href="/dashboard/billing"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full"
                    )}
                  >
                    {copy.addCredits}
                  </Link>
                )}
              </div>
            ) : (
              <div className="py-10 text-center">
                <CoinsIcon className="mx-auto size-8 text-primary" />
                <p className="mt-4 font-medium">{copy.noEstimateTitle}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {copy.noEstimateBody}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3 border bg-white p-5 text-sm">
          {[
            { icon: LockIcon, label: copy.privateStorage },
            { icon: RulerIcon, label: copy.pageVerification },
            { icon: ShieldCheckIcon, label: copy.automatedValidation },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="size-4 text-primary" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
