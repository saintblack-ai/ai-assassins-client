# API routing repair — local candidate

Base: `b192242371d4e92fb9ad57a2adfc8ed38acf69d3`.
Branch: `repair/2026-10-31-api-routing`.

## Observed failure

On October 31, the public Vercel `/api/health` and `/api/platform/dashboard`
returned HTTP 200 and `text/html`: the 418-byte application shell.
The authenticated Vercel fetch connector independently confirmed the dashboard result.
Vercel production deployment metadata identifies the same base commit.

`resolveApiBaseUrl()` uses same-origin requests in production when
`VITE_BACKEND_URL` is absent. The checked-in catch-all rewrite sent these
requests to `index.html`. The client then swallowed JSON parsing errors and
could record a null response as success. This reproduces a concrete routing
failure; other configuration failures may also exist.

## Candidate changes

- Route `/api/:path*` to the existing Cloudflare Worker before the SPA fallback.
- Reject HTTP-success HTML, malformed JSON and null JSON responses.
- Preserve error payloads and HTTP status handling on unsuccessful requests.
- Provide a read-only release check: `node scripts/check-api.mjs BASE_URL`.

The backend destination comes from `docs/HOST_ROLE_DECISION.md`.
The rewrite follows https://vercel.com/docs/routing/rewrites.
An explicit `VITE_BACKEND_URL` continues to override same-origin routing.
GitHub Pages still requires an explicitly configured backend URL.

## Verification and limits

- `node --test src/lib/*.test.js`: 10 passed (6 existing, 4 new).
- Fresh lockfile install and production build passed in an isolated Linux
  directory. The repository's tracked Mac dependencies could not build on
  Linux because the native Rollup binary was absent; originals were preserved.
- The release checker is exercised against local JSON and HTML fixtures.
- `git diff --check`: passed.
- Direct Worker reads returned 403 from this execution environment. This does
  not establish whether Cloudflare or the execution network denied the requests.
- No remote rewrite execution, real authenticated flow, billing, or database
  recovery has been verified. The pasted 28-test/256-comparison local results
  were not independently reproduced in this remote checkout.

## Release gate

This is a local candidate, not a deployed repair. Before release, authorize a
preview, verify that the Worker is reachable from Vercel, then run the read-only
checker against that preview. Confirm dashboard response shape, authenticated
access, Authorization and query forwarding, and a direct SPA route. Do not
perform checkout or database mutations as smoke tests.

Keep Supabase activation, Stripe readiness and historical credential remediation
as separately scoped work. Do not infer their readiness from a green health URL.
Production deployment and PR #2 remain untouched.

## v1.2 owner-authorized preview review

This revision supersedes v1.1's release checker; no production release is authorized.
The strict checker supports `--mode=anonymous|authenticated|both` and explicit
`--anonymous-dashboard-status=200|401`. A JSON 401 expected for anonymous use
reports AUTH_REQUIRED, never authenticated success. Health requires the public
core identity, matching release/version, UTC timestamp and dependency states.
Dashboard HTTP 200 must match pricing/user/premium/feed/agent/revenue/analytics/
briefing structure; authenticated mode also requires a non-null user identity.
HTTP 200 HTML, malformed JSON and null fail. Inactive dependencies never prove
paid readiness; even every contract pass keeps productionReady=false.

Run read-only checks:

```
node --test src/lib/*.test.js scripts/*.test.mjs
npm run build
node scripts/check-api.mjs https://PREVIEW_HOST --mode=both
```

Use API_CHECK_BEARER_TOKEN only from an already-configured secure environment.
Never pass token flags, URLs, command-line values or paste credentials into chat.
Missing configured authentication exits 2 while completing anonymous checks.
Exit 1 means a failed check; exit 0 means only requested contract checks passed.
Vercel protection authentication is separate from application bearer auth.

Full parser audit: JSON_PARSER_AUDIT_v1.2.md. The dormant Dashboard page's direct
health/admin reads use strict object validation; provider/game/backend parsers
retain their separate contracts. .vercelignore excludes env files, .dev.vars,
tracked dependencies and old dist artifacts from deployment uploads. Existing
tracked artifacts are not removed by this PR (PR #2 remains untouched).

Preview target is the existing ai-assassins-client project in
saintblack-ais-projects; API rewrite is before SPA fallback, with no project-level
routing, production environment, protection, domain, or Worker configuration edits.
Preview env metadata access is denied by the connector; local Vercel CLI has no
usable authentication. No production values were pulled or copied. The routing
preview does not require a secret; real authenticated functionality remains a
release blocker unless a secure existing app session becomes available.

The earlier Worker 403's cause remains UNKNOWN. On this Mac, sandbox shell DNS
failed, but authorized network-enabled direct curl and Node checks reached JSON
200. A successful later request cannot identify the source of the earlier 403.
Final preview/forwarding evidence and tested revision belong in the versioned
handoff; configuration assertions are not proof of observed origin forwarding.
