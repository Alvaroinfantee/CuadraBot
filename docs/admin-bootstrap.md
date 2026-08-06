# One-time administrator bootstrap

Cuadrabot has no environment-variable admin password and no permanent recovery
backdoor. Administrator recovery requires all three of the following:

1. an active, authenticated Supabase user with a confirmed email;
2. an unconsumed grant provisioned for that exact lowercase email; and
3. a 256-bit, 64-character lowercase hexadecimal key that expires within 24
   hours.

The database stores only `SHA-256(raw_key)` as 32 bytes. The raw key must be
generated and delivered out of band, must never be committed or placed in an
environment variable, and must be destroyed after delivery.

## Provisioning checklist

1. Apply `20260806192139_admin_bootstrap_recovery.sql`.
2. Create or identify the intended Supabase Auth user and confirm the email.
3. Generate 32 random bytes in an approved secret-management environment.
4. Compute the SHA-256 digest of the exact 64-character lowercase hexadecimal
   key.
5. Insert only the email, digest, and a short expiry through the protected SQL
   console. The insert should have this shape; replace placeholders with the
   lowercase email and 64-character digest, never the raw key:

   ```sql
   insert into private.admin_bootstrap_grants (
     email,
     key_digest,
     expires_at
   )
   values (
     '<confirmed-email>',
     decode('<sha256-digest-hex>', 'hex'),
     now() + interval '1 hour'
   );
   ```

6. Deliver the raw key once over a separate secure channel. The recipient must
   sign in with the provisioned email and redeem it at `/admin-bootstrap`.
7. Verify `used_at`, `used_by`, the `redeemed` attempt, and the
   `admin_bootstrap_redeemed` admin audit event. Revoke an unused grant if the
   delivery channel or recipient is in doubt.

Redemption, role promotion, single-use consumption, throttling, and audit are
one database transaction. Five failed attempts by one user or fifteen from one
keyed IP fingerprint within 15 minutes trigger the cooldown. Responses do not
reveal whether the email, key, expiry, or used state was wrong.

An account that is already an active administrator may also redeem a grant.
That consumes and audits the recovery key without changing its role, which lets
an operator verify a newly issued recovery capability for the existing owner.
The private tables are outside the exposed Data API schema; RLS and explicit
revokes remain enabled as defense in depth.
