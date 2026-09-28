# ARCHAIOS Billing Repair — Resume Runbook
Prepared: 2026-09-27

Use this after Codex / desktop usage resets.

## Current safe checkpoint

Working branch:

`repair/2026-09-27-subscription-sync`

Main branch and production services have not been changed by this repair pass.

## Do not do these first

Do not merge to `main`.
Do not deploy the Worker.
Do not deploy the Supabase Edge Function.
Do not change the live Stripe webhook event list.
Do not enable general checkout traffic.

The database migration must be reviewed and applied before code that queries the new subscription columns is deployed.

## Review order

1. Review:
   - `docs/2026-09-27_BILLING_SUBSCRIPTION_REPAIR_AUDIT.md`
   - `supabase/sql/2026-09-27_restore_subscription_sync.sql`
   - `supabase/functions/stripe-webhook/index.ts`
   - `worker/index.js`
   - `src/lib/platform.js`
   - `src/lib/pricing.js`
   - `src/App.jsx`

2. Validate the client build.

3. Validate Worker syntax / dry-run packaging without deploying.

4. Review the migration for additive-only behavior.

5. Apply the migration only after owner approval.

6. Re-run Supabase security/performance advisors after the migration.

7. Deploy the repaired Supabase `stripe-webhook` function only after the schema exists.

8. Update the existing Stripe webhook endpoint to include:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

9. Configure Worker deployment environment:
   - `STRIPE_PRICE_PRO=price_1TGHBW2E09QnDRssi68AAji4`
   - `STRIPE_PRICE_ELITE=price_1TGHEP2E09QnDRss16xkuUXy`
   - existing Stripe/Supabase secrets stay in the deployment secret store only.

10. Deploy Worker/client only after the above checks pass.

## Acceptance checks

Before merging, verify all of the following:

- Signed-out checkout is rejected.
- Pro checkout requests the Pro price.
- Elite checkout requests the Elite price.
- Checkout metadata contains both `user_id` and `tier`.
- `GET /api/subscription` returns only the authenticated user's record.
- Successful checkout produces a subscription row.
- Subscription update changes status/current-period/cancellation state.
- Subscription deletion/cancellation removes paid access by changing status.
- Replaying the same invoice event does not double-count revenue.
- A second monthly invoice does not increment `active_subscriptions` again.
- MRR is derived from active subscription rows rather than accumulated invoice history.
- Billing portal only opens for the authenticated user's Stripe customer.
- Free users remain free when no subscription row exists.
- Frontend pricing shows exactly $49/month and $99/month.

## Stop condition

If production table identity, existing row counts, Stripe product/price IDs, webhook destination, or deployment target differs from the audit, stop and re-audit before applying anything.
