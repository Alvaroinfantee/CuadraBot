import { NextResponse } from "next/server"
import { PDFDocument } from "pdf-lib"
import { maxUploadBytes, maxUploadMb } from "@/lib/config"
import { jsonError } from "@/lib/http"
import { calculateTakeoffQuote } from "@/lib/takeoff-quote"
import { quoteCurrencies, type QuoteCurrency } from "@/lib/project-quote"

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null)

  if (!formData) {
    return jsonError("Invalid quote request.", 400)
  }

  const currencyValue = formData.get("currency")
  const currency = quoteCurrencies.includes(String(currencyValue) as QuoteCurrency)
    ? (currencyValue as QuoteCurrency)
    : "usd"
  const files = formData.getAll("files").filter((value): value is File => value instanceof File)

  if (!files.length) {
    return jsonError("Upload at least one PDF blueprint.", 400)
  }

  let quotedFiles

  try {
    quotedFiles = await Promise.all(
      files.map(async (file) => {
        if (!isPdfFile(file)) {
          throw new Error(`${file.name} must be a PDF.`)
        }

        if (file.size > maxUploadBytes) {
          throw new Error(`${file.name} must be ${maxUploadMb}MB or smaller.`)
        }

        const document = await PDFDocument.load(await file.arrayBuffer(), {
          ignoreEncryption: true,
        })

        return {
          name: file.name,
          pageCount: document.getPageCount(),
          sizeBytes: file.size,
        }
      })
    )
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not read PDF pages.",
      400
    )
  }

  const pageCount = quotedFiles.reduce((total, file) => total + file.pageCount, 0)
  const quote = calculateTakeoffQuote({ currency, pageCount, files: quotedFiles })

  return NextResponse.json({ quote })
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}
