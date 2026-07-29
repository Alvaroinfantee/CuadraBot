# Admin metric definitions

The admin dashboard reads one service-role-only database aggregate,
`get_admin_analytics_snapshot`. Headline totals and charts are calculated in
Postgres across the complete dataset. The bounded row queries in the app are
only for recent operator drill-down tables.

## Commercial metrics

- **30-day paid revenue:** gross USD amounts actually reported by processed,
  signature-verified Stripe events. One-time purchases use paid Checkout
  Session `amount_total`; initial and renewal subscriptions use Invoice
  `amount_paid`. Stripe object IDs are deduplicated, so async Checkout events
  and webhook retries cannot double count. Refunds are shown separately and
  are not subtracted from this gross receipts metric.
- **Catalog MRR:** current list-price monthly value of subscriptions whose
  latest Stripe status is `active`. Annual catalog prices, if introduced, are
  divided by 12. Discounts, taxes, credits, and past-due subscriptions are
  excluded, so this is deliberately labeled catalog MRR rather than realized
  recurring revenue.
- **Subscription net change:** processed, paid initial subscription invoices in
  the last 30 days minus subscriptions canceled in the same period. A
  subscription that starts and cancels inside the window therefore contributes
  zero; current status alone is not treated as historical inventory.
- **Available credit liability:** the sum of every current credit balance.

## Product and quality metrics

- **30-day funnel:** customers whose draft was created in the last 30 days,
  deduplicated by takeoff job. Draft, verified quote, credit confirmation, and
  delivery use product analytics events. Processor completion uses the
  immutable `automation_completed` takeoff job event.
- **Repeat company rate:** customers with more than one confirmed job divided
  by customers with at least one confirmed job. Drafts, unverified uploads,
  ready quotes, and canceled jobs are excluded.
- **Failure rate:** jobs reaching a completed or failed terminal timestamp in
  the last 30 days, with failures as the numerator.
- **On-time rate:** jobs completed in the last 30 days with a due timestamp,
  where `completed_at <= due_at`.
- **Correction rate:** jobs delivered in the last 30 days that later recorded a
  `correction_requested` event, deduplicated by job.
- **Annotation coverage:** counted units less skipped annotations, divided by
  counted units, for jobs completed in the last 30 days.

## Geography, usage, and readiness

- Geography counts registered profiles by coarse country and region only.
  Complete billing addresses remain in Stripe.
- Weekly usage uses eight UTC calendar weeks and counts created jobs and their
  verified input pages. The current week is partial.
- Stripe readiness counts failed events plus `received` or `processing` events
  that have not advanced for 10 minutes.
- Worker, processor, and reconciler health reports are required and expiring.
  Missing, expired, `unknown`, or non-healthy reports are never labeled
  healthy.

Every snapshot includes an `asOf` timestamp. Admin pages fail closed if the
aggregate is missing a required metric or returns an invalid shape.
