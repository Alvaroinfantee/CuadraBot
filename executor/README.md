# CuadraBot isolated execution plane

The public takeoff worker talks only to a loopback broker. For each submission,
the broker creates one disposable processor container, one internal Docker
network, one job-only bind directory, and one short-lived OpenAI egress token.
The OpenAI master key exists only in the separate egress proxy container.

## Boundaries

- Broker API: `127.0.0.1:8090`; authenticated with
  `EXECUTOR_BROKER_TOKEN`. It preserves the processor's `/v1/jobs` contract.
- Egress data API: port `8091`, reachable only as `openai-egress` on a job's
  internal network. It permits authenticated `POST /v1/responses` only.
- Egress control API: container port `8092`, published only as
  `127.0.0.1:8092`; every `/control/*` mutation requires
  `EGRESS_CONTROL_TOKEN`. `GET /healthz` and `GET /readyz` are loopback probes.
- Processor API: the isolated container listens on `/data/processor.sock`.
  The broker reaches that Unix-domain socket through the job's private bind
  directory, publishes no host TCP port, and substitutes a unique processor
  bearer token on every request.

The processor has no public port and only its internal job network. The egress
proxy is the only other member and separately has outbound connectivity. The
embedded Codex process uses the server-owned `cuadrabot-egress` model provider,
whose Responses API base URL is `http://openai-egress:8091/v1` and whose
short-lived credential comes only from `CODEX_API_KEY` in the isolated child
environment. It cannot fall back to direct OpenAI internet access.
The processor image runs as UID/GID 10001 with a read-only root, all
capabilities dropped, `no-new-privileges`, fixed PID/CPU/memory/no-swap limits,
a bounded `noexec` tmpfs, one exact job bind, and no sibling-job mount.

## Build

Build the existing processor and then the wrapper image. Resolve and deploy the
resulting wrapper image by immutable image ID or registry digest.

```bash
docker build -f services/takeoff/Dockerfile -t cuadrabot-takeoff-base:local services/takeoff
docker build --build-arg TAKEOFF_BASE_IMAGE=cuadrabot-takeoff-base:local -f executor/Dockerfile.processor -t cuadrabot-takeoff-executor:local .
docker build -f executor/Dockerfile.egress -t cuadrabot-openai-egress:local .
```

The egress Dockerfile pins the official Node multi-platform image by digest.
Mount a persistent named volume at `/state`; the image initializes that path for
its non-root `node` user (UID/GID 1000).

## Run contract

The egress process is:

```bash
node executor/src/egress-main.mjs
```

Required egress secrets are `OPENAI_API_KEY` and `EGRESS_CONTROL_TOKEN`.
Production also mounts `EGRESS_STATE_DIR=/state`, exposes data port 8091 only to
Docker job networks, and publishes control port 8092 to loopback only.

The host-native broker process is:

```bash
node executor/src/broker-main.mjs
```

It requires access to the same rootless Docker daemon/CLI as the egress
container plus these secrets:

- `EXECUTOR_BROKER_TOKEN`
- `EXECUTOR_EGRESS_CONTROL_TOKEN` (same value as egress control auth)
- `EXECUTOR_PROCESSOR_KEY_SECRET` (derives distinct per-job processor tokens)
- `EXECUTOR_SAFETY_SECRET` (HMACs the trusted user UUID)
- `EXECUTOR_PROCESSOR_IMAGE` (immutable `sha256:...` or `@sha256:...`)

The default state root is `/var/lib/cuadrabot-executor`. It must be persistent
and encrypted at rest. Its `jobs/` parent is mode 0700. Each exact bind child is
0707 so a rootless-Docker remapped non-root processor UID can write it; other
host users still cannot traverse the private parent. State files are atomic and
mode 0600. They contain source-job IDs/HMACs, budget counters, and token hashes
or IDs only, never an egress token, raw user ID, or OpenAI key.

Default production limits are one concurrent job, 2 CPUs, 6 GiB memory,
6 GiB memory-swap (equal values prohibit extra swap), 256 PIDs, 512 MiB tmpfs,
and an 8-hour TTL. On explicit cleanup, TTL expiry, or startup reconciliation,
the broker revokes the token, force-removes the container, disconnects/removes
the internal network, and removes the validated job directory. A networkless,
unprivileged helper from the same immutable processor image deletes files owned
by the rootless-Docker remapped processor UID before the host removes the now-
empty exact bind directory. Cleanup is authenticated and idempotent. Startup
also removes `starting`, `cleaning`, and
`running` records that were never bound to a processor job.

The egress defaults cap each JSON request and streamed response at 16 MiB. It
admits only one data request globally and one per token, synchronously before
body buffering. A data image may decode to at most 11 MiB; at most eight are
allowed in one request. Hard configuration ceilings are 24 MiB per request,
32 MiB per response, two global in-flight requests, and 32,000 output tokens
per request.

The trusted application job tier (never customer text) selects an atomic USD
budget:

| Job tier | API budget | Output tokens/request |
| --- | ---: | ---: |
| `free_sample` | $5 | 12,000 |
| `first_verified` | $10 | 16,000 |
| `essential` | $20 | 20,000 |
| `professional` | $35 | 24,000 |
| `multi_trade` | $60 | 32,000 |
| `large_set` | $100 | 32,000 |

Before forwarding, the proxy atomically reserves the full possible request
cost. Ordinary JSON is estimated at one input token per UTF-8 byte plus a 1 KiB
normalization allowance. Canonical
inline PNG/JPEG/WebP images have their dimensions parsed and reserve
`ceil(width/32) * ceil(height/32) * 4` input tokens; base64 bytes are not
mispriced as text. Every image is forced to bounded `high` detail, and remote or
account-scoped file references are rejected. Input reservations use the
long-context plus 1.25x cache-write rate (Sol/Terra/Luna: 12.5/5/0.5
micro-USD per token), and output reserves the full requested maximum at the
long-context rate (45/18/1.8 micro-USD per token).

Completed Responses `usage` is durably debited before another request is
admitted. Missing/malformed usage, a debit above its reservation, a proxy crash
with an unsettled reservation, or a state-write failure permanently fails that
token closed. Explicit prompt-cache controls are rejected. Under the documented
tokenizer, image-patch, and output-limit contracts the overshoot is zero; an
upstream contract violation can affect only the one in-flight call, after which
the token cannot make a second request.

The budget ledger key is a broker HMAC of the application source-job UUID and
is independent of disposable execution/token IDs. Revocation and worker retries
therefore cannot reset a job budget. Revoking a token with uncertain outstanding
work charges its full reservation to that persistent source-job ledger. These
compact ledgers are intentionally retained so a later retry cannot regain spent
budget.

The proxy also rejects built-in server-side tools, background requests,
stateful response/conversation/prompt references, priority/flex tiers, unknown
models, and account-scoped input files. It allows only custom/function tools
needed by the local Codex runtime, forces `store=false` and the default service
tier, strips caller OpenAI headers, and injects a stable `cb_*` safety identifier
derived from the end-user UUID.

## Worker

Set:

```bash
TAKEOFF_SERVICE_URL=http://127.0.0.1:8090
TAKEOFF_SERVICE_API_TOKEN=<EXECUTOR_BROKER_TOKEN>
```

Do not give the worker `OPENAI_API_KEY` or `CODEX_API_KEY`. The worker validates
the claimed job's scope, quoted credits, and free-sample flag, then supplies its
job/user IDs and resulting budget class only to the trusted loopback broker. It calls the
idempotent processor-job `DELETE` route in its per-attempt `finally` block.

## Verification

```bash
npm run test:executor
```

The local tests cover auth, route/model/tool/tier restrictions, header stripping,
stable pseudonyms, exact USD class budgets, representative multi-MiB plan-image
admission, durable usage accounting, pre-body global/per-token concurrency,
byte/time bounds, Docker flags, private-socket validation, traversal, restart
reconciliation, response-loss recovery, cleanup idempotency, submit-only token
delivery, and worker cleanup. A deployment must
also run the rootless-Docker smoke test because local Windows development does
not provide the production Docker networking and UID-remapping behavior.
