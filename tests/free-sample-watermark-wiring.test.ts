import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

test("the trusted application propagates the server-owned free-sample flag", () => {
  const inputRoute = read(
    "src/app/api/internal/worker/takeoff/jobs/[id]/input/route.ts"
  )
  const workerApi = read("worker/src/api.ts")
  const worker = read("worker/src/index.ts")
  const submission = read("worker/src/takeoff.ts")

  assert.match(inputRoute, /free_sample:\s*job\.free_sample/)
  assert.match(workerApi, /free_sample:\s*boolean/)
  assert.match(worker, /freeSample:\s*input\.job\.free_sample === true/)
  assert.match(
    submission,
    /form\.append\("freeSample", freeSample \? "true" : "false"\)/
  )
})
