import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8")
}

const component = read("src/components/site/product-demo-video.tsx")

test("the production landing publishes inspectable PDF and workbook samples", () => {
  const landing = read("src/components/takeoff/takeoff-landing.tsx")
  assert.match(read("src/app/page.tsx"), /<TakeoffLanding\s+locale="es"\s*\/>/)
  assert.match(read("src/app/es/page.tsx"), /<TakeoffLanding\s+locale="es"\s*\/>/)
  assert.match(read("src/app/en/page.tsx"), /<TakeoffLanding\s+locale="en"\s*\/>/)
  assert.match(landing, /cuadrabot-plano-original-muestra\.pdf/)
  assert.match(landing, /cuadrabot-plano-marcado-muestra\.pdf/)
  assert.match(landing, /cuadrabot-mediciones-muestra\.xlsx/)
})

test("the walkthrough uses accessible, browser-compatible video controls", () => {
  assert.match(component, /controls/)
  assert.match(component, /muted/)
  assert.match(component, /playsInline/)
  assert.match(component, /preload="metadata"/)
  assert.match(component, /aria-label=\{copy\.label\}/)
  assert.match(component, /aria-describedby=\{transcriptId\}/)
  assert.match(component, /type="video\/mp4"/)
})

test("the committed video and poster assets are present and non-empty", () => {
  for (const relativePath of [
    "public/media/cuadrabot-blueprint-takeoff-demo.mp4",
    "public/media/cuadrabot-blueprint-takeoff-demo-poster.jpg",
  ]) {
    const absolutePath = path.join(root, relativePath)
    assert.equal(existsSync(absolutePath), true, `${relativePath} is missing`)
    assert.ok(statSync(absolutePath).size > 10_000, `${relativePath} is empty`)
  }
})

test("the public copy discloses redaction and compressed processing time", () => {
  assert.match(component, /Sensitive project details are redacted/)
  assert.match(component, /processing time is compressed/)
  assert.match(component, /Los datos sensibles están ocultos/)
  assert.match(component, /tiempo de procesamiento está abreviado/)
})
