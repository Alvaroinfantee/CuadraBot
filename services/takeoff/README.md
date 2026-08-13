# Drawing Takeoff Microservice

> **Private service:** this container is an internal CuadraBot worker
> dependency. Do not expose it directly to browsers or the public internet.
> CuadraBot's authenticated application API owns users, job ownership, credit
> accounting, uploads, and artifact delivery. Only the trusted Node worker
> calls this service.

This service turns a construction drawing PDF into:

- a source-grounded quantity takeoff with one stable ID per placement;
- a source-backed legend register that every included fixture or measured run
  must reference;
- a deterministic ORTEGA-format Excel takeoff package with placement records,
  sheet and asset registers, code/area/floor rollups, QA notes, static estimating
  fields, and a hidden machine-audit sheet;
- an annotated copy of the original PDF, with a visible colored marker at every
  recorded placement and a clickable comment containing the full unit ID,
  code, item, sheet, area, method, and confidence;
- machine-readable `takeoff.json`, `methodology.json`, and
  `annotation_audit.json` files.

The service runs Codex locally through `codex exec`. It uses an OpenAI Platform
API key for usage-based access instead of the operator's ChatGPT session.
The trusted production egress selects Priority processing for the one-sheet
free sample and Standard processing for paid jobs. Usage telemetry is priced
with the matching dated rate snapshot, including the all-input-uncached
counterfactual. When no customer workbook template is supplied, Codex produces
the evidence JSON and methodology only; the service then builds and validates
the canonical ORTEGA-format workbook deterministically.
The key is accepted in `X-Codex-API-Key`, held only in memory, and passed only
to the single child process as `CODEX_API_KEY`. It is never written into the
job directory, command line, result, or log.

This supports estimating and review. It does not authorize construction or
replace verification by the responsible designer, engineer, estimator, or
trade contractor.

## Architecture

```text
POST /v1/jobs
    |
    +-- immutable input staging + SHA-256
    |
    +-- verified analyze-building-drawings bundle staged read-only per job
    |      |
    |      +-- 180-DPI page assets, extracted text, manifest, and SQLite index
    |      +-- complete visual page review and index validation
    |
    +-- job-scoped codex exec workspace and permission profile
    |      |
    |      +-- complete sheet register and deduplication
    |      +-- legend extraction and source-bbox registration
    |      +-- mapped fixture counting and cable/conduit centerline measurement
    |      +-- source-grounded takeoff JSON and optional DOP price matching
    |
    +-- takeoff.json schema and reconciliation checks
    |      |
    |      +-- canonical legend.<legend_entry_id> index objects
    |      +-- canonical asset.<unit_id> facts, evidence, and relationships
    |
    +-- deterministic 19-tab ORTEGA-format workbook + hidden Takeoff audit
    |
    +-- deterministic PDF annotation from recorded coordinates
    |
    +-- artifact manifest + download endpoints
```

The annotation pass is deterministic and does not ask the model to redraw the
plans. Coordinates use visible CropBox PDF points with the origin at the
top-left, then the service transforms them back through each PDF page's crop
offset, non-zero PDF origin, and rotation.

## Local setup

Prerequisites:

- Python 3.11 or later;
- the Codex CLI on `PATH`;
- Poppler/Tesseract or equivalent tools for drawing rasterization and OCR;
- enough local disk space for the source PDF, rasterized pages, and outputs.

The self-serve product accepts up to 250 plan pages. Preprocessing retains a
separate 5,000-page structural-validation ceiling for malformed or internally
replayed PDFs; that number is not a supported processed-set size. At 180 DPI,
the cumulative render preflight is capped at 8 billion pixels (enough for 250
standard 24 x 36 inch sheets), with additional 100-million-pixel per-page,
2 GB index, free-disk, and process-time bounds.

```bash
cd drawing_takeoff_microservice
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

Start the API:

```bash
export TAKEOFF_SERVICE_API_TOKEN="replace-with-a-service-token"
python scripts/run_takeoff.py serve --host 127.0.0.1 --port 8000
```

Interactive API documentation is available at
`http://127.0.0.1:8000/docs`.

## Submit a job

The CLI reads the Codex key from `CODEX_API_KEY`. If it is not set and the
terminal is interactive, it asks without echoing the value.

```bash
export CODEX_API_KEY="your-openai-platform-api-key"
export TAKEOFF_SERVICE_API_TOKEN="replace-with-a-service-token"

python scripts/run_takeoff.py submit \
  --drawings "/path/to/drawings.pdf" \
  --template "/path/to/takeoff_template.xlsx" \
  --prices "/path/to/dop_price_database.xlsx" \
  --wait
```

Equivalent HTTP request:

```bash
curl -X POST http://127.0.0.1:8000/v1/jobs \
  -H "Authorization: Bearer $TAKEOFF_SERVICE_API_TOKEN" \
  -H "X-Codex-API-Key: $CODEX_API_KEY" \
  -F "drawings_pdf=@/path/to/drawings.pdf;type=application/pdf" \
  -F "template_xlsx=@/path/to/takeoff_template.xlsx" \
  -F "price_database_xlsx=@/path/to/dop_prices.xlsx" \
  -F "model=gpt-5.6-sol" \
  -F "analysisProfile=analyze-building-drawings@2026-08-06" \
  -F "workflowKind=legend_fixture_takeoff_v1" \
  -F "requestedScopes=fixture_counts" \
  -F "requestedScopes=cable_runs" \
  -F "instructions=Include new-work electrical plans; exclude demolition."
```

`analysisProfile`, `workflowKind`, and repeated `requestedScopes` values are
server-owned fields supplied by the trusted CuadraBot worker. The processor
accepts only the pinned `analyze-building-drawings@2026-08-06` profile, verifies
the vendored bundle byte-for-byte, and stages it at
`.agents/skills/analyze-building-drawings` in the isolated job workspace. It
prepares `work/drawing-index` before `codex exec`, explicitly invokes the skill,
then rejects the result unless every takeoff legend and placement aligns to a
visually checked, exact-page/sheet, geometry-bbox evidence record and fact, and
each placement's `instance-of` relationship uses that same quantity evidence.
Customer uploads can never select or replace a skill bundle or path.

The processor validates the supported workflow and scope values and passes them
to the analysis policy separately.
`instructions` remains normalized customer scope text inside the explicit
untrusted JSON boundary; it cannot add a scope or change the output contract.

The trusted CuadraBot worker may also send `freeSample=true`. That boolean is a
server-to-server field, never inferred from customer scope text. It adds a
visible, print-enabled, locked `CUADRABOT SAMPLE` watermark to every page of the
annotated PDF while preserving the normal workbook contract. CuadraBot must
derive the flag from its verified job record.

The API returns `202 Accepted`:

```json
{
  "job_id": "9f51b5...",
  "status": "queued",
  "status_url": "/v1/jobs/9f51b5..."
}
```

Poll and download:

```bash
curl -H "Authorization: Bearer $TAKEOFF_SERVICE_API_TOKEN" \
  http://127.0.0.1:8000/v1/jobs/JOB_ID

curl -OJ -H "Authorization: Bearer $TAKEOFF_SERVICE_API_TOKEN" \
  http://127.0.0.1:8000/v1/jobs/JOB_ID/artifacts/takeoff.xlsx

curl -OJ -H "Authorization: Bearer $TAKEOFF_SERVICE_API_TOKEN" \
  http://127.0.0.1:8000/v1/jobs/JOB_ID/artifacts/annotated_drawings.pdf
```

## Replay mode

For deterministic validation, re-annotation, or migration testing, submit a previously
generated `takeoff.json`. Replay mode skips Codex and does not require an
OpenAI key:

```bash
curl -X POST http://127.0.0.1:8000/v1/jobs \
  -H "Authorization: Bearer $TAKEOFF_SERVICE_API_TOKEN" \
  -F "drawings_pdf=@/path/to/drawings.pdf" \
  -F "takeoff_json=@/path/to/takeoff.json" \
  -F "workbook_result=@/path/to/takeoff.xlsx"
```

The source PDF SHA-256, page count, unique IDs, geometry, and annotation totals
are still validated.

## Input and output contract

The root `takeoff.json` object requires `source`, `legend_entries`, `assets`,
`unresolved_symbols`, `by_code`, `by_area`, and `limitations`.

Every `legend_entries[]` row contains a stable `legend_entry_id`, exact code and
description, source PDF page and sheet, and a tight source bbox in displayed
PDF coordinates. Every `assets[]` row must reference one of those entries, and
its code and description must match the legend entry exactly.

Every `assets[]` row contains:

- `unit_id`, `legend_entry_id`, `measurement_kind`, `code`, and `description`;
- `page`, `sheet`, `area_code`, `area`, and `level`;
- `method`, `confidence`, and `coordinate_space`;
- optional `visible_label`, `notes`, `quantity`, and `unit`.

For `measurement_kind=count`, the row contains either `x` and `y`, or `bbox`,
and always represents exactly one placement with `quantity=1` and `unit=EA`.
Aggregated count rows are rejected.
For `measurement_kind=linear`, it instead contains a centerline `path` of at
least two displayed-page points plus per-asset `scale_evidence`. Scale evidence
must come from the same page and sheet and records its source bbox/text,
`stated_scale` or `calibrated_dimension` method, canonical `m` or `ft` unit, and
`real_units_per_pdf_point`. Validation recomputes every run as Euclidean path
length in displayed PDF points multiplied by that factor and rejects a
non-reconciling quantity.

Every `by_code` and `by_area` summary row carries `measurement_kind` and `unit`
alongside its code or area dimension. Reconciliation uses that complete
composite key, so an `EA` fixture count can never be added to a cable length in
`ft` or `m`, even when both use the same legend code or area.

Observed symbols without a defensible legend match belong in
`unresolved_symbols` with their source page, sheet, bbox, visible label, reason,
and low confidence. They are deliberately excluded from `assets`, summaries,
workbook quantity rows, annotations, and pricing. Any asset geometry that
overlaps a registered legend exemplar is also rejected.

`coordinate_space` is always `pdf_display_points_top_left`, relative to the
visible CropBox. This keeps geometry independent of internal CropBox offsets,
non-zero PDF origins, and page rotation.

The normal CuadraBot workflow writes the 19 visible ORTEGA-format sheets in a
fixed order: `Resumen Takeoff`, placement and asset registers, the drawing
register, building placeholders, code/floor/area summaries, quantity analysis,
QA and dashboard tabs, equipment/cable placeholders or supported measurements,
and deliverable status. The service owns this formatting step after
`takeoff.json` passes validation, so model output cannot change the customer
workbook layout. Formula results are stored as static values.

Every generated workbook also contains a hidden `Takeoff` machine-audit sheet with
one row per mapped `unit_id` and these required headers: `unit_id`,
`legend_entry_id`, `measurement_kind`, `code`, `description`, `page`, `sheet`,
`area_code`, `area`, `level`, `method`, `confidence`, `quantity`, `unit`,
`path_length_pdf_points`, `scale_kind`, `scale_source_page`,
`scale_source_sheet`, `scale_source_text`, and
`scale_real_units_per_pdf_point`. Linear evidence columns must reconcile to
the JSON contract; count rows leave those columns blank. Before delivery, the
service rejects
corrupt or polyglot XLSX files, macros, OLE/embedded objects, external links,
every formula cell (including DDE and external-reference formulas), obvious
cell errors, excessive sheet/cell sizes, duplicate IDs, and workbook rows that
do not reconcile to validated `takeoff.json`. Generated workbooks must contain
values only; totals, prices, and currency conversions are precomputed before
the workbook is written. Workbook defined names are not part of the output
contract and are rejected, including ordinary named formulas and built-in
defined names.

The annotated PDF uses colored square annotations for fixture placements and
visible colored polyline annotations for cable/conduit runs instead of painting
over source content. Open the Comments/Annotations panel in Acrobat, Preview,
or another annotation-aware viewer to search unit IDs and inspect the full
legend, scale, quantity, and audit note. A page-summary note lists annotation
counts by code.

## Security and production deployment

- Put the service behind TLS and an authenticated reverse proxy.
- Set `TAKEOFF_SERVICE_API_TOKEN`. The service fails closed without it unless
  `TAKEOFF_ENV` is explicitly `dev`, `development`, or `test`.
- Send the Codex key only in `X-Codex-API-Key`. Never use a URL query parameter
  or multipart form field for credentials.
- Use CuadraBot's server-owned `CODEX_API_KEY`; never ask customers to provide
  an API key.
- The child process receives a minimal environment, an isolated `CODEX_HOME`,
  `--ephemeral`, `--ignore-user-config`, and `--ignore-rules`. Authoritative
  command-line config selects a job-local `workspace-only` permission profile:
  filesystem root denied, Codex's minimal tool paths read-only, only the
  current job workspace writable, temporary roots denied, tool network off,
  login shells off, and a none-inherited shell environment with only
  `PATH`, `HOME`, locale values, and non-secret operating-system runtime
  variables required for Windows process and DNS initialization. The
  generated policy is retained in the
  private job work directory for audit.
- Customer `instructions` are normalized, length-limited, JSON-quoted, and
  presented to the model only as untrusted takeoff scope data. They cannot
  authorize tools, commands, file access, network access, credential handling,
  security changes, or output-policy changes.
- Model-created artifacts are accepted only when they are bounded regular files
  directly inside the job artifact directory. Symlinks, path escapes, malformed
  JSON/PDF/XLSX, unsafe workbooks, and reconciliation failures are rejected.
- Treat uploaded drawings and workbooks as confidential project records.
- Completed and failed local jobs are removed by a startup retention sweep
  after `TAKEOFF_RETENTION_DAYS` (seven days by default). The authenticated
  `DELETE /v1/jobs/{job_id}` endpoint can remove one exact inactive terminal
  job earlier.
- For multiple replicas, replace the in-process executor and local job store
  with a durable queue and object storage. The API contract can remain the
  same.
- Configure the reverse proxy to accept the intended upload size. Both the
  per-file and combined multipart content defaults are 250 MiB.

### Mandatory production isolation gate

The included server is a durable single-host implementation for local testing
and replay recovery. A permission profile is defense in depth; it is not a
per-job OS security boundary. Do not process unrelated customers in the same
long-lived container, Unix user, PID namespace, or shared `/data` volume.

Production orchestration must launch one customer job per disposable
container/VM with its own non-root identity, PID/mount namespace, encrypted
job-only volume, no sibling job mounts, and resource limits. Deny general
egress; allow the Codex parent process only the OpenAI API route it requires.
Issue a single-use or narrowly scoped credential through a broker and revoke it
after the job. The model-invoked tool environment must never receive that
credential. These controls are a launch gate because the in-process executor
cannot provide them by itself.

On a durable-host restart, replay jobs with intact replay inputs are requeued
idempotently. Interrupted Codex jobs are marked `failed`, `retriable`, with
`error_code=processor_restarted`; API keys are deliberately never persisted,
so CuadraBot must resubmit those jobs with a new credential.

OpenAI's current file-input guide limits a single direct Responses API request
to 50 MB total. Large drawing sets should therefore be rasterized and processed
locally in bounded page batches, as this workflow instructs Codex to do:
[OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs).
Codex documents API-key authentication for programmatic local workflows and
the single-run `CODEX_API_KEY` pattern:
[Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `TAKEOFF_ENV` | `production` | Runtime mode; only explicit dev/test modes may omit auth |
| `TAKEOFF_DATA_DIR` | `./data` | Persistent job directory |
| `TAKEOFF_CODEX_MODEL` | `gpt-5.6-sol` | Default Codex model |
| `CODEX_BIN` | `codex` | Codex CLI executable |
| `TAKEOFF_MAX_UPLOAD_BYTES` | `262144000` | Per-file upload limit |
| `TAKEOFF_MAX_TOTAL_UPLOAD_BYTES` | `262144000` | Combined uploaded-file limit |
| `TAKEOFF_MAX_WORKERS` | `1` | Concurrent local jobs; production uses one disposable job runtime |
| `TAKEOFF_RETENTION_DAYS` | `7` | Startup retention for completed/failed local jobs |
| `TAKEOFF_MAX_INSTRUCTIONS_CHARS` | `4000` | Normalized customer scope limit |
| `TAKEOFF_SERVICE_API_TOKEN` | unset | Required bearer token outside explicit dev/test |

## CuadraBot private-service contract

The Node worker authenticates with:

```http
Authorization: Bearer ${TAKEOFF_SERVICE_API_TOKEN}
X-Codex-API-Key: ${CODEX_API_KEY}
```

It submits one verified source PDF as `drawings_pdf`, plus optional
instructions and model, to `POST /v1/jobs`. It polls the returned
`status_url`, downloads every entry in the completed job's `artifacts` map,
and sends those files back to CuadraBot through the application's internal
worker API. The browser never receives either secret or a direct URL for this
service.

Operational probes:

- `GET /healthz` is a liveness check.
- `GET /readyz` returns `200` only when the data directory is writable and the
  configured Codex executable is available; otherwise it returns `503`.

## Docker

```bash
docker build -t drawing-takeoff-service .
docker run --rm -p 8000:8000 \
  -e TAKEOFF_SERVICE_API_TOKEN="replace-me" \
  -v takeoff-data:/data \
  drawing-takeoff-service
```

The OpenAI key is intentionally not configured as a container-wide
environment variable. Supply it per job in the request header.

The image pins Python 3.12.11 (including the official multi-architecture image
digest), Codex CLI 0.146.0, and exact direct Python dependency versions.
