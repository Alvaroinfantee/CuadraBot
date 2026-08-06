import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import {
  chmod,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const PDF_HEADER = new TextEncoder().encode("%PDF-")
const QPDF_STDIO_LIMIT_BYTES = 8 * 1024
const QPDF_WALL_TIMEOUT_MS = 45_000
const QPDF_VIRTUAL_MEMORY_KIB = 512 * 1024
const QPDF_CPU_SECONDS = 45
const QPDF_OUTPUT_BLOCKS = 51_200

export type PdfVerificationFailureCode =
  | "encrypted"
  | "invalid"
  | "not_pdf"
  | "page_count"
  | "sample_page"
  | "timeout"
  | "too_large"

export class PdfVerificationError extends Error {
  constructor(
    public readonly code: PdfVerificationFailureCode,
    message: string
  ) {
    super(message)
    this.name = "PdfVerificationError"
  }
}

export type QpdfCommandResult = {
  exitCode: number
  stdout: string
}

export type QpdfRunner = (
  args: readonly string[]
) => Promise<QpdfCommandResult>

export type VerifiedPdf = {
  originalPageCount: number
  originalSha256: string
  originalSizeBytes: number
  sampleBytes: Buffer | null
  verifiedSha256: string
  verifiedSizeBytes: number
}

export async function verifyPdfStream(
  stream: ReadableStream<Uint8Array>,
  options: {
    maxBytes: number
    maxPages: number
    samplePage?: number | null
    runner?: QpdfRunner
    tempRoot?: string
  }
): Promise<VerifiedPdf> {
  const { maxBytes, maxPages, samplePage = null } = options
  if (!Number.isSafeInteger(maxBytes) || maxBytes < PDF_HEADER.byteLength) {
    throw new TypeError("maxBytes must be a positive safe integer.")
  }
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new TypeError("maxPages must be a positive safe integer.")
  }
  if (
    samplePage !== null &&
    (!Number.isSafeInteger(samplePage) || samplePage < 1)
  ) {
    throw new PdfVerificationError(
      "sample_page",
      "The requested sample page is invalid."
    )
  }

  const runner = options.runner ?? runRestrictedQpdf
  const tempPrefix = path.join(
    path.resolve(options.tempRoot ?? tmpdir()),
    "cuadrabot-pdf-"
  )
  const tempDirectory = await mkdtemp(tempPrefix)
  await chmod(tempDirectory, 0o700)
  const inputPath = path.join(tempDirectory, "source.pdf")
  const samplePath = path.join(tempDirectory, "sample.pdf")

  try {
    const staged = await stagePdf(stream, inputPath, maxBytes)

    const encryption = await executeQpdf(
      runner,
      ["--is-encrypted", inputPath],
      "invalid"
    )
    if (encryption.exitCode === 0) {
      throw new PdfVerificationError(
        "encrypted",
        "Encrypted or password-protected PDFs are not accepted."
      )
    }
    // qpdf documents exit 2 as the affirmative "not encrypted" result for
    // this inspection command. Any other status is fail-closed.
    if (encryption.exitCode !== 2) {
      throw new PdfVerificationError("invalid", "The PDF is invalid.")
    }

    const pageResult = await executeQpdf(
      runner,
      ["--show-npages", inputPath],
      "invalid"
    )
    if (
      !isQpdfSuccess(pageResult.exitCode) ||
      !/^\d+\s*$/.test(pageResult.stdout)
    ) {
      throw new PdfVerificationError("invalid", "The PDF is invalid.")
    }
    const originalPageCount = Number.parseInt(pageResult.stdout.trim(), 10)
    if (
      !Number.isSafeInteger(originalPageCount) ||
      originalPageCount < 1 ||
      originalPageCount > maxPages
    ) {
      throw new PdfVerificationError(
        "page_count",
        `Plan sets must contain between 1 and ${maxPages} pages.`
      )
    }
    if (samplePage !== null && samplePage > originalPageCount) {
      throw new PdfVerificationError(
        "sample_page",
        `Sample page ${samplePage} is outside this ${originalPageCount}-page PDF.`
      )
    }

    if (samplePage === null) {
      return {
        ...staged,
        originalPageCount,
        sampleBytes: null,
        verifiedSha256: staged.originalSha256,
        verifiedSizeBytes: staged.originalSizeBytes,
      }
    }

    const extraction = await executeQpdf(
      runner,
      [
        "--empty",
        "--pages",
        inputPath,
        String(samplePage),
        "--",
        samplePath,
      ],
      "invalid"
    )
    if (!isQpdfSuccess(extraction.exitCode)) {
      throw new PdfVerificationError(
        "invalid",
        "The requested PDF page could not be isolated."
      )
    }

    const samplePageResult = await executeQpdf(
      runner,
      ["--show-npages", samplePath],
      "invalid"
    )
    if (
      !isQpdfSuccess(samplePageResult.exitCode) ||
      samplePageResult.stdout.trim() !== "1"
    ) {
      throw new PdfVerificationError(
        "invalid",
        "The isolated sample PDF did not contain exactly one valid page."
      )
    }

    await chmod(samplePath, 0o600)
    const sampleStats = await stat(samplePath)
    if (!sampleStats.isFile() || sampleStats.size < PDF_HEADER.byteLength) {
      throw new PdfVerificationError("invalid", "The sample PDF is invalid.")
    }
    if (sampleStats.size > maxBytes) {
      throw new PdfVerificationError(
        "too_large",
        "The isolated sample exceeds the file limit."
      )
    }
    const sampleBytes = await readFile(samplePath)
    if (!hasPdfHeader(sampleBytes)) {
      throw new PdfVerificationError("invalid", "The sample PDF is invalid.")
    }

    return {
      ...staged,
      originalPageCount,
      sampleBytes,
      verifiedSha256: createHash("sha256").update(sampleBytes).digest("hex"),
      verifiedSizeBytes: sampleBytes.byteLength,
    }
  } finally {
    await removeOwnedTempDirectory(tempDirectory, tempPrefix)
  }
}

async function stagePdf(
  stream: ReadableStream<Uint8Array>,
  inputPath: string,
  maxBytes: number
) {
  const reader = stream.getReader()
  const file = await open(inputPath, "wx", 0o600)
  const hash = createHash("sha256")
  const header = new Uint8Array(PDF_HEADER.byteLength)
  let headerBytes = 0
  let totalBytes = 0
  let complete = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        complete = true
        break
      }
      if (!(value instanceof Uint8Array) || value.byteLength === 0) continue
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        throw new PdfVerificationError(
          "too_large",
          "The uploaded plan exceeds the file limit."
        )
      }

      if (headerBytes < header.byteLength) {
        const copyLength = Math.min(
          header.byteLength - headerBytes,
          value.byteLength
        )
        header.set(value.subarray(0, copyLength), headerBytes)
        headerBytes += copyLength
      }
      hash.update(value)
      let offset = 0
      while (offset < value.byteLength) {
        const { bytesWritten } = await file.write(
          value,
          offset,
          value.byteLength - offset
        )
        if (bytesWritten < 1) {
          throw new Error("The staged PDF write made no forward progress.")
        }
        offset += bytesWritten
      }
    }
  } finally {
    await file.close()
    if (!complete) await reader.cancel().catch(() => undefined)
  }

  if (totalBytes < PDF_HEADER.byteLength || !hasPdfHeader(header)) {
    throw new PdfVerificationError(
      "not_pdf",
      "The uploaded object is not a PDF."
    )
  }

  return {
    originalSha256: hash.digest("hex"),
    originalSizeBytes: totalBytes,
  }
}

function hasPdfHeader(bytes: Uint8Array) {
  return PDF_HEADER.every((byte, index) => bytes[index] === byte)
}

function isQpdfSuccess(exitCode: number) {
  // qpdf exit 3 means the requested operation completed with warnings. Many
  // real construction PDFs contain recoverable duplicate dictionary keys; the
  // bounded output/page checks below remain authoritative.
  return exitCode === 0 || exitCode === 3
}

async function executeQpdf(
  runner: QpdfRunner,
  args: readonly string[],
  fallbackCode: PdfVerificationFailureCode
) {
  try {
    return await runner(args)
  } catch (error) {
    if (error instanceof QpdfExecutionError && error.reason === "timeout") {
      throw new PdfVerificationError(
        "timeout",
        "PDF verification timed out."
      )
    }
    throw new PdfVerificationError(fallbackCode, "The PDF is invalid.")
  }
}

export class QpdfExecutionError extends Error {
  constructor(public readonly reason: "output_limit" | "spawn" | "timeout") {
    super(`qpdf execution failed: ${reason}`)
    this.name = "QpdfExecutionError"
  }
}

export const runRestrictedQpdf: QpdfRunner = async (args) =>
  new Promise((resolve, reject) => {
    // The shell only applies native OS resource limits. Every dynamic value,
    // including file paths, is a positional argument and is never interpolated
    // into the command string.
    const child = spawn(
      "/bin/sh",
      [
        "-c",
        'ulimit -v "$1"; ulimit -t "$2"; ulimit -f "$3"; shift 3; exec /usr/bin/qpdf "$@"',
        "cuadrabot-qpdf",
        String(QPDF_VIRTUAL_MEMORY_KIB),
        String(QPDF_CPU_SECONDS),
        String(QPDF_OUTPUT_BLOCKS),
        ...args,
      ],
      {
        detached: process.platform !== "win32",
        env: {
          LANG: "C",
          NODE_ENV: process.env.NODE_ENV ?? "production",
          PATH: "/usr/bin:/bin",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }
    )

    const stdout: Buffer[] = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let settled = false

    const settle = (
      result:
        | { kind: "resolve"; value: QpdfCommandResult }
        | { kind: "reject"; error: QpdfExecutionError }
    ) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (result.kind === "resolve") resolve(result.value)
      else reject(result.error)
    }

    const terminate = () => {
      if (child.pid && process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGKILL")
        } catch {
          child.kill("SIGKILL")
        }
      } else {
        child.kill("SIGKILL")
      }
    }

    const rejectForOutput = () => {
      terminate()
      settle({
        kind: "reject",
        error: new QpdfExecutionError("output_limit"),
      })
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength
      if (stdoutBytes > QPDF_STDIO_LIMIT_BYTES) {
        rejectForOutput()
        return
      }
      stdout.push(chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength
      if (stderrBytes > QPDF_STDIO_LIMIT_BYTES) rejectForOutput()
    })
    child.once("error", () => {
      settle({ kind: "reject", error: new QpdfExecutionError("spawn") })
    })
    child.once("close", (exitCode) => {
      if (settled) return
      if (typeof exitCode !== "number") {
        settle({ kind: "reject", error: new QpdfExecutionError("spawn") })
        return
      }
      settle({
        kind: "resolve",
        value: {
          exitCode,
          stdout: Buffer.concat(stdout, stdoutBytes).toString("utf8"),
        },
      })
    })

    const timeout = setTimeout(() => {
      terminate()
      settle({ kind: "reject", error: new QpdfExecutionError("timeout") })
    }, QPDF_WALL_TIMEOUT_MS)
    timeout.unref()
  })

async function removeOwnedTempDirectory(
  tempDirectory: string,
  expectedPrefix: string
) {
  const resolvedDirectory = path.resolve(tempDirectory)
  const resolvedPrefix = path.resolve(expectedPrefix)
  if (
    !resolvedDirectory.startsWith(resolvedPrefix) ||
    resolvedDirectory === path.dirname(resolvedPrefix)
  ) {
    throw new Error("Refusing to remove an unexpected PDF temporary path.")
  }
  await rm(resolvedDirectory, { recursive: true, force: true })
}
