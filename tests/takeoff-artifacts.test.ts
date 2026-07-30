import assert from "node:assert/strict"
import test from "node:test"
import {
  maxTakeoffArtifactBytes,
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

test("rejects duplicates, invalid hashes, and files over 100 MiB", () => {
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
  assert.equal(
    parseTakeoffArtifactDescriptors([
      { ...descriptor, bytes: maxTakeoffArtifactBytes + 1 },
    ]).success,
    false
  )
})
