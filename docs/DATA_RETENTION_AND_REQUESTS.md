# Data retention and customer data requests

This runbook separates automated project-file deletion from account, billing,
security, and legal records. It is an operating guide, not legal advice. The
operator responsible for privacy must approve the production values and the
response procedure before launch.

## Automated retention controls

| Data class | Launch control | What is removed |
| --- | --- | --- |
| Unfunded uploads | 24 hours through the reconciler | Exact tracked upload objects and their `takeoff_files` rows after the upload session is atomically canceled |
| Terminal takeoff project files | 30 days by default; 7–365 days in Admin → Settings | Exact tracked objects in `takeoff-uploads` and `takeoff-results`, then the matching `takeoff_files` rows |
| Processor working copies and logs | Processor deployment configuration | Private processor files; confirm its independent cleanup setting during launch |
| Database backups and provider recovery copies | Infrastructure/provider policy | Confirm expiry separately; the web cron cannot delete backup snapshots |
| Job, billing, credit, analytics, security, and admin audit records | Separate support, fraud, accounting, tax, dispute, security, and legal schedule | Not deleted by project-file retention |

The project-file cron reads `retention.project_files_days` from
`app_settings`. A missing, non-integer, or out-of-range value pauses deletion,
marks retention health degraded, and opens a deduplicated critical admin alert.
There is no silent fallback.

Eligibility is limited to `completed`, `failed`, and `canceled` takeoff jobs
whose terminal-state retention timestamp is older than the calculated cutoff.
Before it reads or deletes project files, the cron atomically places a two-hour
purge lease on every still-eligible job. A correction, requeue, or other
reactivation either commits before that lease and makes the job ineligible, or
waits and is rejected until the purge finishes. File metadata inserts use the
same job-row lock, so new files cannot appear during deletion. The task never
selects `draft`, `awaiting_upload`, `ready`, `queued`, `processing`, or
`needs_review`.

If the invocation exits before releasing its purge lease, the lease expires
after two hours and a later run clears it before attempting a new claim. That
window is intentionally longer than the supported web-function runtime. Do not
raise the function timeout beyond two hours without increasing the lease too.
Until expiry, correction, requeue, and new tracked-file insertion remain safely
blocked for the claimed job.

Deletion uses the Supabase Storage API with exact paths already recorded in
`takeoff_files`; it never deletes a prefix and never writes directly to
`storage.objects`. Metadata is deleted only after the corresponding Storage API
request succeeds. If a bulk Storage request fails, the cron checks each exact
path and retries only objects that still exist before deciding whether its
metadata is safe to remove. A failed or duplicated run is safe to run again.
Runs are bounded to 50 jobs and 1,000 tracked files so a large backlog drains
over successive daily invocations. After the cron confirms that no tracked
files remain, it records `takeoff_jobs.project_files_purged_at`; this preserves
job history while preventing already-clean jobs from starving later batches.
Any later supported transition to an active state clears the purge marker, and
any later tracked file insert on a terminal job resets the retention timestamp,
so newly generated files remain eligible for a future run.

The automation covers new takeoff records only. Historical rendering-era
`orders`, `order_files`, or legacy buckets require a separately approved
migration and retention decision before those records are erased.

## Changing the project-file window

1. Confirm the new window still covers the advertised seven-day correction
   period and any support or dispute needs.
2. Obtain approval from the person responsible for privacy and customer
   support.
3. Open Admin → Settings → Project-file retention.
4. Enter a whole number from 7 through 365 and a clear change reason.
5. Save the setting and confirm the change appears in Admin → Audit.
6. After the next daily run, confirm Admin → Health shows
   `cuadrabot-retention · project-files` as healthy.
7. Update public/support disclosures if the operational commitment changed.

## Customer access, export, or deletion request

Use one case/ticket per request and keep the case number in every operator note.
Do not send exports to an unverified email address.

1. Verify the requester's identity and authority for the account. For a company
   account, also verify that the requester may act for the organization.
2. Check for a legal, tax, dispute, fraud, chargeback, or security hold. Record
   the decision and the applicable response deadline. Escalate uncertainty to
   the privacy/legal owner.
3. Locate the customer in Admin → Users and record the immutable user ID in the
   case. Use the ID—not an email fragment—to scope every export or deletion.
4. For an access/export request, have the authorized technical operator export
   only that user ID's profile, subscriptions, billing references, credit
   account/ledger, takeoff jobs/events, analytics records, and tracked project
   files. Encrypt the package, transfer it through the approved secure channel,
   and record the export manifest and delivery date.
5. For an erasure or closure request, suspend access first and cancel recurring
   billing according to the approved billing procedure. Safely finish or cancel
   in-flight jobs before any project-file deletion; never change the retention
   query to include active statuses.
6. If project files must be erased before the normal window, the authorized
   technical operator must use a reviewed one-off procedure that reads exact
   paths from `takeoff_files`, removes them through the Supabase Storage API,
   verifies success, and only then removes their metadata. Never delete rows
   from `storage.objects` with SQL.
7. Pseudonymize optional profile/contact/location fields that no longer have a
   valid purpose. Retain only the minimum billing, credit, fraud, security, and
   audit evidence required by the documented hold or legal schedule.
8. Do not hard-delete the Supabase Auth/profile row as a routine shortcut.
   Current billing, ledger, job, and audit foreign keys intentionally restrict
   cascading deletion, and an Auth token can remain valid until expiry. Account
   closure therefore requires a reviewed revocation and pseudonymization
   procedure.
9. Have a second authorized person verify that no in-scope active Storage
   objects remain, that retained records match the documented exception, and
   that the customer response accurately describes both deletion and retention.
10. Close the case with timestamps, approvers, the export/deletion manifest,
    retained-data reasons, and the date of any future review.

Before live traffic, rehearse this workflow with a test customer and verify the
result against Supabase Storage, the database, Stripe Sandbox, Admin → Audit,
and Admin → Health.
