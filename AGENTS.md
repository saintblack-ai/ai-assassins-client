# AI Assassins / ARCHAIOS Agent System

This dashboard is the premium control layer for the ARCHAIOS monetized intelligence platform.

## Agent Roles

- `Content Agent`
  Generates daily post packs and publishing-ready scripts.
- `Marketing Agent`
  Builds campaigns, captions, hooks, and offer framing.
- `Traffic Agent`
  Recommends channel strategy, acquisition shifts, and CTA routing.
- `Intelligence Agent`
  Produces the user-facing daily intelligence brief.
- `Conversion Agent`
  Improves landing page messaging and upgrade urgency.
- `Analytics Agent`
  Tracks engagement, subscriber momentum, and revenue posture.

## Frontend Responsibilities

- Display live intelligence panels, alerts, and monetization controls.
- Enforce tier-aware UI locks for `free`, `pro`, and `elite`.
- Authenticate users with Supabase.
- Start Stripe checkout for paid tiers.
- Render server-generated platform feed and agent outputs.

## Backend Responsibilities

- Verify Supabase sessions and resolve user tier.
- Store leads and alert history in Supabase.
- Create Stripe checkout sessions and process Stripe webhooks.
- Generate the dashboard platform payload consumed by the React client.
- Expose premium-aware API endpoints for alerts, subscriptions, and agent outputs.

## API Surface Used By The Client

- `GET /api/subscription`
- `GET /api/alerts`
- `DELETE /api/alerts`
- `POST /api/stripe/checkout`
- `POST /api/leads`
- `GET /api/platform/dashboard`

## Monetization Rules

- `Free`
  Limited intelligence mode, delayed high-threat alerts, locked advanced actions.
- `Pro`
  Full dashboard actions and premium agents.
- `Elite`
  Priority signals and full analytics visibility.
