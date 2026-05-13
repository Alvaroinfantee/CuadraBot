# Cuadrabot Local Rendering Worker

This worker runs on the owner's PC. It polls the public Cuadrabot API for paid jobs, downloads customer files, runs the local rendering placeholder, uploads final files, and moves the order to `needs_review`.

The public website must never expose Blender, MCP, Codex, or the owner's local network. This worker is pull-based and authenticates with `WORKER_API_KEY`.

## Environment

Create a local `.env.worker` file or export these variables:

```bash
CUADRABOT_API_URL=https://cuadrabot.com
WORKER_API_KEY=replace-me
WORKER_ID=owner-pc-01
LOCAL_JOBS_DIR=C:/Cuadrabot/jobs
BLENDER_COMMAND=
POLL_INTERVAL_MS=30000
```

## Run

```bash
npm run worker
```

## Blender/Codex/MCP integration point

The placeholder lives in `worker/src/render.ts` as `runBlenderRender(...)`. Replace the placeholder output with the local Codex + Blender + MCP command once that pipeline is ready.

Expected future flow:

1. Inspect files in `LOCAL_JOBS_DIR/{order_number}/input`.
2. Ask the local Codex/agent to produce Blender scene instructions.
3. Use MCP to control Blender locally.
4. Save PNG/JPG renders into `LOCAL_JOBS_DIR/{order_number}/output`.
5. Let this worker upload those files back to Cuadrabot.
