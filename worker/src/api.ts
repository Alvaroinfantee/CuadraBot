import fs from "node:fs/promises"
import path from "node:path"
import { workerConfig } from "./config"

export type WorkerJob = {
  id: string
  public_token: string
  order_number: string
  customer_email: string
  package_id: string | null
  status: string
  render_type: string | null
  project_type: string | null
  style_preference: string | null
  number_of_floors: number | null
  estimated_square_meters: number | null
  customer_notes: string | null
  deadline_preference: string | null
  assigned_worker_id: string | null
  created_at: string
}

export type WorkerFile = {
  id: string
  filename: string
  mimeType: string | null
  sizeBytes: number | null
  signedUrl: string
}

function workerHeaders(extra?: HeadersInit) {
  return {
    authorization: `Bearer ${workerConfig.apiKey}`,
    "x-worker-id": workerConfig.workerId,
    ...extra,
  }
}

async function apiJson<T>(pathName: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${workerConfig.apiUrl}${pathName}`, {
    ...init,
    headers: workerHeaders(init?.headers),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed: ${response.status}`)
  }

  return body as T
}

export async function getNextJob() {
  const data = await apiJson<{ job: WorkerJob | null }>("/api/worker/jobs/next")
  return data.job
}

export async function claimJob(jobId: string) {
  const data = await apiJson<{ job: WorkerJob }>(`/api/worker/jobs/${jobId}/claim`, {
    method: "POST",
  })
  return data.job
}

export async function getJobFiles(jobId: string) {
  const data = await apiJson<{ files: WorkerFile[] }>(`/api/worker/jobs/${jobId}/files`)
  return data.files
}

export async function updateJobStatus(
  jobId: string,
  status: "processing" | "needs_review" | "completed" | "failed",
  details?: { logs?: string; error_message?: string }
) {
  return apiJson<{ job: WorkerJob }>(`/api/worker/jobs/${jobId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, ...details }),
  })
}

export async function uploadFinalFiles(jobId: string, files: string[]) {
  const form = new FormData()

  for (const filePath of files) {
    const bytes = await fs.readFile(filePath)
    const filename = path.basename(filePath)
    const type = filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png"

    form.append("files", new Blob([new Uint8Array(bytes)], { type }), filename)
  }

  const response = await fetch(`${workerConfig.apiUrl}/api/worker/jobs/${jobId}/final-files`, {
    method: "POST",
    headers: workerHeaders(),
    body: form,
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error ?? `Final file upload failed: ${response.status}`)
  }

  return body
}

export async function downloadSignedFile(file: WorkerFile, destinationDir: string) {
  await fs.mkdir(destinationDir, { recursive: true })
  const response = await fetch(file.signedUrl)

  if (!response.ok) {
    throw new Error(`Failed to download ${file.filename}: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const cleanName = file.filename.replace(/[^\w.-]+/g, "_")
  const destination = path.join(destinationDir, cleanName)
  await fs.writeFile(destination, Buffer.from(arrayBuffer))
  return destination
}
