# Cuadrabot launch checklist

This list separates code-complete work from external account, tax, policy, and
operating decisions that cannot be safely guessed or automated.

## Required before live traffic

- [ ] Reactivate or replace the Supabase project and apply every migration.
- [ ] Create the owner Auth user and set `profiles.role = 'admin'`.
- [ ] Configure public and secret Supabase keys in the deployment secret store.
- [ ] Set one stable base64 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across every
      web instance (32 decoded bytes recommended).
- [ ] Set separate long random values for `WORKER_SHARED_SECRET`,
      `CRON_SECRET`, and `RATE_LIMIT_SECRET` (at least 32 characters each).
- [ ] Put the processor API behind a trusted execution broker that launches one
      customer job per disposable container or VM with a unique non-root
      identity, PID/mount namespace, encrypted job-only volume, no sibling-job
      mounts, restricted egress, and CPU/memory/process limits.
- [ ] Issue a single-use or narrowly scoped model credential to each job
      runtime, keep it out of model-invoked tools, revoke it after the job, and
      destroy the runtime. Do not send live multi-tenant plans through the
      included long-lived processor/direct `CODEX_API_KEY` staging mode.
- [ ] Deploy at least one worker against that broker and rehearse crash,
      credential-revocation, retry, and cleanup behavior.
- [ ] Schedule `/api/internal/cron/reconcile` every 10 minutes.
- [ ] Schedule the `GET /api/internal/cron/retention` Vercel Cron once per day;
      confirm Vercel sends `Authorization: Bearer $CRON_SECRET`.
- [ ] Confirm the hosting plan supports the configured cron frequencies.
      Vercel Hobby allows only daily schedules, so the 10-minute reconciler
      requires a plan that supports sub-daily cron jobs or an external
      authenticated scheduler.
- [ ] Confirm web, database, worker, and processor readiness in Admin → Health.
- [ ] Confirm worker, processor, and reconciler reports stay current for at
      least three heartbeat cycles; stop each service once and verify it turns
      stale or missing.
- [ ] Run retention once with no eligible files and confirm
      `cuadrabot-retention · project-files` is current and healthy.

## Stripe Sandbox

- [ ] Reconnect the Stripe integration to the intended account.
- [ ] Create six Sandbox Prices matching the server catalog exactly.
- [ ] Set all six `STRIPE_PRICE_*` environment variables.
- [ ] In Admin → Billing, run **Validate & sync Stripe** and confirm every
      catalog item shows **Ready** before opening checkout.
- [ ] Configure `/api/stripe/webhook` on API version `2026-04-22.dahlia`.
- [ ] Subscribe to the handled Checkout, invoice, subscription, refund,
      dispute, PaymentIntent, charge, and customer events.
- [ ] Configure the default Billing Portal: payment methods, invoices, billing
      address, tax IDs, cancellation at period end; plan switching off.
- [ ] Run real hosted Checkout tests for packs and every subscription.
- [ ] Replay duplicate and out-of-order webhook events.
- [ ] Test paid→full refund, full refund→late paid, and two partial refunds
      that cumulatively become full in both event orders; confirm exactly one
      reversal or a suppressed late grant.
- [ ] Use Test Clocks for renewal, failed renewal, retry, and cancellation.
- [ ] Confirm the paid renewal appears once in 30-day paid revenue using
      Stripe's actual `amount_paid`, including a discounted invoice test.
- [ ] Test refund and dispute alerts and the supported, audited credit
      adjustment workflow from Admin → Billing.

## Tax, legal, and customer policy

- [ ] Have a qualified adviser confirm the legal operator name, address,
      Spanish/EU VAT position, registrations, invoice requirements, and any OSS
      obligations.
- [ ] Configure Stripe Tax only after registrations and Product tax codes are
      confirmed.
- [ ] Review Terms, Privacy, Refund, data-processing, support, and cancellation
      language with counsel.
- [ ] Confirm the 24-hour cleanup for abandoned, unqueued uploads and approve
      the Admin → Settings project-file window (30-day launch default).
- [ ] Confirm processor working-copy/log cleanup and infrastructure backup
      expiry match the approved policy; the web retention cron controls only
      tracked Supabase `takeoff_files` objects and metadata.
- [ ] Review and rehearse
      `docs/DATA_RETENTION_AND_REQUESTS.md`, including identity verification,
      legal holds, export, project-file erasure, account pseudonymization, and
      the records that must be retained for tax/security/audit purposes.
- [ ] Confirm the included-correction window and fixed Large Set service level.
- [ ] Credits currently do not expire. Do not advertise expiry until a
      lot-aware, atomic expiry workflow exists.

## Acceptance tests

- [ ] Sign up, confirm email, reset password, sign out, and sign in.
- [ ] Verify one-company free sample under simultaneous submissions.
- [ ] Upload a valid PDF; confirm server page count and SHA are stored.
- [ ] Reject non-PDF, encrypted, oversized, out-of-range sample page, and
      over-250-page inputs.
- [ ] Confirm insufficient credits cannot queue work.
- [ ] Confirm two simultaneous reservations cannot overdraw.
- [ ] Process a real takeoff through worker, processor, artifact hashes, and QA.
- [ ] Confirm files remain private until the atomic automated completion
      succeeds, then become available without an admin delivery step.
- [ ] Verify automated completion settles credits exactly once; reserve admin
      handling for correction requests and operational exceptions.
- [ ] Trigger failure and hard-crash reconciliation; verify credit release or
      safe requeue.
- [ ] Verify customer and admin signed downloads expire and enforce ownership.
- [ ] Verify authenticated sessions cannot insert, overwrite, or delete
      arbitrary Storage objects outside a server-issued signed upload token.
- [ ] Test one correction request and block a second included request.
- [ ] Verify suspended users cannot submit new work.
- [ ] Create old test jobs in every terminal state (`completed`, `failed`, and
      `canceled`), run retention, and verify exact upload/result objects are
      removed before `takeoff_files` metadata.
- [ ] Verify retention does not delete files for `draft`, `awaiting_upload`,
      `ready`, `queued`, `processing`, or `needs_review` jobs, even when those
      jobs are older than the cutoff.
- [ ] Race a correction request against a retention run. Confirm correction
      wins before the purge lease or is safely rejected while the lease is
      active; never allow both reactivation and Storage deletion.
- [ ] Stop a retention invocation after it claims a test job. Confirm the job
      stays protected while the two-hour lease is current, then that a later
      run clears the expired lease and safely resumes exact-file cleanup.
- [ ] Simulate a Storage deletion failure; verify metadata remains, the cron
      returns an error, service health becomes degraded, and one deduplicated
      critical admin alert appears.
- [ ] Review all admin metrics against source rows and confirm geography is
      coarse.
- [ ] Confirm headline totals remain correct with more than 5,000 detail rows;
      row limits apply only to operator drill-down tables.

## Production release

- [ ] `npm test`, lint, typecheck, build, Python tests, and migration smoke test
      all pass from a clean checkout.
- [ ] Run desktop/mobile browser QA for the public site, auth, demo, workspace,
      billing, and admin.
- [ ] Configure DNS, TLS, `NEXT_PUBLIC_SITE_URL`, support mailboxes, and error
      monitoring.
- [ ] Disable production demo mode unless intentionally used for sales.
- [ ] Keep Stripe live keys, Supabase secret key, processor token, worker
      secret, cron secret, rate-limit secret, and OpenAI key only in managed
      secret storage.
- [ ] Take a database backup, record the release commit, and document rollback.
