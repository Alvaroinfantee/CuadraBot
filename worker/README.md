# CuadraBot Takeoff Worker

This private Node worker connects the CuadraBot application to the vendored
takeoff processor in `services/takeoff` and contains only takeoff-processing
behavior.

It requires Node.js 20 or newer.

The worker:

1. polls CuadraBot for a paid, credit-reserved `takeoff_jobs` row;
2. atomically claims it with its worker ID;
3. downloads the source PDF from a short-lived signed URL;
4. verifies the required SHA-256 digest and `%PDF-` signature;
5. submits it to the private takeoff service with a server-owned Codex key;
   the job's fixed, versioned drawing-analysis profile is verified and sent as
   a separate trusted field;
6. mirrors processing progress into CuadraBot;
7. verifies every returned artifact by size and SHA-256;
8. asks CuadraBot for path-bound Supabase upload capabilities, streams each
   artifact directly to the private `takeoff-results` bucket, then asks
   CuadraBot to stream-verify and register the immutable metadata rows;
9. completes the job so the application settles reserved credits and releases
   the private deliverables to the customer; and
10. publishes short-lived worker and processor-readiness reports for the admin
    Health page.

On any processing failure, the worker calls the failure endpoint with
`{ stage, message, retryable, processorUsage }`. The application endpoint owns
the transactional release of reserved credits. Completion and failure remain
authoritative even if operational usage storage is unavailable; the app raises
an admin alert and degrades the required cost-accounting health check for later
reconciliation.

## Environment

Copy `.env.worker.example` to `.env.worker` and replace every secret:

```bash
CUADRABOT_API_URL=http://localhost:3000
WORKER_SHARED_SECRET=replace-with-the-app-worker-secret
WORKER_ID=takeoff-worker-01
TAKEOFF_SERVICE_URL=http://127.0.0.1:8000
TAKEOFF_SERVICE_API_TOKEN=replace-with-the-private-service-secret
CODEX_API_KEY=replace-with-the-server-owned-openai-key
LOCAL_JOBS_DIR=cuadrabot-takeoff-worker-jobs
```

Run the vendored service separately, then start the worker:

```bash
npm run worker
```

Local source files and artifacts are removed after each attempt by default.
Set `KEEP_LOCAL_JOB_FILES=true` only for controlled debugging.

## Internal application API contract

All requests carry:

```http
Authorization: Bearer ${WORKER_SHARED_SECRET}
X-Worker-Id: ${WORKER_ID}
```

Claim-scoped job operations also carry the fresh `X-Claim-Token` returned by
the claim endpoint. The health endpoint is worker-authenticated but is not
claim-scoped.

Endpoints are centralized in `src/api.ts`:

| Method | Path | Contract |
|---|---|---|
| `POST` | `/api/internal/worker/takeoff/health` | `{ workerStatus, workerMessage?, processorStatus, processorMessage?, ttlSeconds }` |
| `GET` | `/api/internal/worker/takeoff/jobs/next` | `{ job: WorkerJob \| null }` |
| `POST` | `/api/internal/worker/takeoff/jobs/:id/claim` | request `{ workerId }`, response `{ job }` |
| `GET` | `/api/internal/worker/takeoff/jobs/:id/input` | `{ job, signedUrl }` |
| `POST` | `/api/internal/worker/takeoff/jobs/:id/progress` | `{ stage, progress, message?, microserviceJobId? }` |
| `POST` | `/api/internal/worker/takeoff/jobs/:id/artifacts` | JSON `{ action: "prepare" \| "finalize", microserviceJobId, artifacts: [{ filename, mediaType, bytes, sha256 }] }`; prepare returns signed direct-upload destinations and finalize verifies/registers them |
| `POST` | `/api/internal/worker/takeoff/jobs/:id/complete` | `{ metrics, processorUsage, artifacts }` |
| `POST` | `/api/internal/worker/takeoff/jobs/:id/fail` | `{ stage, message, retryable, processorUsage }` |

The input `job` must include:

- `id`
- `source_sha256`
- `original_filename`
- `workflow_kind` (`legend_fixture_takeoff_v1`)
- `analysis_profile` (`analyze-building-drawings@2026-08-06`)
- `requested_scopes` (`fixture_counts`, `cable_runs`, or both)
- `customer_instructions`
- `page_count`
- `free_sample` (server-owned; never inferred from customer instructions)

The application persists the fixed `analysis_profile` in
`takeoff_jobs.processor_version` when the job is created. It rejects a missing
or different value before issuing a source download URL. The worker verifies
the same allowlisted value again and forwards it to the processor as the
multipart field `analysisProfile`. The application derives `workflow_kind`
and `requested_scopes` from the validated database job. Customer notes are
carried separately and cannot select an analysis profile or expand that
trusted scope. The application, not this process, is authoritative for
ownership, job transitions, storage rows, credit ledgers, and retries.

While the takeoff service is active, the worker refreshes job progress at
least once per `WORKER_HEARTBEAT_INTERVAL_MS`. The application should treat
that update as the claim heartbeat and reconcile truly stale claims after an
operator-defined timeout. Independently, the worker reports its poll loop and
the processor `/readyz` result on the same interval. These reports expire
automatically; a stopped worker or unreachable processor cannot remain green.
`TAKEOFF_JOB_TIMEOUT_MS` must be at least seven hours so the worker cannot
abandon a valid 30-minute indexing stage plus the processor's six-hour Codex
deadline before post-processing finishes. The checked-in local default is
7 hours 15 minutes.

## Production isolation gate

This worker's direct `CODEX_API_KEY` plus long-lived processor configuration is
for local integration and controlled single-tenant staging. Before processing
unrelated live customers, point the same private-service contract at a trusted
execution broker that launches one job per disposable container or VM with a
unique non-root identity, PID/mount namespace, encrypted job-only volume, no
sibling-job mounts, restricted egress, and CPU/memory/process limits.

The broker must inject a single-use or narrowly scoped model credential for the
job, keep it out of model-invoked tools, revoke it after completion, and
destroy the runtime. The in-process permission profile is defense in depth and
does not replace this OS-level boundary. See the processor's
`Mandatory production isolation gate` section for the complete requirement.
