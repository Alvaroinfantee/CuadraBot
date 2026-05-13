# Cuadrabot

Production-ready MVP for `cuadrabot.com`: customers upload architectural blueprints, pay through Stripe Checkout, and create rendering jobs that are later pulled by a local worker on the owner's PC.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Supabase Postgres, Auth, private Storage
- Stripe Checkout and signed webhooks
- Resend transactional email abstraction
- Pull-based local Node.js worker scaffold

## Setup

1. Copy `.env.example` to `.env.local` and fill every required value.
2. Run `supabase/migrations/0001_initial.sql` in Supabase.
3. In Supabase Auth, create the owner user and set their `profiles.role` to `admin`.
4. Create Stripe Prices for each package and save the Price IDs in the `packages` table.
5. Configure Stripe webhook endpoint: `/api/stripe/webhook`.
6. Run the app:

```bash
npm install
npm run dev
```

## Worker

Copy `.env.worker.example` to `.env.worker`, set `CUADRABOT_API_URL`, `WORKER_API_KEY`, and `LOCAL_JOBS_DIR`, then run:

```bash
npm run worker
```

The worker polls `/api/worker/jobs/next`, claims paid jobs, downloads private files through signed URLs, runs the placeholder renderer, uploads final files, and moves the order to `needs_review`.

## Security model

The public website never exposes the owner's PC, Blender, MCP server, or local network. Rendering is pull-based: the local worker authenticates with `Authorization: Bearer WORKER_API_KEY` and can only access jobs it has claimed.
