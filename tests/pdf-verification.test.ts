import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import {
  PdfVerificationError,
  QpdfExecutionError,
  type QpdfRunner,
  verifyPdfStream,
} from "../src/lib/pdf-verification"

const maxBytes = 25 * 1024 * 1024

test("accepts a bounded 250-page vector PDF without loading it in JavaScript", async () => {
  const pdf = buildVectorPdf(250)
  let stagedPath = ""
  const result = await verifyPdfStream(new Blob([pdf]).stream(), {
    maxBytes,
    maxPages: 250,
    runner: fakeRunner({ pages: 250, captureInput: (value) => (stagedPath = value) }),
  })

  assert.equal(result.originalPageCount, 250)
  assert.equal(result.originalSizeBytes, pdf.byteLength)
  assert.equal(
    result.originalSha256,
    createHash("sha256").update(pdf).digest("hex")
  )
  assert.equal(result.sampleBytes, null)
  assert.equal(existsSync(stagedPath), false)
})

test("isolates one sample page through qpdf and returns only the bounded output", async () => {
  const source = buildVectorPdf(3)
  const sample = buildVectorPdf(1)
  const result = await verifyPdfStream(new Blob([source]).stream(), {
    maxBytes,
    maxPages: 250,
    samplePage: 2,
    runner: fakeRunner({ pages: 3, sample }),
  })

  assert.deepEqual(result.sampleBytes, sample)
  assert.equal(result.verifiedSizeBytes, sample.byteLength)
  assert.equal(
    result.verifiedSha256,
    createHash("sha256").update(sample).digest("hex")
  )
})

test("rejects non-PDF, oversized, encrypted, and out-of-range inputs", async () => {
  await assertPdfFailure(
    () =>
      verifyPdfStream(new Blob(["not a pdf"]).stream(), {
        maxBytes,
        maxPages: 250,
        runner: fakeRunner({ pages: 1 }),
      }),
    "not_pdf"
  )

  await assertPdfFailure(
    () =>
      verifyPdfStream(new Blob([buildVectorPdf(1)]).stream(), {
        maxBytes: 8,
        maxPages: 250,
        runner: fakeRunner({ pages: 1 }),
      }),
    "too_large"
  )

  await assertPdfFailure(
    () =>
      verifyPdfStream(new Blob([buildVectorPdf(1)]).stream(), {
        maxBytes,
        maxPages: 250,
        runner: fakeRunner({ encrypted: true, pages: 1 }),
      }),
    "encrypted"
  )

  await assertPdfFailure(
    () =>
      verifyPdfStream(new Blob([buildVectorPdf(250)]).stream(), {
        maxBytes,
        maxPages: 249,
        runner: fakeRunner({ pages: 250 }),
      }),
    "page_count"
  )

  await assertPdfFailure(
    () =>
      verifyPdfStream(new Blob([buildVectorPdf(2)]).stream(), {
        maxBytes,
        maxPages: 250,
        samplePage: 3,
        runner: fakeRunner({ pages: 2 }),
      }),
    "sample_page"
  )
})

test("fails closed on qpdf parse/bomb errors and hard timeouts", async () => {
  await assertPdfFailure(
    () =>
      verifyPdfStream(new Blob([buildVectorPdf(1)]).stream(), {
        maxBytes,
        maxPages: 250,
        runner: fakeRunner({ pages: 1, parseFailure: true }),
      }),
    "invalid"
  )

  const timeoutRunner: QpdfRunner = async (args) => {
    if (args[0] === "--is-encrypted") return { exitCode: 2, stdout: "" }
    throw new QpdfExecutionError("timeout")
  }
  await assertPdfFailure(
    () =>
      verifyPdfStream(new Blob([buildVectorPdf(1)]).stream(), {
        maxBytes,
        maxPages: 250,
        runner: timeoutRunner,
      }),
    "timeout"
  )
})

test("accepts qpdf warning status only when bounded page output is valid", async () => {
  const warningRunner: QpdfRunner = async (args) => {
    if (args[0] === "--is-encrypted") return { exitCode: 2, stdout: "" }
    return { exitCode: 3, stdout: "4\n" }
  }
  const result = await verifyPdfStream(
    new Blob([buildVectorPdf(4)]).stream(),
    {
      maxBytes,
      maxPages: 250,
      runner: warningRunner,
    }
  )
  assert.equal(result.originalPageCount, 4)
})

test(
  "native qpdf accepts the 250-page vector and rejects an encrypted copy",
  { skip: process.platform !== "linux" || !existsSync("/usr/bin/qpdf") },
  async () => {
    const source = buildVectorPdf(250)
    const result = await verifyPdfStream(new Blob([source]).stream(), {
      maxBytes,
      maxPages: 250,
    })
    assert.equal(result.originalPageCount, 250)

    const directory = await mkdtemp(path.join(tmpdir(), "cuadrabot-encrypted-"))
    try {
      const sourcePath = path.join(directory, "source.pdf")
      const encryptedPath = path.join(directory, "encrypted.pdf")
      await writeFile(sourcePath, source)
      const encrypted = spawnSync(
        "/usr/bin/qpdf",
        [
          "--encrypt",
          "customer-password",
          "owner-password",
          "256",
          "--",
          sourcePath,
          encryptedPath,
        ],
        { stdio: "ignore" }
      )
      assert.equal(encrypted.status, 0)
      const encryptedBytes = await readFile(encryptedPath)
      await assertPdfFailure(
        () =>
          verifyPdfStream(new Blob([encryptedBytes]).stream(), {
            maxBytes,
            maxPages: 250,
          }),
        "encrypted"
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
)

function fakeRunner(options: {
  encrypted?: boolean
  pages: number
  parseFailure?: boolean
  sample?: Buffer
  captureInput?: (path: string) => void
}): QpdfRunner {
  return async (args) => {
    const inputIndex = args[0] === "--pages" ? 1 : args.length - 1
    const inputPath = args[inputIndex]
    if (inputPath) options.captureInput?.(inputPath)

    if (args[0] === "--is-encrypted") {
      return { exitCode: options.encrypted ? 0 : 2, stdout: "" }
    }
    if (args[0] === "--show-npages") {
      return options.parseFailure
        ? { exitCode: 2, stdout: "" }
        : {
            exitCode: 0,
            stdout: `${inputPath?.endsWith("sample.pdf") ? 1 : options.pages}\n`,
          }
    }
    if (args[0] === "--empty") {
      const outputPath = args.at(-1)
      assert.ok(outputPath)
      await writeFile(outputPath, options.sample ?? buildVectorPdf(1), {
        mode: 0o600,
      })
      return { exitCode: 0, stdout: "" }
    }
    throw new Error(`Unexpected qpdf arguments: ${args.join(" ")}`)
  }
}

async function assertPdfFailure(
  operation: () => Promise<unknown>,
  expectedCode: PdfVerificationError["code"]
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof PdfVerificationError)
    assert.equal(error.code, expectedCode)
    return true
  })
}

function buildVectorPdf(pageCount: number) {
  const kids = Array.from(
    { length: pageCount },
    (_, index) => `${index + 3} 0 R`
  ).join(" ")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`,
    ...Array.from(
      { length: pageCount },
      () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>"
    ),
  ]

  let content = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(content, "latin1"))
    content += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(content, "latin1")
  content += `xref\n0 ${objects.length + 1}\n`
  content += "0000000000 65535 f \n"
  content += offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  content += `startxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(content, "latin1")
}
