import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { safeRelativePath } from "../src/lib/safe-redirect"

describe("safeRelativePath", () => {
  it("keeps normal application-relative paths", () => {
    assert.equal(
      safeRelativePath("/dashboard/jobs/123?tab=files#results"),
      "/dashboard/jobs/123?tab=files#results"
    )
  })

  it("rejects absolute, scheme-relative, and backslash redirects", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
    ]) {
      assert.equal(safeRelativePath(value), "/dashboard")
    }
  })

  it("rejects encoded separators and control characters", () => {
    for (const value of [
      "/%2f%2fevil.example",
      "/%5cevil.example",
      "/dashboard%0d%0aLocation:%20https://evil.example",
      "/dashboard\u0000",
    ]) {
      assert.equal(safeRelativePath(value), "/dashboard")
    }
  })
})
