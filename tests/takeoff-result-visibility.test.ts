import assert from "node:assert/strict"
import test from "node:test"
import { isCurrentCustomerFile } from "../src/lib/takeoff-result-visibility"
import type { TakeoffFile, TakeoffJob } from "../src/lib/takeoff-types"

const job = {
  id: "job-1",
  user_id: "user-1",
  claim_token: "current-claim",
} as TakeoffJob

function file(
  fileRole: TakeoffFile["file_role"],
  storagePath: string
): TakeoffFile {
  return {
    id: crypto.randomUUID(),
    job_id: job.id,
    user_id: job.user_id,
    file_role: fileRole,
    bucket: "takeoff-results",
    storage_path: storagePath,
    original_filename: "takeoff.xlsx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size_bytes: 100,
    sha256: "ab".repeat(32),
    created_at: new Date(0).toISOString(),
  }
}

test("customer visibility keeps source input and only the current result attempt", () => {
  assert.equal(
    isCurrentCustomerFile(
      job,
      file("input", `${job.user_id}/${job.id}/source.pdf`)
    ),
    true
  )
  assert.equal(
    isCurrentCustomerFile(
      job,
      file(
        "result",
        `${job.user_id}/${job.id}/results/${job.claim_token}/takeoff.xlsx`
      )
    ),
    true
  )
  assert.equal(
    isCurrentCustomerFile(
      job,
      file(
        "result",
        `${job.user_id}/${job.id}/results/old-claim/takeoff.xlsx`
      )
    ),
    false
  )
})

test("no result is customer-visible while a rework has no active claim", () => {
  assert.equal(
    isCurrentCustomerFile(
      { ...job, claim_token: null },
      file(
        "result",
        `${job.user_id}/${job.id}/results/current-claim/takeoff.xlsx`
      )
    ),
    false
  )
})
