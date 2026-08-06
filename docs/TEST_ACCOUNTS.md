# Test accounts

Cuadrabot can provision login-capable accounts into a local Supabase stack or
a dedicated remote sandbox. The bootstrap is an explicit CLI operation; it is
not imported by the web application and never runs during development, builds,
deployments, or tests.

It creates or updates:

- one active primary administrator;
- one active Spanish customer with `ES`, `Madrid`, and `Europe/Madrid`
  geography;
- optionally, a second active administrator for the dual-control source-plan
  deletion workflow.

The customer is topped up to a configurable balance through
`admin_adjust_credits`. That database function writes the immutable credit
ledger and admin audit atomically. The bootstrap does not create fake Stripe
customers, billing orders, or subscriptions; use Stripe Sandbox and signed
webhooks for billing acceptance tests.

## Local setup

Install Docker Desktop or Podman, then initialize and start Supabase:

```bash
npx --yes supabase@2.110.0 init
npx --yes supabase@2.110.0 start
npx --yes supabase@2.110.0 db reset --local
npx --yes supabase@2.110.0 status
```

Copy `.env.example` to `.env.local` and use the local API URL, publishable key,
and secret/service-role key reported by `supabase status`. `.env.local` is
ignored by Git.

Set unique, strong credentials using reserved `.test` email addresses:

```dotenv
CUADRABOT_PROVISION_TEST_ACCOUNTS=true
CUADRABOT_TEST_ADMIN_EMAIL=admin@cuadrabot.test
CUADRABOT_TEST_ADMIN_PASSWORD=<unique-strong-password>
CUADRABOT_TEST_USER_EMAIL=customer@cuadrabot.test
CUADRABOT_TEST_USER_PASSWORD=<different-strong-password>
CUADRABOT_TEST_USER_CREDITS=5000
```

You can omit the two password values and let the bootstrap generate them:

```dotenv
CUADRABOT_GENERATE_TEST_PASSWORDS=true
```

Generated passwords are cryptographically random and saved with their test
email addresses in `.env.test-accounts.local`. The file is ignored by Git,
written atomically with mode `0600`, and loaded automatically on later runs.
The command prints only its absolute path—never the credential values. The
Supabase secret key remains exclusively in `.env.local`.

To exercise dual-control archive deletion, also set:

```dotenv
CUADRABOT_TEST_APPROVER_EMAIL=approver@cuadrabot.test
CUADRABOT_TEST_APPROVER_PASSWORD=<third-unique-strong-password-or-empty>
```

Passwords must be at least 16 characters and include uppercase, lowercase,
number, and symbol characters. Every account must use a distinct password. If
password generation is enabled, an approver password is generated whenever an
approver email is configured and its password is empty.

Run:

```bash
npm run test:accounts:provision
```

Rerunning is safe. Existing Auth users are updated instead of duplicated,
profiles are upserted to the intended active role, and credits are added only
when the customer is below the configured target. Credit allocation uses the
customer ID, target, and current credit-account version as its idempotency key.
The command never prints passwords or Supabase keys.

## Dedicated remote sandbox

Never run the bootstrap against production. Link and migrate only a dedicated
test project:

```bash
npx --yes supabase@2.110.0 login
npx --yes supabase@2.110.0 link --project-ref <sandbox-project-ref>
npx --yes supabase@2.110.0 db push --dry-run
npx --yes supabase@2.110.0 db push
```

Use that sandbox's URL and keys in `.env.local`, keep
`NEXT_PUBLIC_SITE_URL=http://localhost:3000`, and explicitly bind approval to
the exact project:

```dotenv
CUADRABOT_ALLOW_REMOTE_TEST_PROVISIONING=true
CUADRABOT_TEST_PROJECT_REF=<sandbox-project-ref>
```

The command requires HTTPS and verifies that the Supabase host is exactly
`<sandbox-project-ref>.supabase.co`. It also refuses to run when `NODE_ENV`,
`VERCEL_ENV`, or `CUADRABOT_ENVIRONMENT` is `production`, or when
`NEXT_PUBLIC_SITE_URL` is not loopback.

Do not run `supabase db reset --linked` against any persistent project and do
not include test seed data in a production migration push.

## Acceptance checks

After provisioning:

1. Sign in as the customer and confirm `/dashboard` loads in the normal
   customer role with the configured credit balance.
2. Confirm the customer is redirected away from `/admin`.
3. Sign in as the primary admin and confirm both `/dashboard` and `/admin`
   load.
4. Confirm Admin → Users shows the customer in Madrid, Spain.
5. If the approver is configured, request source-plan deletion as one admin
   and approve/finalize it as the other.
6. Exercise purchases and subscriptions only through Stripe Sandbox Checkout
   and the signed webhook.
