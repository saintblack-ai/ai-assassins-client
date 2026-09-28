# ARCHAIOS Billing / Subscription Repair Audit
Prepared: 2026-09-27
Branch: `repair/2026-09-27-subscription-sync`

## Safety state

This branch is preparation only.

- No production migration has been applied.
- No Stripe product, price, customer, subscription, payment link, or webhook endpoint has been changed.
- No Cloudflare/Vercel deployment has been triggered.
- No secrets are stored in this branch.

## Verified live state

### Stripe

The connected live Stripe account is **QX Technology**.

Verified active recurring products relevant to AI Assassins:

| Tier | Stripe product | Live recurring price |
| --- | --- | ---: |
| Pro | `prod_UEkghCBxek5btm` | $49/month |
| Elite | `prod_UEkjAlfX4aTXLE` | $99/month |

The current public client copy had drifted to $49.99 / $99.99.

The enabled Stripe webhook endpoint currently points to the Supabase Edge Function:

`https://pedymtymubpirhaikymj.supabase.co/functions/v1/stripe-webhook`

At audit time it listens only for:

- `invoice.payment_succeeded`
- `invoice.payment_failed`

That is enough for revenue events, but not enough to keep the app's subscription tier/status synchronized.

### Supabase

Project: `ai-assassins-db` (`pedymtymubpirhaikymj`)
Status: active / healthy.

The restored `public.subscriptions` table currently contains the legacy core:

- `id`
- `user_id`
- `plan`
- `status`
- `updated_at`

Current client/backend code also references subscription lifecycle metadata such as Stripe customer/subscription IDs, current-period end, cancellation state, and creation time.

The current `revenue_summary` table does not have a unique index on `scope`, even though the existing Edge Function attempts an upsert with `onConflict: "scope"`.

## Confirmed integration gaps

1. **Elite checkout gap** — the Worker resolves a Stripe price only for Pro.
2. **Tier drift** — the Worker webhook helper hard-codes `plan: "pro"`.
3. **Lifecycle gap** — Worker webhook logic only handles checkout completion and subscription creation; it ignores subscription updates and deletions.
4. **Active Stripe webhook gap** — the actual live webhook is the Supabase Edge Function, not the Worker webhook route, and it currently receives invoice events only.
5. **Revenue summary drift risk** — the existing Edge Function increments MRR and active subscriptions every time a successful invoice arrives. Repeated monthly invoices can overstate those metrics.
6. **Client schema mismatch** — `getUserTier()` queries `tier` and `created_at`, while the restored database uses `plan` and currently has no `created_at`.
7. **Price copy drift** — frontend displayed $49.99/$99.99 while Stripe is $49/$99.

## Safe repair order

1. Review the staged additive migration in `supabase/sql/2026-09-27_restore_subscription_sync.sql`.
2. Review the staged Supabase Edge Function source before any deployment.
3. Review Worker/client changes on this branch.
4. Run client build and any Worker validation in a non-production environment.
5. Only after owner approval:
   - apply the database migration;
   - deploy the repaired Edge Function;
   - update the Stripe webhook event selection;
   - configure Worker `STRIPE_PRICE_PRO` and `STRIPE_PRICE_ELITE`;
   - deploy Worker/client;
   - run a test checkout using a controlled test path before accepting general traffic.

## Required Stripe webhook event set after repair

Keep invoice events and add:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

No live webhook settings were changed during this audit.
