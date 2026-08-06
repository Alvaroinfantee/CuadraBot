import "server-only"

import { requireAdmin } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const adminDocumentArchiveStatuses = [
  "retained",
  "legal_hold",
  "deletion_requested",
  "deleting",
  "missing",
  "deleted",
] as const

export type AdminDocumentArchiveStatus =
  (typeof adminDocumentArchiveStatuses)[number]

type DocumentArchiveRow = {
  id: string
  job_id: string
  user_id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  sha256: string
  page_count: number
  status: string
  integrity_status: string
  legal_hold_at: string | null
  legal_hold_reason: string | null
  legal_hold_by: string | null
  deletion_requested_at: string | null
  deletion_request_reason: string | null
  deletion_requested_by: string | null
  deletion_started_at: string | null
  deletion_approved_by: string | null
  archived_at: string
  last_verified_at: string
  last_check_attempt_at: string
  deleted_at: string | null
  deletion_reason: string | null
}

type ArchiveOwnerRow = {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
}

type ArchiveJobRow = {
  id: string
  project_name: string
  status: string
}

export type AdminDocumentArchive = DocumentArchiveRow & {
  customer_email: string | null
  customer_name: string | null
  project_name: string | null
  job_status: string | null
}

export type AdminDocumentArchiveSnapshot = {
  archives: AdminDocumentArchive[]
  counts: {
    total: number
    registered: number
    stored: number
    storageBytes: number
    protected: number
    legalHold: number
    deletionRequested: number
    missing: number
    overdueVerification: number
  }
  selectedStatus: AdminDocumentArchiveStatus | null
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
}

const archiveSelect =
  "id,job_id,user_id,original_filename,mime_type,size_bytes,sha256,page_count,status,integrity_status,legal_hold_at,legal_hold_reason,legal_hold_by,deletion_requested_at,deletion_request_reason,deletion_requested_by,deletion_started_at,deletion_approved_by,archived_at,last_verified_at,last_check_attempt_at,deleted_at,deletion_reason"

export async function getAdminDocumentArchives(
  requestedStatus?: string,
  requestedPage?: string
): Promise<AdminDocumentArchiveSnapshot> {
  await requireAdmin()

  const selectedStatus = adminDocumentArchiveStatuses.includes(
    requestedStatus as AdminDocumentArchiveStatus
  )
    ? (requestedStatus as AdminDocumentArchiveStatus)
    : null
  const supabase = createSupabaseAdminClient()
  const pageSize = 50
  const parsedPage = Number.parseInt(requestedPage ?? "1", 10)
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0
    ? parsedPage
    : 1
  const rangeFrom = (page - 1) * pageSize
  const verificationCutoff = new Date(
    Date.now() - 8 * 24 * 60 * 60 * 1_000
  ).toISOString()

  let archivesQuery = supabase
    .from("document_archives")
    .select(archiveSelect, { count: "exact" })
    .order("archived_at", { ascending: false })
  if (selectedStatus) {
    archivesQuery =
      selectedStatus === "missing"
        ? archivesQuery
            .eq("integrity_status", "missing")
            .neq("status", "deleted")
        : selectedStatus === "legal_hold"
          ? archivesQuery.not("legal_hold_at", "is", null)
          : archivesQuery.eq("status", selectedStatus)
  }
  archivesQuery = archivesQuery.range(
    rangeFrom,
    rangeFrom + pageSize - 1
  )

  const [archivesResult, metricsResult] = await Promise.all([
    archivesQuery,
    supabase.rpc("get_document_archive_metrics", {
      p_verification_before: verificationCutoff,
    }),
  ])

  const archiveError = archivesResult.error ?? metricsResult.error
  if (archiveError) {
    throw new Error(`Could not load the document archive: ${archiveError.message}`)
  }
  const metrics = asMetrics(metricsResult.data)
  const totalRows = archivesResult.count ?? 0

  const archives = (archivesResult.data ?? []) as DocumentArchiveRow[]
  const userIds = [...new Set(archives.map((archive) => archive.user_id))]
  const jobIds = [...new Set(archives.map((archive) => archive.job_id))]
  const [ownersResult, jobsResult] = await Promise.all([
    userIds.length
      ? supabase
          .from("profiles")
          .select("id,email,full_name,company_name")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? supabase
          .from("takeoff_jobs")
          .select("id,project_name,status")
          .in("id", jobIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (ownersResult.error || jobsResult.error) {
    throw new Error(
      `Could not load archive ownership: ${
        ownersResult.error?.message ??
        jobsResult.error?.message ??
        "Unknown error"
      }`
    )
  }

  const owners = new Map(
    ((ownersResult.data ?? []) as ArchiveOwnerRow[]).map((owner) => [
      owner.id,
      owner,
    ])
  )
  const jobs = new Map(
    ((jobsResult.data ?? []) as ArchiveJobRow[]).map((job) => [job.id, job])
  )

  return {
    archives: archives.map((archive) => {
      const owner = owners.get(archive.user_id)
      const job = jobs.get(archive.job_id)
      return {
        ...archive,
        customer_email: owner?.email ?? null,
        customer_name:
          owner?.company_name ?? owner?.full_name ?? owner?.email ?? null,
        project_name: job?.project_name ?? null,
        job_status: job?.status ?? null,
      }
    }),
    counts: {
      total: metrics.total,
      registered: metrics.registered,
      stored: metrics.stored,
      storageBytes: metrics.storageBytes,
      protected: metrics.protected,
      legalHold: metrics.legalHold,
      deletionRequested: metrics.deletionRequested,
      missing: metrics.missing,
      overdueVerification: metrics.overdueVerification,
    },
    selectedStatus,
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    },
  }
}

export async function getAdminDocumentArchive(
  archiveId: string
): Promise<AdminDocumentArchive | null> {
  await requireAdmin()
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("document_archives")
    .select(archiveSelect)
    .eq("id", archiveId)
    .maybeSingle()
  if (error) {
    throw new Error(`Could not load the document archive: ${error.message}`)
  }
  if (!data) return null

  const archive = data as DocumentArchiveRow
  const [ownerResult, jobResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,email,full_name,company_name")
      .eq("id", archive.user_id)
      .maybeSingle(),
    supabase
      .from("takeoff_jobs")
      .select("id,project_name,status")
      .eq("id", archive.job_id)
      .maybeSingle(),
  ])
  if (ownerResult.error || jobResult.error) {
    throw new Error(
      `Could not load archive ownership: ${
        ownerResult.error?.message ??
        jobResult.error?.message ??
        "Unknown error"
      }`
    )
  }
  const owner = ownerResult.data as ArchiveOwnerRow | null
  const job = jobResult.data as ArchiveJobRow | null
  return {
    ...archive,
    customer_email: owner?.email ?? null,
    customer_name:
      owner?.company_name ?? owner?.full_name ?? owner?.email ?? null,
    project_name: job?.project_name ?? null,
    job_status: job?.status ?? null,
  }
}

function asMetrics(value: unknown) {
  const metrics =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {}
  return {
    total: nonNegativeNumber(metrics.total),
    registered: nonNegativeNumber(metrics.registered),
    stored: nonNegativeNumber(metrics.stored),
    storageBytes: nonNegativeNumber(metrics.storageBytes),
    protected: nonNegativeNumber(metrics.protected),
    legalHold: nonNegativeNumber(metrics.legalHold),
    deletionRequested: nonNegativeNumber(metrics.deletionRequested),
    missing: nonNegativeNumber(metrics.missing),
    overdueVerification: nonNegativeNumber(metrics.overdueVerification),
  }
}

function nonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0
}
