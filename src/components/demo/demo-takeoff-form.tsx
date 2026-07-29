"use client"

import { useState, type ChangeEvent } from "react"
import Link from "next/link"
import {
  CheckCircle2Icon,
  FileTextIcon,
  Loader2Icon,
  UploadCloudIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export function DemoTakeoffForm() {
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<"draft" | "checking" | "quoted" | "queued">("draft")
  const [progress, setProgress] = useState(0)

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
    setStage("draft")
  }

  function previewQuote() {
    if (!file) return
    setStage("checking")
    setProgress(25)
    window.setTimeout(() => setProgress(70), 350)
    window.setTimeout(() => {
      setProgress(100)
      setStage("quoted")
    }, 800)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Project and scope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Project name</Label>
            <Input defaultValue="Westfield medical suite" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Flooring & finishes", "Drywall & ceilings", "Doors & openings"].map(
              (trade, index) => (
                <label
                  key={trade}
                  className={cn(
                    "flex gap-2 border p-4 text-sm",
                    index < 2 && "border-primary bg-blue-50"
                  )}
                >
                  <input type="checkbox" defaultChecked={index < 2} />
                  {trade}
                </label>
              )
            )}
          </div>
          <label className="grid min-h-44 cursor-pointer place-items-center border border-dashed bg-muted/20 p-6 text-center">
            {file ? (
              <div>
                <FileTextIcon className="mx-auto size-8 text-primary" />
                <p className="mt-3 font-medium">{file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stays in this browser during preview
                </p>
              </div>
            ) : (
              <div>
                <UploadCloudIcon className="mx-auto size-8 text-primary" />
                <p className="mt-3 font-medium">Choose any PDF to preview</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Demo mode never uploads it
                </p>
              </div>
            )}
            <Input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={chooseFile}
            />
          </label>
          <div className="space-y-2">
            <Label>Instructions</Label>
            <Textarea
              rows={5}
              defaultValue="Measure tenant areas only. Exclude the existing core and shell."
            />
          </div>
          {stage === "checking" ? <Progress value={progress} /> : null}
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!file || stage === "checking"}
            onClick={previewQuote}
          >
            {stage === "checking" ? (
              <>
                <Loader2Icon className="animate-spin" />
                Simulating server verification
              </>
            ) : (
              "Preview fixed quote"
            )}
          </Button>
        </CardContent>
      </Card>
      <Card className={stage === "quoted" || stage === "queued" ? "border-primary" : ""}>
        <CardHeader>
          <CardTitle>Fixed quote</CardTitle>
        </CardHeader>
        <CardContent>
          {stage === "quoted" || stage === "queued" ? (
            <div className="space-y-5">
              <Badge>Multi-Trade</Badge>
              <div>
                <p className="text-4xl font-semibold">299</p>
                <p className="mt-1 text-sm text-muted-foreground">credits</p>
              </div>
              <div className="space-y-2 border-y py-4 text-sm">
                <p className="flex justify-between"><span>Verified pages</span><strong>18</strong></p>
                <p className="flex justify-between"><span>Launch trades</span><strong>2</strong></p>
                <p className="flex justify-between"><span>Target</span><strong>In hours</strong></p>
              </div>
              {stage === "queued" ? (
                <>
                  <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <CheckCircle2Icon className="size-5" />
                    Demo takeoff queued. No credits moved.
                  </div>
                  <Link href="/demo/dashboard" className={cn(buttonVariants(), "w-full")}>
                    Return to workspace
                  </Link>
                </>
              ) : (
                <Button type="button" className="w-full" onClick={() => setStage("queued")}>
                  Simulate reserve and queue
                </Button>
              )}
            </div>
          ) : (
            <div className="py-14 text-center text-sm leading-6 text-muted-foreground">
              Choose a local PDF to see the verified-quote and confirmation
              states. The file never leaves your browser in this preview.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
