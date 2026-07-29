"use client"

import {
  useMemo,
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
import { buttonVariants } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import {
  takeoffTrades,
  tradeLabels,
  type TakeoffTrade,
} from "@/lib/takeoff-types"
import { cn } from "@/lib/utils"

type Quote = {
  tier: string
  name: string
  credits: number
  priceCents: number
  description: string
  selfServe: boolean
  pageCount: number
}

export function NewTakeoffForm({
  availableCredits,
  sampleAvailable,
  initialMode = "standard",
}: {
  availableCredits: number
  sampleAvailable: boolean
  initialMode?: "sample" | "standard"
}) {
  const router = useRouter()
  const [mode, setMode] = useState<"sample" | "standard">(
    initialMode === "sample" && sampleAvailable ? "sample" : "standard"
  )
  const [projectName, setProjectName] = useState("")
  const [trades, setTrades] = useState<TakeoffTrade[]>([])
  const [notes, setNotes] = useState("")
  const [samplePage, setSamplePage] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const canPrepare =
    projectName.trim().length >= 2 && trades.length > 0 && Boolean(file)
  const insufficient = Boolean(
    quote && quote.selfServe && quote.credits > availableCredits
  )
  const fileSize = useMemo(
    () =>
      file
        ? new Intl.NumberFormat("en", {
            style: "unit",
            unit: "megabyte",
            maximumFractionDigits: 1,
          }).format(file.size / 1024 / 1024)
        : "",
    [file]
  )

  function toggleTrade(trade: TakeoffTrade) {
    setQuote(null)
    setJobId(null)
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
      toast.error("Upload a PDF plan set.")
      event.target.value = ""
      return
    }
    setFile(nextFile)
    setQuote(null)
    setJobId(null)
  }

  async function prepareQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || !canPrepare) return

    setBusy(true)
    setProgress(5)
    try {
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
        throw new Error(draft.error ?? "Could not create the takeoff.")
      }

      setJobId(draft.job.id)
      setProgress(20)
      const supabase = createSupabaseBrowserClient()
      const { error: uploadError } = await supabase.storage
        .from(draft.upload.bucket)
        .uploadToSignedUrl(draft.upload.path, draft.upload.token, file, {
          contentType: "application/pdf",
          upsert: false,
        })

      if (uploadError) throw new Error(uploadError.message)

      setProgress(75)
      const quoteResponse = await fetch(
        `/api/takeoff/jobs/${draft.job.id}/submit`,
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
        throw new Error(prepared.error ?? "Could not verify the plan set.")
      }

      setQuote(prepared.quote)
      setProgress(100)
      toast.success("Plan set verified. Review the fixed quote.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.")
      setProgress(0)
    } finally {
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
          throw new Error(
            `You need ${payload.required ?? quote.credits} credits. Add credits before confirming.`
          )
        }
        throw new Error(payload.error ?? "Could not queue the takeoff.")
      }
      toast.success("Takeoff queued.")
      router.push(`/dashboard/jobs/${jobId}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <form onSubmit={prepareQuote}>
        <Card>
          <CardHeader>
            <CardTitle>Project and scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setMode("standard")
                  setQuote(null)
                  setJobId(null)
                }}
                className={cn(
                  "border p-4 text-left",
                  mode === "standard"
                    ? "border-primary bg-blue-50/60"
                    : "hover:border-primary/50"
                )}
              >
                <p className="font-medium">Verified takeoff</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Fixed credit quote after server verification.
                </p>
              </button>
              <button
                type="button"
                disabled={!sampleAvailable}
                onClick={() => {
                  setMode("sample")
                  setQuote(null)
                  setJobId(null)
                }}
                className={cn(
                  "border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50",
                  mode === "sample"
                    ? "border-primary bg-blue-50/60"
                    : "hover:border-primary/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Free one-sheet sample</p>
                  <Badge variant="secondary">
                    {sampleAvailable ? "Available" : "Used"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  One launch trade, once per company.
                </p>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(event) => {
                  setProjectName(event.target.value)
                  setQuote(null)
                  setJobId(null)
                }}
                placeholder="Northside retail fit-out"
                required
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">
                What should we measure?
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {takeoffTrades.map((trade) => {
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
                        disabled={mode === "sample" && !selected && trades.length >= 1}
                        onChange={() => toggleTrade(trade)}
                      />
                      <span>{tradeLabels[trade]}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="plan-file">Scaled PDF plan set</Label>
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
                    <p className="mt-3 font-medium">
                      Choose a plan set or drop it here
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PDF only · up to {maxUploadMb}MB · 250 pages
                    </p>
                  </div>
                )}
              </label>
              <Input
                id="plan-file"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={chooseFile}
              />
            </div>

            {mode === "sample" ? (
              <div className="space-y-2">
                <Label htmlFor="sample-page">Sheet/page to measure</Label>
                <Input
                  id="sample-page"
                  type="number"
                  min={1}
                  max={250}
                  value={samplePage}
                  onChange={(event) =>
                    setSamplePage(Math.max(1, Number(event.target.value)))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  We will extract only this PDF page for the free sample.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="notes">Instructions and assumptions</Label>
              <Textarea
                id="notes"
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Areas to include or exclude, finish codes, alternates, naming conventions..."
              />
            </div>

            {busy ? <Progress value={progress} /> : null}

            <Button
              type="submit"
              size="lg"
              disabled={!canPrepare || busy}
              className="w-full"
            >
              {busy ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Verifying plan set
                </>
              ) : (
                <>
                  Upload and get fixed quote
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
            <CardTitle>Fixed quote</CardTitle>
          </CardHeader>
          <CardContent>
            {quote ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground">{quote.name}</p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <p className="text-4xl font-semibold">
                      {quote.credits.toLocaleString()}
                    </p>
                    <p className="pb-1 text-sm text-muted-foreground">
                      credits
                    </p>
                  </div>
                </div>
                <div className="space-y-2 border-y py-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verified pages</span>
                    <span className="font-medium">{quote.pageCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available</span>
                    <span className="font-medium">
                      {availableCredits.toLocaleString()} credits
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery target</span>
                    <span className="font-medium">In hours</span>
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {quote.description}
                </p>
                {insufficient ? (
                  <Alert variant="destructive">
                    <AlertTitle>More credits required</AlertTitle>
                    <AlertDescription>
                      Add {quote.credits - availableCredits} credits to confirm
                      this takeoff.
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
                    Reserve credits and start
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
                    Add credits
                  </Link>
                )}
              </div>
            ) : (
              <div className="py-10 text-center">
                <CoinsIcon className="mx-auto size-8 text-primary" />
                <p className="mt-4 font-medium">No browser-estimated charges</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cuadrabot verifies the uploaded object and actual PDF page
                  count on the server before showing the price.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3 border bg-white p-5 text-sm">
          {[
            [LockIcon, "Private object storage"],
            [RulerIcon, "Scale and page verification"],
            [ShieldCheckIcon, "Automated validation before delivery"],
          ].map(([Icon, label]) => (
            <div key={String(label)} className="flex items-center gap-3">
              <Icon className="size-4 text-primary" />
              <span>{String(label)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
