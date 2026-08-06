import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { takeoffResultBucket } from "@/lib/config"
import { jsonError } from "@/lib/http"
import { getClaimedTakeoff } from "@/lib/internal-worker"
import {
  readRequestJsonWithLimit,
  requestBodyLimits,
} from "@/lib/request-body"
import {
  maxTakeoffArtifactBytes,
  parseTakeoffArtifactDescriptors,
  takeoffArtifactRole,
  type TakeoffArtifactDescriptor,
} from "@/lib/takeoff-artifacts"

type Context = { params: Promise<{ id: string }> }

type ArtifactRequest = {
  action?: unknown
  microserviceJobId?: unknown
  artifacts?: unknown
}

type SupabaseAdmin = Exclude<
  Awaited<ReturnType<typeof getClaimedTakeoff>>,
  Response
>["supabase"]

type ClaimedJob = Exclude<
  Awaited<ReturnType<typeof getClaimedTakeoff>>,
  Response
>["job"]

type TakeoffFileRow = {
  id: string
  job_id: string
  user_id: string
  bucket: string
  storage_path: string
  original_filename: string
  file_role: string
  mime_type: string | null
  size_bytes: number | string | null
  sha256: string | null
  verified_at: string | null
  created_at: string
}

export const maxDuration = 300

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const contextResult = await getClaimedTakeoff(request, id)
  if (contextResult instanceof Response) return contextResult

  const { job, supabase, worker } = contextResult
  if (job.status !== "processing") {
    return jsonError(
      "Artifacts can only be prepared or finalized while the takeoff is processing.",
      409
    )
  }

  const bodyResult = await readRequestJsonWithLimit(
    request,
    requestBodyLimits.workerResultJson
  )
  if (!bodyResult.ok && bodyResult.reason === "too_large") {
    return jsonError("Artifact descriptor payload is too large.", 413)
  }
  const body = bodyResult.ok
    ? (bodyResult.value as ArtifactRequest | null)
    : null
  if (!body || !["prepare", "finalize"].includes(String(body.action))) {
    return jsonError("Artifact action must be prepare or finalize.", 422)
  }

  const microserviceJobId = parseMicroserviceJobId(body.microserviceJobId)
  if (!microserviceJobId) {
    return jsonError("A valid microservice job ID is required.", 422)
  }
  if (
    job.processor_job_id &&
    job.processor_job_id !== microserviceJobId
  ) {
    return jsonError("The processor job ID does not match this takeoff.", 409)
  }

  const parsed = parseTakeoffArtifactDescriptors(body.artifacts)
  if (!parsed.success) return jsonError(parsed.error, 422)

  const guardError = await guardProcessingClaim({
    supabase,
    job,
    workerId: worker.workerId,
    claimToken: worker.claimToken,
    microserviceJobId,
  })
  if (guardError) return guardError

  if (body.action === "prepare") {
    return prepareArtifactUploads(supabase, job, parsed.data)
  }

  return finalizeArtifactUploads({
    supabase,
    job,
    workerId: worker.workerId,
    claimToken: worker.claimToken,
    microserviceJobId,
    descriptors: parsed.data,
  })
}

async function prepareArtifactUploads(
  supabase: SupabaseAdmin,
  job: ClaimedJob,
  descriptors: TakeoffArtifactDescriptor[]
) {
  const rowsResult = await loadRegisteredRows(supabase, job, descriptors)
  if (rowsResult instanceof Response) return rowsResult
  const registeredByPath = new Map(
    rowsResult.map((row) => [row.storage_path, row])
  )

  const uploads = []
  const storage = supabase.storage.from(takeoffResultBucket)

  for (const descriptor of descriptors) {
    const storagePath = artifactStoragePath(job, descriptor)
    const registered = registeredByPath.get(storagePath)
    if (registered) {
      if (!registeredRowMatches(registered, job, descriptor)) {
        return jsonError(
          `A different immutable artifact is already registered for ${descriptor.filename}.`,
          409
        )
      }
      uploads.push({
        ...descriptor,
        storagePath,
        state: "registered" as const,
        signedUrl: null,
      })
      continue
    }

    const { data: exists } = await storage.exists(storagePath)
    if (exists) {
      uploads.push({
        ...descriptor,
        storagePath,
        state: "already_uploaded" as const,
        signedUrl: null,
      })
      continue
    }

    const { data, error } = await storage.createSignedUploadUrl(storagePath, {
      upsert: false,
    })
    if (error || !data) {
      return jsonError(
        error?.message ?? `Could not prepare ${descriptor.filename}.`,
        500
      )
    }

    uploads.push({
      ...descriptor,
      storagePath,
      state: "upload_required" as const,
      signedUrl: data.signedUrl,
    })
  }

  return NextResponse.json({ uploads })
}

async function finalizeArtifactUploads({
  supabase,
  job,
  workerId,
  claimToken,
  microserviceJobId,
  descriptors,
}: {
  supabase: SupabaseAdmin
  job: ClaimedJob
  workerId: string
  claimToken: string
  microserviceJobId: string
  descriptors: TakeoffArtifactDescriptor[]
}) {
  const rowsResult = await loadRegisteredRows(supabase, job, descriptors)
  if (rowsResult instanceof Response) return rowsResult

  const registeredByPath = new Map(
    rowsResult.map((row) => [row.storage_path, row])
  )
  const verified = new Set<string>()

  for (const descriptor of descriptors) {
    const storagePath = artifactStoragePath(job, descriptor)
    const registered = registeredByPath.get(storagePath)
    if (registered) {
      if (!registeredRowMatches(registered, job, descriptor)) {
        return jsonError(
          `A different immutable artifact is already registered for ${descriptor.filename}.`,
          409
        )
      }
      continue
    }

    const verification = await verifyStoredArtifact(
      supabase,
      storagePath,
      descriptor
    )
    if (verification instanceof Response) return verification
    verified.add(storagePath)
  }

  const guardError = await guardProcessingClaim({
    supabase,
    job,
    workerId,
    claimToken,
    microserviceJobId,
  })
  if (guardError) return guardError

  const rows: TakeoffFileRow[] = []
  for (const descriptor of descriptors) {
    const storagePath = artifactStoragePath(job, descriptor)
    const registered = registeredByPath.get(storagePath)
    if (registered) {
      rows.push(registered)
      continue
    }
    if (!verified.has(storagePath)) {
      return jsonError(
        `Artifact verification was not completed for ${descriptor.filename}.`,
        500
      )
    }

    const candidate = {
      job_id: job.id,
      user_id: job.user_id,
      bucket: takeoffResultBucket,
      storage_path: storagePath,
      original_filename: descriptor.filename,
      file_role: takeoffArtifactRole(descriptor.filename),
      mime_type: descriptor.mediaType,
      size_bytes: descriptor.bytes,
      sha256: descriptor.sha256,
      verified_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from("takeoff_files")
      .insert(candidate)
      .select("*")
      .single()

    if (!error && data) {
      rows.push(data as TakeoffFileRow)
      continue
    }

    if (error?.code !== "23505") {
      return jsonError(
        error?.message ?? `Could not register ${descriptor.filename}.`,
        500
      )
    }

    const { data: concurrent, error: concurrentError } = await supabase
      .from("takeoff_files")
      .select("*")
      .eq("bucket", takeoffResultBucket)
      .eq("storage_path", storagePath)
      .maybeSingle()
    if (
      concurrentError ||
      !concurrent ||
      !registeredRowMatches(
        concurrent as TakeoffFileRow,
        job,
        descriptor
      )
    ) {
      return jsonError(
        `A conflicting artifact was registered for ${descriptor.filename}.`,
        409
      )
    }
    rows.push(concurrent as TakeoffFileRow)
  }

  return NextResponse.json({ artifacts: rows })
}

async function verifyStoredArtifact(
  supabase: SupabaseAdmin,
  storagePath: string,
  descriptor: TakeoffArtifactDescriptor
): Promise<true | Response> {
  const storage = supabase.storage.from(takeoffResultBucket)
  const { data: info, error: infoError } = await storage.info(storagePath)
  if (infoError || !info) {
    return jsonError(`Uploaded artifact is missing: ${descriptor.filename}`, 409)
  }
  if (
    info.size !== undefined &&
    Number(info.size) !== descriptor.bytes
  ) {
    return jsonError(
      `Stored artifact size mismatch: ${descriptor.filename}`,
      422
    )
  }
  if (
    info.contentType &&
    normalizeMediaType(info.contentType) !== descriptor.mediaType
  ) {
    return jsonError(
      `Stored artifact media type mismatch: ${descriptor.filename}`,
      422
    )
  }

  const { data: signed, error: signedError } = await storage.createSignedUrl(
    storagePath,
    60
  )
  if (signedError || !signed) {
    return jsonError(
      signedError?.message ?? `Could not verify ${descriptor.filename}.`,
      500
    )
  }

  let response: Response
  try {
    response = await fetch(signed.signedUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4 * 60 * 1000),
    })
  } catch {
    return jsonError(
      `Could not download ${descriptor.filename} for verification.`,
      502
    )
  }

  if (!response.ok || !response.body) {
    return jsonError(
      `Could not download ${descriptor.filename} for verification.`,
      409
    )
  }

  const responseMediaType = response.headers.get("content-type")
  if (
    responseMediaType &&
    normalizeMediaType(responseMediaType) !== descriptor.mediaType
  ) {
    await response.body.cancel().catch(() => undefined)
    return jsonError(
      `Downloaded artifact media type mismatch: ${descriptor.filename}`,
      422
    )
  }

  const digest = createHash("sha256")
  const reader = response.body.getReader()
  let bytes = 0

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      bytes += value.byteLength
      if (
        bytes > descriptor.bytes ||
        bytes > maxTakeoffArtifactBytes
      ) {
        await reader.cancel()
        return jsonError(
          `Downloaded artifact size mismatch: ${descriptor.filename}`,
          422
        )
      }
      digest.update(value)
    }
  } catch {
    await reader.cancel().catch(() => undefined)
    return jsonError(
      `Could not stream ${descriptor.filename} for verification.`,
      502
    )
  }

  if (bytes !== descriptor.bytes) {
    return jsonError(
      `Downloaded artifact size mismatch: ${descriptor.filename}`,
      422
    )
  }
  if (digest.digest("hex") !== descriptor.sha256) {
    return jsonError(
      `Downloaded artifact SHA-256 mismatch: ${descriptor.filename}`,
      422
    )
  }

  return true
}

async function loadRegisteredRows(
  supabase: SupabaseAdmin,
  job: ClaimedJob,
  descriptors: TakeoffArtifactDescriptor[]
): Promise<TakeoffFileRow[] | Response> {
  const paths = descriptors.map((descriptor) =>
    artifactStoragePath(job, descriptor)
  )
  const { data, error } = await supabase
    .from("takeoff_files")
    .select("*")
    .eq("job_id", job.id)
    .eq("bucket", takeoffResultBucket)
    .in("storage_path", paths)

  if (error) return jsonError(error.message, 500)
  return (data ?? []) as TakeoffFileRow[]
}

async function guardProcessingClaim({
  supabase,
  job,
  workerId,
  claimToken,
  microserviceJobId,
}: {
  supabase: SupabaseAdmin
  job: ClaimedJob
  workerId: string
  claimToken: string
  microserviceJobId: string
}): Promise<Response | null> {
  const { data, error } = await supabase
    .from("takeoff_jobs")
    .update({ processor_job_id: microserviceJobId })
    .eq("id", job.id)
    .eq("user_id", job.user_id)
    .eq("claimed_by", workerId)
    .eq("claim_token", claimToken)
    .eq("status", "processing")
    .or(
      `processor_job_id.is.null,processor_job_id.eq.${microserviceJobId}`
    )
    .select("id")
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) {
    return jsonError(
      "The takeoff is no longer processing under this worker claim.",
      409
    )
  }
  return null
}

function artifactStoragePath(
  job: ClaimedJob,
  descriptor: TakeoffArtifactDescriptor
) {
  if (!job.claim_token) {
    throw new Error("The takeoff does not have an active claim token.")
  }
  return `${job.user_id}/${job.id}/results/${job.claim_token}/${descriptor.filename}`
}

function registeredRowMatches(
  row: TakeoffFileRow,
  job: ClaimedJob,
  descriptor: TakeoffArtifactDescriptor
) {
  return (
    row.job_id === job.id &&
    row.user_id === job.user_id &&
    row.bucket === takeoffResultBucket &&
    row.storage_path === artifactStoragePath(job, descriptor) &&
    row.original_filename === descriptor.filename &&
    row.file_role === takeoffArtifactRole(descriptor.filename) &&
    row.mime_type === descriptor.mediaType &&
    Number(row.size_bytes) === descriptor.bytes &&
    row.sha256?.toLowerCase() === descriptor.sha256 &&
    Boolean(row.verified_at)
  )
}

function parseMicroserviceJobId(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(value)
  ) {
    return null
  }
  return value
}

function normalizeMediaType(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase()
}
