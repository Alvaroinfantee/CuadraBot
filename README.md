# Cuadrabot

Self-serve, takeoff-only construction SaaS. Customers create an account,
upload PDF plans with a readable legend, approve a server-verified fixed
credit quote, and receive a validated annotated PDF plus source-linked
quantities in hours.

The repository contains three deployable processes:

- `src/`: Next.js 16 application, Supabase Auth/Postgres/Storage, Stripe
  Checkout and Billing Portal, customer workspace, and admin control panel.
- `worker/`: private Node worker that claims queued jobs and bridges the app to
  the processor.
- `services/takeoff/`: private FastAPI processor vendored from the supplied
  workflow package.

## Product boundaries

Launch self-serve scopes mirror the processor's two capabilities:

- fixture and installed-device counts defined by a readable legend or
  schedule, including electrical and lighting fixtures;
- cable and conduit runs where the route is visible and the plan states a
  usable scale.

The legend is used as the item catalog. Legend samples, schedule rows, key
plans, and repeated reference views are excluded from installed-placement
totals. Unresolved or ambiguous codes and routes are reported as limitations
rather than guessed. Historical jobs retain their legacy scope identifiers for
display and audit continuity. Obsolete flooring, drywall, and opening jobs fail
closed instead of being reinterpreted by the fixture processor; new customer
jobs can select only the two processor-distinct scopes above.

Successful processing validates the required artifacts, settles reserved
credits, and releases deliverables automatically. `needs_review` is reserved
for customer correction requests and operational exceptions.
Cuadrabot supports takeoff review and does not provide engineering,
architectural, permit, cost, or final-bid advice.

## Local preview

Requirements:

- Node.js 22 or later;
- npm;
- Python 3.11+ for the processor;
- Docker for the production-like processor image;
- a Supabase project for real account/job testing;
- a Stripe Sandbox for real billing testing.

Install and run the public site plus safe sample-data previews:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open:

- `http://localhost:3000/` — public website;
- `http://localhost:3000/demo` — no-write launch preview;
- `http://localhost:3000/demo/new` — local-file quote-flow preview;
- `http://localhost:3000/demo/admin` — sample admin control panel.

Demo pages are enabled automatically in development. In production they return
404 unless `ENABLE_DEMO_MODE=true`.

## Supabase

The connected project is expected to use the preferred publishable/secret key
names shown in `.env.example`; legacy anon/service-role keys remain supported
during the Supabase key transition.

Apply migrations in order:

```bash
npx supabase@latest db push
```

The takeoff SaaS migration creates:

- account/company fields and automatic credit accounts;
- billing catalog, subscriptions, durable billing orders, and Stripe events;
- immutable credit ledger and atomic grant/reserve/settle/release RPCs;
- takeoff jobs, files, events, private buckets, and worker claim RPC;
- one-company free-sample race protection;
- database-backed request limits, three-outstanding-upload cap, and automatic
  24-hour cleanup for abandoned unqueued uploads;
- a private, checksum-backed registry that retains every verified original
  plan, including the full source behind a one-page free sample;
- a 30-day launch default for generated/working files, configurable from
  Admin → Settings with fail-closed cleanup that excludes archived originals;
- a bounded daily source-object presence check with admin health and alerts;
- analytics events, admin alerts, settings, service health, and audit log;
- explicit grants and tenant RLS policies.

Promote the first operator after signup:

```sql
update public.profiles
set role = 'admin'
where email = 'owner@example.com';
```

Do not expose `SUPABASE_SECRET_KEY` to the browser.

For local or dedicated-sandbox acceptance testing, Cuadrabot includes an
explicit, idempotent test-account bootstrap. It creates a primary admin and a
Spanish customer, can add a second admin for dual-control archive deletion,
and tops up the customer through the audited credit RPC:

```bash
npm run test:accounts:provision
```

Credentials are read from the ignored `.env.local` file and are never printed
or committed. The command refuses production and requires an explicit,
project-ref-matched approval before it can target remote Supabase. See
[`docs/TEST_ACCOUNTS.md`](docs/TEST_ACCOUNTS.md) for setup and verification.

## Stripe Sandbox

Create six Products/Prices with the exact USD amounts from the catalog, then
set:

```text
STRIPE_PRICE_CREDITS_550
STRIPE_PRICE_CREDITS_1800
STRIPE_PRICE_CREDITS_5000
STRIPE_PRICE_SOLO_MONTHLY
STRIPE_PRICE_TEAM_MONTHLY
STRIPE_PRICE_OFFICE_MONTHLY
```

After deploying those variables, open Admin → Billing and run
**Validate & sync Stripe**. Cuadrabot retrieves all six Prices from Stripe,
checks amount, currency, one-time/recurring shape, and interval, then updates
the database catalog and writes one admin audit entry. Checkout stays closed
for any plan whose database Price does not match the validated server catalog.

Configure `/api/stripe/webhook` on API version `2026-04-22.dahlia`, using the
event allowlist documented in `docs/LAUNCH_CHECKLIST.md`. Enable the default
Customer Portal configuration for payment methods, invoices, billing address,
tax IDs, and cancellation at period end. Plan switching is intentionally off
for launch.

Only signed webhooks grant credits. Checkout redirects never grant
entitlements. Launch credits do not expire; adding expiry later requires
lot-aware consumption and a prospective policy change.

## Takeoff processor and worker

For local integration and single-tenant staging, build and run the private
processor:

```bash
docker build -t cuadrabot-takeoff services/takeoff
docker run --rm -p 127.0.0.1:8000:8000 \
  -e TAKEOFF_SERVICE_API_TOKEN=replace-me \
  -v cuadrabot-takeoff-data:/data \
  cuadrabot-takeoff
```

Copy `.env.worker.example` to `.env.worker`, populate every secret, then:

```bash
npm run worker
```

The worker uses a server-owned OpenAI API key. Customers never provide a model
key and the browser never receives the processor URL or either bearer secret.

Multi-tenant production additionally requires a trusted execution broker that
launches each customer job in a disposable container or VM with a unique
non-root identity, PID/mount namespace, encrypted job-only volume, restricted
egress, and CPU/memory/process limits. It must inject a single-use or narrowly
scoped model credential for that job, revoke it when the runtime is destroyed,
and keep the credential out of model-invoked tools. The included long-lived
processor plus direct `CODEX_API_KEY` worker mode is for local or controlled
staging only; it is not the production isolation boundary. See
[`services/takeoff/README.md`](services/takeoff/README.md#mandatory-production-isolation-gate).

## Reconciliation and health

- `GET /api/health` checks the web process and database.
- `/api/internal/cron/reconcile` requeues stale worker claims and releases
  credits after retry exhaustion. Schedule it every 10 minutes with
  `Authorization: Bearer $CRON_SECRET`.
- `/api/internal/cron/retention` removes exact, tracked Storage objects and then
  their `takeoff_files` metadata for old `completed`, `failed`, and `canceled`
  jobs, but excludes every exact path protected by `document_archives`. Vercel
  invokes it with `GET` daily at `03:15 UTC`; authenticated manual runs may use
  `GET` or `POST`. An atomic job lease prevents correction or requeue
  transitions from racing external Storage deletion. It never deletes verified
  originals, job history, billing, credit-ledger, analytics, or audit records.
- `/api/internal/cron/archive-integrity` checks up to 100 least-recently
  attempted source objects in concurrent batches each day at `04:15 UTC`. It
  reports presence—not a fresh checksum calculation—and alerts on missing
  private objects.
- The processor exposes private `/healthz` and `/readyz`.
- The worker publishes expiring poll-loop and processor-readiness reports to
  the application; the reconciler publishes its own expiring report.
- The retention job publishes an expiring `project-files` health report and a
  deduplicated critical admin alert when configuration, Storage, or metadata
  cleanup fails.
- The source archive publishes `source-integrity`; Admin → Document archive
  shows full-population counts, private bytes stored, lifecycle, presence,
  checksum, customer/project ownership, and audited five-minute downloads.
- The admin Health page displays service checks, Stripe processing exceptions,
  worker failures, and launch-readiness gaps. Missing required reporters are
  critical, never implicitly healthy.

The launch generated-file window is 30 days and can be changed from
Admin → Settings within a 7–365 day guardrail. It does not change source-plan
retention. The task fails closed if the setting is unavailable or invalid. See
[`docs/DATA_RETENTION_AND_REQUESTS.md`](docs/DATA_RETENTION_AND_REQUESTS.md)
before changing it or handling a data-subject request.

The source registry is retention protection, not an independent PDF backup:
Supabase database backups do not contain Storage object bytes. Production must
configure an encrypted object backup/replica and rehearse a SHA-256-verified
restore before claiming disaster recovery.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build

cd services/takeoff
python -m pytest
```

See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) for deployment,
billing, tax, policy, observability, validation, and rollback checks.
