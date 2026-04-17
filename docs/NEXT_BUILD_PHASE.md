# ARCHAIOS Next Build Phase

Generated: 2026-04-17

## Phase Name

Auth and Tier Gating Cleanup

## Objective

Turn the current live routes into a clearer revenue-ready product path without activating billing or changing infrastructure. The immediate priority is to separate Free, Pro, and Elite experiences cleanly in the client while keeping Cloudflare Worker as the backend source of truth.

## Scope

This phase is allowed to:

- Clarify Free / Pro / Elite UX.
- Centralize tier rules in reusable helpers.
- Improve locked-state messaging.
- Prepare Stripe checkout UI paths without activating billing.
- Add tests around subscription and feature-gate behavior.
- Document required backend and Stripe environment variables.

This phase is not allowed to:

- Enable live billing.
- Change Stripe products or prices.
- Change DNS.
- Deploy publicly without approval.
- Store secrets in source files.
- Replace the Cloudflare Worker backend.

## Implemented In This Pass

- Added a centralized tier experience model in `src/lib/subscription.js`.
- Added explicit access flags for preview, full briefing, billing management, and elite reports.
- Added reusable feature gate state helpers.
- Updated dashboard copy to show the active experience layer.
- Updated locked content copy so inactive/free users see clearer upgrade reasoning.
- Updated pricing cards to show plan-specific experience promises.
- Added subscription helper tests for tier experience and gate behavior.

## Target Experience Separation

| Tier | Experience | Access |
| --- | --- | --- |
| Free | Preview shell | Delayed teaser briefing, locked premium actions, upgrade prompts |
| Pro | Command dashboard | Full daily briefing, premium categories, saved history, paid AI surfaces |
| Elite | Priority command | Priority signals, elite reports, deeper analytics, future operator features |

## Stripe Preparation State

Stripe should remain in preparation mode until manually approved:

- Client can request checkout for Pro and Elite.
- Checkout still depends on authenticated session and backend Worker configuration.
- Missing Stripe credentials should produce safe errors, not broken UI.
- No secret keys are hardcoded.
- No automatic billing activation was performed.

## Validation Checklist

- `node --test src/lib/subscription.test.js`
- `npm run build`
- Open `/pricing` and confirm Free, Pro, Elite copy is distinct.
- Open `/dashboard?mock=1` and confirm preview/locked state is readable.
- Confirm checkout still blocks signed-out users.
- Confirm no code path hardcodes Stripe secret keys.

## Next Safe Work Items

- Add a small tier matrix component shared by pricing and dashboard.
- Add checkout readiness indicators from backend configuration once the Worker exposes them.
- Add Supabase session/tier mock fixtures for local UI testing.
- Add analytics events for `pricing_view`, `checkout_blocked_auth`, and `upgrade_intent` if not already present.
- Add operator panel rows for billing readiness, Stripe webhook readiness, and Supabase auth readiness.

## Approval Boundary

The next boundary that requires explicit approval is any action that changes live billing, deploys production infrastructure, updates DNS, or writes real Stripe/Supabase/Cloudflare secrets.
