import type { TakeoffFile, TakeoffJob } from "@/lib/takeoff-types"

export function isCurrentCustomerFile(
  job: TakeoffJob | null,
  file: TakeoffFile
) {
  if (file.file_role === "input") return true
  if (!job?.claim_token) return false

  return file.storage_path.startsWith(
    `${job.user_id}/${job.id}/results/${job.claim_token}/`
  )
}
