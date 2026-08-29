import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  drywallCheckoutSchema,
  drywallDraftSchema,
} from "../src/lib/drywall-takeoff-schemas"

const read = (path: string) => readFileSync(path, "utf8")
const checksum = "a".repeat(64)

test("drywall drafts enforce PDF metadata, file count and aggregate size", () => {
  const base = {
    email: "buyer@example.es",
    projectName: "Reforma oficinas",
    location: "Madrid",
    projectType: "oficinas",
    files: [{ filename: "planos.pdf", mimeType: "application/pdf", sizeBytes: 1024, checksum, pageCount: 20 }],
  }
  assert.equal(drywallDraftSchema.safeParse(base).success, true)
  assert.equal(drywallDraftSchema.safeParse({ ...base, files: [{ ...base.files[0], mimeType: "image/png" }] }).success, false)
  assert.equal(drywallDraftSchema.safeParse({ ...base, files: Array.from({ length: 11 }, (_, index) => ({ ...base.files[0], filename: `${index}.pdf` })) }).success, false)
  assert.equal(drywallDraftSchema.safeParse({ ...base, files: [{ ...base.files[0], sizeBytes: 300 * 1024 * 1024 }, { ...base.files[0], filename: "b.pdf", sizeBytes: 300 * 1024 * 1024 }] }).success, false)
})

test("checkout requires explicit scope and upload authority", () => {
  const checkout = {
    accessToken: "x".repeat(43),
    acceptedScope: true,
    uploadAuthority: true,
    selectedPages: [{ fileId: "11111111-1111-4111-8111-111111111111", pageNumbers: [1] }],
    scope: { partitions: "si", ceilings: "si", wallSchedules: "si", reflectedCeilings: "si", visibleScale: "si", defaultHeight: "2.70", deductOpenings: "si", supersededDrawings: "", excludedAreas: "", estimatorNotes: "" },
  }
  assert.equal(drywallCheckoutSchema.safeParse(checkout).success, true)
  assert.equal(drywallCheckoutSchema.safeParse({ ...checkout, acceptedScope: false }).success, false)
  assert.equal(drywallCheckoutSchema.safeParse({ ...checkout, uploadAuthority: false }).success, false)
})

test("drywall storage and tables are private and service mediated", () => {
  const migration = read("supabase/migrations/20260829140932_drywall_guest_checkout.sql")
  for (const table of ["customers", "projects", "files", "orders", "deliverables", "events", "revision_requests"]) {
    assert.match(migration, new RegExp(`alter table public\\.drywall_takeoff_${table} enable row level security`))
    assert.match(migration, new RegExp(`revoke all on table public\\.drywall_takeoff_${table} from anon, authenticated`))
  }
  assert.match(migration, /'drywall-customer-files'[\s\S]*false/)
  assert.match(migration, /'drywall-deliverables'[\s\S]*false/)
  assert.match(migration, /legal_hold boolean not null default false/)
})

test("paid orders require a verified Stripe webhook and verified ad return", () => {
  const webhook = read("src/app/api/stripe/webhook/route.ts")
  const checkout = read("src/app/api/drywall/orders/[id]/checkout/route.ts")
  const conversion = read("src/lib/drywall-conversion.ts")
  assert.match(webhook, /stripe\.webhooks\.constructEvent/)
  assert.match(webhook, /\.in\("payment_status", \["unpaid", "checkout_created"\]\)/)
  assert.match(checkout, /price\.unit_amount !== 14900/)
  assert.match(checkout, /integration_identifier:/)
  assert.doesNotMatch(checkout, /payment_method_types:/)
  assert.match(conversion, /session\.status === "complete"/)
  assert.match(conversion, /session\.payment_status === "paid"/)
  assert.match(conversion, /session\.amount_subtotal === 14900/)
})

test("delivery and retention repeat security checks on the server", () => {
  const delivery = read("src/app/api/admin/drywall/[id]/deliverables/route.ts")
  const retention = read("src/app/api/internal/cron/retention/route.ts")
  assert.match(delivery, /createHash\("sha256"\)/)
  assert.match(delivery, /signature !== "25504446"/)
  assert.match(delivery, /!signature\.startsWith\("504b03"\)/)
  assert.match(delivery, /qaConfirmed: z\.literal\(true\)/)
  assert.match(delivery, /assumptionsConfirmed: z\.literal\(true\)/)
  assert.match(retention, /\.eq\("legal_hold", false\)/)
  assert.match(retention, /files_retention_completed/)
})
