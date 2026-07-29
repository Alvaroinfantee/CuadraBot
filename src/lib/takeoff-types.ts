export const takeoffTrades = [
  "flooring_finishes",
  "drywall_partitions_ceilings",
  "doors_windows_openings",
] as const

export type TakeoffTrade = (typeof takeoffTrades)[number]

export const takeoffJobStatuses = [
  "draft",
  "awaiting_upload",
  "ready",
  "queued",
  "processing",
  "needs_review",
  "completed",
  "failed",
  "canceled",
] as const

export type TakeoffJobStatus = (typeof takeoffJobStatuses)[number]

export const takeoffFileKinds = [
  "input",
  "result",
  "manifest",
  "preview",
  "log",
] as const

export type TakeoffFileKind = (typeof takeoffFileKinds)[number]

export type TakeoffJob = {
  id: string
  user_id: string
  project_name: string
  status: TakeoffJobStatus
  trades: TakeoffTrade[]
  customer_notes: string | null
  input_page_count: number | null
  sample_page: number | null
  quoted_credits: number
  reserved_credits: number
  consumed_credits: number
  free_sample: boolean
  progress: number
  stage: string | null
  due_at: string | null
  instructions: string | null
  qa_notes: string | null
  claimed_by: string | null
  claim_token: string | null
  processor_job_id: string | null
  failure_code: string | null
  failure_message: string | null
  result_summary: Record<string, unknown>
  queued_at: string | null
  processing_started_at: string | null
  completed_at: string | null
  project_files_retention_at: string | null
  project_files_purged_at: string | null
  project_files_purge_token: string | null
  project_files_purge_started_at: string | null
  project_files_purge_expires_at: string | null
  upload_cleanup_completed_at: string | null
  created_at: string
  updated_at: string
}

export type TakeoffFile = {
  id: string
  job_id: string
  user_id: string
  file_role: TakeoffFileKind
  bucket: string
  storage_path: string
  original_filename: string
  mime_type: string
  size_bytes: number | null
  sha256: string | null
  created_at: string
}

export type DocumentArchive = {
  id: string
  job_id: string
  user_id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  sha256: string
  page_count: number
  status:
    | "retained"
    | "deletion_requested"
    | "deleting"
    | "deleted"
  integrity_status: "verified" | "missing"
  archived_at: string
  last_verified_at: string
  last_check_attempt_at: string
  deleted_at: string | null
}

export type CreditAccount = {
  user_id: string
  balance: number
  lifetime_granted: number
  lifetime_consumed: number
  updated_at: string
}

export const tradeLabels: Record<TakeoffTrade, string> = {
  flooring_finishes: "Flooring & finishes",
  drywall_partitions_ceilings: "Drywall, partitions & ceilings",
  doors_windows_openings: "Doors, windows & openings",
}
