# Cuadrabot drywall takeoff — production blueprint

Version: 2026-08-29
Product policy: `PLADUR-ES-1.0`
Launch market: Spain · Spanish and English · metric · drywall/plasterboard only

## Release decision

The application code is production-built and the local browser acceptance pass is green. The launch remains **externally gated** until the live Stripe and DigitalOcean sessions are connected, the Stripe product/webhook and deployment secrets are installed, the legal business identity is filled in, and one safe end-to-end payment test succeeds.

Do not start the first €100 Google Ads campaign before every mandatory gate in the readiness matrix is green.

## Preserved production and rollback

The pre-release production commit is preserved at Git commit `1aa8b228a3e1cec6f09e6daa3cec5e9f80bfa266` in both:

- branch `archive/pre-drywall-product-20260829`;
- annotated tag `archive-pre-drywall-product-20260829`.

The new release is developed on `codex/drywall-takeoff-prod-20260829`. The database migration is additive: it creates new `drywall_takeoff_*` tables and two private buckets without modifying the legacy order/takeoff tables.

Rollback procedure:

1. Point DigitalOcean back to the archived tag/commit or revert the release commit on `main`.
2. Redeploy and verify `/api/health`, `/`, login and the existing dashboard.
3. Leave the additive drywall tables and private objects intact for audit/recovery; do not drop them during an application rollback.
4. Disable the drywall Stripe Price or remove `STRIPE_PRICE_DRYWALL_TAKEOFF` to stop new fixed-price checkouts.
5. Keep the webhook endpoint active until any open Checkout Sessions and refunds are reconciled.

## Product contract

The fixed product is `149 EUR + applicable VAT` for:

- one project and up to ten PDF files / 500 MB total;
- up to 20 customer-selected sheets;
- drywall partitions and gypsum-board ceilings when relevant plans exist;
- one traceable XLSX quantity workbook;
- one color-marked PDF;
- documented assumptions/exclusions and one correction on the original plan revision;
- delivery within two business days after paid, complete information is received.

Hospitals, airports, major industrial projects and selections above 20 sheets are routed to a no-charge custom review. The fixed product cannot be purchased for those projects.

## Implemented architecture

```text
Spanish or English customer
  │
  ├─ / · /en        localized offer, scope, samples, consent and attribution
  ├─ /pedido · /en/order
  │                 passwordless draft, private direct upload, scope, Checkout
  └─ /portal/:id    verified payment return, status, signed downloads, correction
          │
          ▼
Next.js 16 application on DigitalOcean
  ├─ bounded/rate-limited public APIs
  ├─ server-side PDF verification through qpdf
  ├─ Stripe Checkout + signed/idempotent webhook inbox
  ├─ Google Ads purchase conversion after server verification
  └─ Supabase-authenticated /admin/drywall operations and QA
          │
          ├─ Supabase Postgres: service-only drywall tables with RLS
          ├─ Supabase Storage: private source and deliverable buckets
          ├─ Stripe: one-time EUR Price, tax IDs, invoices, receipts
          └─ Resend: payment and delivery emails (when configured)

Operator
  ├─ uses the signed-in Codex desktop app as the AI workspace assistant
  ├─ downloads exact private source files
  ├─ completes/reviews the takeoff
  └─ publishes PDF + XLSX only after the 16-check QA gate
```

There is no OpenAI API integration in the new fixed-price customer flow. Codex is an operator-side tool using the owner’s existing Codex account, as requested.

## Production surfaces

| Surface | Route | Production behavior |
|---|---|---|
| Acquisition landing | `/` and `/en` | Reciprocal Spanish/English pages; Spanish x-default, Google Ads consent/attribution, sample PDF/XLSX downloads |
| Order | `/pedido` and `/en/order` | Localized passwordless project, browser checksum/page inspection, signed direct upload, server qpdf verification |
| Checkout | `/api/drywall/orders/:id/checkout` | Enforces verified files, exact scope and active one-time `14900 EUR` tax-exclusive Stripe Price |
| Webhook | `/api/stripe/webhook` | Signature verification, event inbox/idempotency, payment/refund state, deadlines and email notifications |
| Customer portal | `/portal/:id` | Access only through a verified paid Checkout return or expiring HMAC link |
| Downloads | `/api/drywall/orders/:id/deliverables/:fileId` | Project ownership check plus five-minute signed Storage URL |
| Correction | `/api/drywall/orders/:id/revision` | One open correction, structured drawing/page/area/measurement evidence |
| Operations list | `/admin/drywall` | Paid queue, deadlines and captured revenue |
| Operations detail | `/admin/drywall/:id` | Audited source access, status transitions, corrections and delivery history |
| Delivery gate | `/api/admin/drywall/:id/deliverables` | Admin auth, direct private upload, server size/SHA/signature verification, reviewer + 16 QA checks |

## Data and access controls

Migration: `supabase/migrations/20260829140932_drywall_guest_checkout.sql`.

Tables: `drywall_takeoff_customers`, `drywall_takeoff_projects`, `drywall_takeoff_files`, `drywall_takeoff_orders`, `drywall_takeoff_deliverables`, `drywall_takeoff_events`, and `drywall_takeoff_revision_requests`.

Each project stores a validated `es|en` customer locale used by Stripe Checkout, the private portal, correction workflow and transactional customer email. Existing projects default safely to Spanish.

Every table has RLS enabled. `anon` and `authenticated` have no direct table rights; public/customer access is mediated by bounded server routes using the service role. Buckets `drywall-customer-files` and `drywall-deliverables` are private, MIME-limited and capped at 500 MB per object.

The browser never receives the Supabase service key. Draft access uses a random 256-bit token stored only as an HMAC in Postgres. Portal links are project-bound HMAC capabilities with a 120-day expiry. Download URLs expire after five minutes.

## Payment invariants

- Checkout uses Stripe-hosted payment UI and dynamic payment methods; card details never enter Cuadrabot.
- The configured Price must be active, one-time, EUR 149.00 and tax-exclusive.
- Automatic Tax is enabled only when `STRIPE_AUTOMATIC_TAX_ENABLED=true` after an active tax registration is confirmed.
- Checkout, PaymentIntent and invoice metadata all bind the Stripe objects to one Cuadrabot order/project.
- A project becomes paid only from a signature-verified Stripe webhook.
- The first conditional `unpaid|checkout_created → paid` update owns confirmation emails; duplicate events do not redeliver.
- Checkout return conversion tracking re-fetches Stripe and verifies status, payment, mode, project/order metadata, currency and amount.
- Full refunds close the order/project; partial or failed refunds create an admin alert.
- Stripe events are stored in the existing idempotent `stripe_events` inbox.

## Delivery invariants

The server refuses delivery unless:

- exactly one marked PDF and one XLSX exist for the same version;
- each object matches the browser-declared byte size and SHA-256;
- the PDF begins with the PDF signature and the XLSX with the ZIP container signature;
- a named admin reviewer is authenticated;
- all sixteen QA checks and the assumptions confirmation are true;
- Stripe payment is `paid` and the project is not refunded/cancelled.

Deliverables are versioned and never overwrite a published version. Source downloads, workflow changes, delivery and correction events are recorded. The default deletion date is 90 days after delivery.

## Required environment

Existing Supabase, admin, rate-limit, worker and Google Ads variables remain required. The fixed-price flow additionally requires:

```text
DRYWALL_UPLOAD_BUCKET=drywall-customer-files
DRYWALL_RESULT_BUCKET=drywall-deliverables
DRYWALL_MAX_UPLOAD_MB=500
DRYWALL_MAX_FILES=10
DRYWALL_MAX_SELECTED_PAGES=20
DRYWALL_PORTAL_SECRET=<random secret, at least 32 characters>
STRIPE_PRICE_DRYWALL_TAKEOFF=<one-time Price ID>
STRIPE_SECRET_KEY=<restricted server key where supported>
STRIPE_WEBHOOK_SECRET=<endpoint signing secret>
STRIPE_AUTOMATIC_TAX_ENABLED=false|true
RESEND_API_KEY=<server secret>
FROM_EMAIL=Cuadrabot <pedidos@cuadrabot.com>
NEXT_PUBLIC_SITE_URL=https://cuadrabot.com
```

## Readiness matrix

| Area | Evidence | State |
|---|---|---|
| Legacy preservation | Remote archive branch + annotated tag at the pre-release SHA | Ready |
| Production compilation | Next.js optimized build and TypeScript complete | Ready |
| Automated checks | 168 passing app tests, 34 passing executor tests, lint clean, one intentional qpdf native skip | Ready |
| Dependency security | `npm audit --omit=dev` reports zero vulnerabilities | Ready |
| Browser UX | 1440 px landing/order run; no console errors; screenshots captured | Ready |
| Database DDL | Additive migration applied to production; tables, RLS, private buckets and legal-hold column verified | Ready |
| Stripe account | Current connector/browser session requires sign-in | Blocked externally |
| Stripe product/webhook | Requires authenticated account selection and live/test configuration | Blocked externally |
| DigitalOcean deployment | Requires authenticated dashboard session and environment update | Blocked externally |
| Transactional email | Code is ready; sending domain/key must be verified in production | Blocked externally |
| Legal identity | Draft policies exist; controller/company name, tax ID and address require owner/counsel approval | Mandatory owner input |
| Real payment acceptance | Must complete one Stripe test-mode purchase and webhook/portal/delivery check | Mandatory final gate |
| Google Ads €100 campaign | Purchase conversion code is present; verify it in the deployed paid return | Do not launch yet |

## Final acceptance runbook

1. Sign in to Stripe and DigitalOcean in the prepared browser tabs.
2. Confirm the Stripe account and whether an active Spanish tax registration exists.
3. Create the one-time tax-exclusive EUR 149.00 Product/Price and restricted server key.
4. Create/update `https://cuadrabot.com/api/stripe/webhook` with Checkout, refund, dispute and existing billing events.
5. Apply the additive Supabase migration; verify RLS, bucket privacy and advisors.
6. Add the required secrets/variables to DigitalOcean without exposing their values in logs.
7. Merge the release to `main`; watch the DigitalOcean build and health check.
8. Smoke-test `/`, `/en`, samples, consent, `/pedido`, `/en/order`, custom-review branches and reciprocal legal routes.
9. In Stripe test mode, upload a safe PDF, pay, verify one order/event/email, open the portal, publish both deliverables, download them and request the included correction.
10. Verify the Google Ads `purchase` conversion uses the Stripe Checkout Session ID and exact paid total once.
11. Fill and approve the legal business identity and sender domain.
12. Only after the checklist is green, prepare the separate €100 Google Ads campaign.

## Deferred from launch

OCR, automatic wall recognition, automatic scale inference, a browser measurement editor, material assemblies, other trades, subscriptions, team accounts, English/imperial support, a public API and an embedded AI chatbot are not launch dependencies.
