import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  customerTakeoffDeliverableFilenames,
  isCustomerTakeoffDeliverableFilename,
  maxTakeoffArtifactBytes,
  maxTakeoffArtifactBytesByFilename,
  parseTakeoffArtifactDescriptors,
} from "../src/lib/takeoff-artifacts"

const sha256 = "ab".repeat(32)

test("accepts an allowed takeoff artifact descriptor", () => {
  const result = parseTakeoffArtifactDescriptors([
    {
      filename: "annotated_drawings.pdf",
      mediaType: "application/pdf",
      bytes: 42,
      sha256: sha256.toUpperCase(),
    },
  ])

  assert.equal(result.success, true)
  if (result.success) assert.equal(result.data[0]?.sha256, sha256)
})

test("rejects unknown filenames and media type substitutions", () => {
  const unknown = parseTakeoffArtifactDescriptors([
    {
      filename: "../takeoff.json",
      mediaType: "application/json",
      bytes: 42,
      sha256,
    },
  ])
  const wrongType = parseTakeoffArtifactDescriptors([
    {
      filename: "takeoff.xlsx",
      mediaType: "application/octet-stream",
      bytes: 42,
      sha256,
    },
  ])

  assert.equal(unknown.success, false)
  assert.equal(wrongType.success, false)
})

test("rejects duplicates and invalid hashes", () => {
  const descriptor = {
    filename: "takeoff.json",
    mediaType: "application/json",
    bytes: 42,
    sha256,
  }

  assert.equal(
    parseTakeoffArtifactDescriptors([descriptor, descriptor]).success,
    false
  )
  assert.equal(
    parseTakeoffArtifactDescriptors([{ ...descriptor, sha256: "bad" }])
      .success,
    false
  )
})

test("applies format-specific artifact limits within the 250 MiB route cap", () => {
  assert.equal(maxTakeoffArtifactBytes, 250 * 1024 * 1024)

  const cases = [
    {
      filename: "annotated_drawings.pdf",
      mediaType: "application/pdf",
      limit: 250 * 1024 * 1024,
    },
    {
      filename: "takeoff.xlsx",
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      limit: 100 * 1024 * 1024,
    },
    {
      filename: "takeoff.json",
      mediaType: "application/json",
      limit: 50 * 1024 * 1024,
    },
  ] as const

  for (const artifact of cases) {
    assert.equal(
      maxTakeoffArtifactBytesByFilename[artifact.filename],
      artifact.limit
    )
    assert.equal(
      parseTakeoffArtifactDescriptors([
        {
          filename: artifact.filename,
          mediaType: artifact.mediaType,
          bytes: artifact.limit,
          sha256,
        },
      ]).success,
      true
    )
    assert.equal(
      parseTakeoffArtifactDescriptors([
        {
          filename: artifact.filename,
          mediaType: artifact.mediaType,
          bytes: artifact.limit + 1,
          sha256,
        },
      ]).success,
      false
    )
  }
})

test("exposes only the annotated PDF and count workbook as customer deliverables", () => {
  assert.deepEqual(customerTakeoffDeliverableFilenames, [
    "annotated_drawings.pdf",
    "takeoff.xlsx",
  ])
  assert.equal(
    isCustomerTakeoffDeliverableFilename("annotated_drawings.pdf"),
    true
  )
  assert.equal(isCustomerTakeoffDeliverableFilename("takeoff.xlsx"), true)
  assert.equal(isCustomerTakeoffDeliverableFilename("takeoff.json"), false)
  assert.equal(
    isCustomerTakeoffDeliverableFilename("annotation_audit.json"),
    false
  )
})

test("database completion requires both verified primary deliverables", async () => {
  const migration = await readFile(
    fileURLToPath(
      new URL(
        "../supabase/migrations/20260729153834_takeoff_self_serve_saas.sql",
        import.meta.url
      )
    ),
    "utf8"
  )
  const functionStart = migration.indexOf(
    "create or replace function public.complete_takeoff_job("
  )
  const functionEnd = migration.indexOf("\n$$;", functionStart)
  const completionFunction = migration.slice(functionStart, functionEnd)

  assert.ok(functionStart >= 0 && functionEnd > functionStart)
  assert.match(completionFunction, /original_filename = 'annotated_drawings\.pdf'/)
  assert.match(completionFunction, /original_filename = 'takeoff\.xlsx'/)
  assert.match(completionFunction, /verified_at is not null/)
  assert.match(completionFunction, /job\.claim_token::text/)
})
