# ARCHAIOS Host Role Decision

Generated: 2026-04-17

## Decision

Vercel should be the primary host for the AI Assassins / ARCHAIOS client app. GitHub Pages should remain a static backup shell and public mirror. Cloudflare Worker should remain the backend, API, and health layer.

This keeps the production app on the platform best suited for SPA routing, environment variables, preview deployments, and future server-adjacent features while preserving GitHub Pages as a resilient static fallback.

## Primary Host Roles

| Surface | Primary Host | Primary URL | Backup / Mirror |
| --- | --- | --- | --- |
| Public landing | Vercel | `https://ai-assassins-client.vercel.app/landing` | `https://saintblack-ai.github.io/ai-assassins-client/landing` |
| Pricing / upgrade flow | Vercel | `https://ai-assassins-client.vercel.app/pricing` | `https://saintblack-ai.github.io/ai-assassins-client/pricing` as read-only fallback |
| Authenticated dashboard | Vercel | `https://ai-assassins-client.vercel.app/dashboard` | `https://saintblack-ai.github.io/ai-assassins-client/dashboard` as static fallback |
| Operator / admin shell | Vercel | `https://ai-assassins-client.vercel.app/operator` | `https://saintblack-ai.github.io/ai-assassins-client/operator` as static fallback |
| Book Growth Command | Vercel | `https://ai-assassins-client.vercel.app/book-growth` | `https://saintblack-ai.github.io/ai-assassins-client/book-growth` |
| Backend health / APIs | Cloudflare Worker | `https://archaios-saas-worker.quandrix357.workers.dev/api/health` | none currently |

## Cloudflare Worker Role

Cloudflare Worker should stay focused on backend responsibilities:

- Health endpoint.
- Supabase-backed API endpoints.
- Stripe checkout/session endpoints.
- Subscription and tier resolution.
- Alert and dashboard payload APIs.
- Future edge security, rate limiting, and routing.

The Worker should not replace the Vercel frontend host unless a future Worker/Pages migration is explicitly approved.

## GitHub Pages Role

GitHub Pages should remain:

- Static backup shell.
- Public mirror for direct-route resilience.
- Emergency fallback if Vercel is unavailable.
- Lightweight portfolio/public access layer.

GitHub Pages should not be the primary paid-app host because authenticated billing flows, environment handling, and future production app operations are cleaner on Vercel plus Cloudflare Worker.

## Vercel Role

Vercel should become the main app host because it is currently serving all direct routes and is the right place for:

- Primary SPA delivery.
- Production and preview deployments.
- Main dashboard access.
- Pricing and upgrade UX.
- Future custom domain attachment.
- Future analytics and conversion instrumentation.

## Current Recommendation

Use this split:

- `Vercel`: primary app experience.
- `Cloudflare Worker`: backend/API/health/security layer.
- `GitHub Pages`: static fallback and public mirror.

## Operational Boundary

No DNS changes, deployment changes, billing changes, or secret updates were made as part of this decision. This document defines the role split only.

## Next Action

- Keep building auth and tier-gated UX against the Vercel primary host.
- Keep Cloudflare Worker as the backend source of truth for subscription status.
- Use GitHub Pages only as a backup/static shell unless explicitly promoted later.
