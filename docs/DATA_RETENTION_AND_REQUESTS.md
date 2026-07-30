# Source archive, retention, and customer data requests

This runbook separates original customer plans from disposable processing files,
generated deliverables, account records, and backups. It is an operating guide,
not legal advice. The privacy owner must approve the production values and
request procedure before launch.

## Data classes

| Data class | Launch control | Lifecycle |
| --- | --- | --- |
| Abandoned or unverified uploads | Reconciler after 24 hours | Exact private object and its `takeoff_files` row are removed after the upload session is atomically canceled |
| Verified original plan PDFs | Secure source archive | Retained in private Storage while the account is active for project history, recovery, support, and disputes; removed only through an approved request/closure workflow or held longer for a documented legal obligation |
| Free-sample one-page copy and generated deliverables | 30 days by default; 7–365 days in Admin → Settings | Exact non-archive objects and matching `takeoff_files` rows are removed after a terminal job reaches the configured cutoff |
| Processor working copies and logs | Processor deployment control | Removed by the isolated job runtime; verify its separate cleanup during launch |
| Source archive registry | Permanent tombstone | Ownership, exact object path, size, page count, SHA-256, lifecycle, integrity checks, and deletion reason remain auditable after approved object erasure |
| Job, billing, credit, analytics, security, and admin audit records | Separate approved schedule | Not deleted by generated-file retention |
| Database recovery and object backups | Provider/infrastructure policy | Database backups do not contain the Storage object bytes; configure and verify object backup separately |

## Secure source archive

PDF bytes stay in the private `takeoff-uploads` bucket; they are not stored as
large Postgres blobs. `document_archives` is the durable database registry.
Every row contains the customer and job IDs, opaque exact object path, original
display name, byte size, page count, SHA-256, lifecycle, and presence-check
timestamps.

Registration is fail-closed and service-role only. The server downloads and
validates the PDF, calculates the original SHA-256, locks the verification
claim, and registers the archive before a job can become ready. A free sample
therefore keeps the complete original while a separate one-page `sample.pdf`
working copy is sent to the processor.

To prevent unpaid quote requests from becoming unbounded durable storage, an
account without a current qualifying subscription or a fulfilled,
non-refunded credit-pack purchase can retain up to 25 verified plans or 512
MiB, whichever comes first. Qualifying paid-capacity accounts can retain up to
500 verified plans or 20 GiB. The application blocks new verification and
opens an admin alert before either limit is exceeded; existing sources are not
silently removed.

Authenticated customers can read only their own registry rows and receive
five-minute signed links for their own originals. Operators must pass the admin
check again for each five-minute signed download; the download is blocked if
its audit record cannot be written. Browser sessions cannot insert, overwrite,
or delete Storage objects directly.

Retention lifecycle, legal hold, and object integrity are independent:

- lifecycle: `retained`, `deletion_requested`, `deleting`, or `deleted`;
- legal hold: separate actor, timestamp, and reason fields that can block a
  pending deletion without erasing the request;
- integrity: `verified` or `missing`.

This separation prevents a presence failure or new hold from silently clearing
a customer request. Archive identity and SHA metadata are immutable, rows
cannot be hard-deleted, and approved erasure ends in a permanent `deleted`
tombstone. Admin → Document archive can place/release holds and record/cancel
deletion requests; each transition and its audit record commit atomically.
Before external object removal, the second administrator acquires a token-bound
15-minute deletion lease in the database. That lease blocks a concurrent hold
or cancellation, can be safely reclaimed after an interrupted attempt, and is
required again when verified absence is finalized as a tombstone. The database
also refuses removal until the initial two-hour signed-upload capability has
expired, with a safety margin, so an old browser token cannot recreate an
erased source path.

The daily archive task checks object presence in bounded concurrent batches,
advances `last_check_attempt_at` even when the provider errors, publishes
`cuadrabot-archive · source-integrity`, and opens a deduplicated critical alert
for a missing object. This is a presence check, not a fresh content re-hash.
The upload-time SHA remains the recovery comparison value.

## Generated-file cleanup

The cleanup task reads `retention.project_files_days` from `app_settings`. A
missing, non-integer, or out-of-range value pauses deletion, marks health
degraded, and opens a critical alert; there is no silent fallback.

Eligibility is limited to `completed`, `failed`, and `canceled` jobs older than
the cutoff. The task first places a two-hour job lease so correction, requeue,
or tracked-file insertion cannot race external Storage deletion. Expired claims
are safely reclaimed.

Before deleting anything, the task loads the source registry. Any exact
`bucket + storage_path` protected by a non-deleted archive row is excluded.
Only remaining processor inputs, sample copies, and generated files are removed
through the Storage API. Metadata is removed only after deletion succeeds or
the exact object is confirmed absent. Archive-query failure prevents every
Storage deletion.

When no non-archive tracked files remain, the job receives
`project_files_purged_at`. A retained source row may still exist; the marker
means the scheduled generated-file cleanup is complete. Runs are bounded so a
backlog drains across successive invocations without already-clean jobs
starving later batches.

## Archive is not independent backup

The registry prevents scheduled deletion and detects missing primary objects,
but it is not a second copy. Supabase database backups contain Storage metadata,
not the PDF object bytes. Before live traffic:

1. Configure an independently encrypted Storage-object backup or replication
   target in a separate failure domain.
2. Use a finite lifecycle that also supports approved erasure.
3. Produce a backup manifest with object identity, size, and SHA-256.
4. Publish backup freshness separately in Admin → Health.
5. Restore a test plan and compare its SHA-256 with `document_archives`.

Never show “backed up” in the product unless that external report is current.

## Changing the generated-file window

1. Confirm the new window covers the advertised seven-day correction period.
2. Obtain privacy/support approval.
3. Open Admin → Settings → Generated-file retention.
4. Enter a whole number from 7 through 365 and a clear reason.
5. Confirm the update in Admin → Audit.
6. After the next run, confirm
   `cuadrabot-retention · project-files` is healthy.
7. Update public disclosures if the commitment changed.

This setting never changes verified source-plan retention.

## Customer access, export, deletion, or closure

Use one case number throughout. Do not send exports to an unverified address.

1. Verify the requester’s identity and authority for the company.
2. Record the immutable user ID and response deadline.
3. Check for legal, tax, dispute, fraud, chargeback, or security holds. A hold
   must block deletion; escalate uncertainty to the privacy/legal owner.
4. For access, use the customer workspace or Admin → Document archive. Encrypt
   any broader export, use the approved transfer channel, and record a manifest.
5. For erasure, suspend access and settle/cancel in-flight work first. In
   Admin → Document archive, an authorized operator records the deletion
   request with the case number and reason; the transition is atomic with its
   audit entry.
6. A different active administrator verifies scope and holds, then uses the
   second-admin removal control. The server deletes only the recorded exact
   Storage path—never with SQL against `storage.objects`—and verifies that the
   object is absent.
7. Only after verified absence, the same server action atomically sets
   lifecycle `deleted`, `deleted_at`, and the case-backed reason and writes the
   admin audit record. Never delete the registry row.
8. Apply the same exact-path procedure to in-scope generated files. Preserve
   the minimum billing, fraud, security, and audit evidence required by the
   documented schedule.
9. Propagate erasure to independent backup expiry under the approved backup
   policy and disclose any lawful delay.
10. Have the second authorized person compare Storage, registry tombstones,
    manifests, Admin → Audit, and Admin → Health before closing the case.

Do not hard-delete the Supabase Auth/profile row as a shortcut. Foreign keys,
billing history, and token revocation require a reviewed closure procedure.
Rehearse this workflow with a test customer before live traffic.
