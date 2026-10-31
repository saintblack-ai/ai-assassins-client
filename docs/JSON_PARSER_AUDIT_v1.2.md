# JSON parser audit — API repair v1.2

Read-only full first-party repository inventory at base `b192242371d4e92fb9ad57a2adfc8ed38acf69d3`, followed by scoped candidate changes. Search: `rg` for `.json(`, `JSON.parse`, and parsing catches. Dependency trees, build output and `.git` are generated surfaces; checked-in `docs/assets` was identified as an old generated bundle, not edited. No environment or credential values inspected.

## Affected platform reads — fixed

| Base source location | Contract / issue | Candidate handling |
| --- | --- | --- |
| src/lib/platform.js:201 | Shared platform API (`/api/platform/dashboard`, subscription, alerts, lead/billing/CTA calls); successful HTML/malformed JSON was swallowed into null | `readApiJson` rejects invalid successful responses; HTTP status handling preserved. No mutation endpoint exercised. |
| src/pages/Dashboard.jsx:606–610 | Direct `/api/health` bypass lacked status/media-type validation; Boolean coercion accepted truthy non-boolean `ok`; dashboard failure was silently swallowed | Strict object reader and `ok === true`; failed health still permits independent dashboard read; visible error message and health=false. Dashboard API failure surfaces a message. |
| src/pages/Dashboard.jsx:630–641 | Authenticated admin API bypass could accept HTTP-success null after parse failure | Same strict object reader; non-2xx errors remain errors, invalid successful objects rejected. No admin read or authenticated mutation performed by this audit. |

`dashboardApiRead.test.js` executes the shared helper used by health/admin. It covers HTML, malformed/null/scalar/array bodies, HTTP error JSON and valid object envelopes. This is transport/envelope validation, not proof of backend/auth readiness. Full health/dashboard response contracts are separately checked by the release checker.

Entry-path distinction: `src/main.jsx` imports `App.jsx`; the current `App.jsx` does not import `src/pages/Dashboard.jsx`. The latter is a dormant alternate page with unresolved existing `CommandNav`/`mockPlatform` imports in this base. Its bypasses were corrected in place for future reuse, without wiring it into the production entry or claiming a browser test of that dormant page. The shipped `App.jsx` dashboard uses `platform.js`.

## Separate contracts — intentionally unchanged

| Base source location | Contract and parse behavior |
| --- | --- |
| src/api/news.js:50 | Third-party NewsAPI, with HTTP and `status` checks; parse failure enters explicitly mock fallback. Separate provider contract. |
| src/api/stocks.js:48 | Alpha Vantage provider response; HTTP and rate-limit checks. Parse failure handled by enclosing quote/feed fallback. Separate provider contract. |
| src/api/sitrep.js:91 | ACLED provider response; HTTP checked then parsed; failure enters mock fallback. Provider provenance/default-coordinate/metric concerns remain separately scoped. |
| worker/index.js:215 | Server-side Supabase request wrapper swallows parse failure; endpoint-specific arrays/objects and potential empty response semantics need a separate backend review, not a blind frontend parser replacement. |
| worker/index.js:414 | Stripe checkout provider parse catch; missing result URL already throws. Payment code unchanged and untested live. |
| worker/index.js:455 | Incoming request-body parser returns `{}` on malformed JSON; not an API response parser. Input validation is route-specific and outside this routing repair. |
| worker/index.js:81 | JWT/base64 claims JSON parse; authentication contract, not platform response parsing. Unchanged. |
| worker/index.js:696 | Signed Stripe webhook event JSON; separate signature/body contract. Unchanged. |
| src/App.jsx:249 | Local-storage app state JSON with seed fallback; not network/API. Unchanged. |
| vite.config.js:11 | Build-time package metadata JSON with null fallback; not network/API. Unchanged. |
| docs/game/index.html:49; docs/game-v03/index.html:1; public/game-v03/index.html; public/game-v04/index.html | SPYMASTER local-storage/game JSON only. No platform API response path; unchanged. |
| docs/assets/index-CsLiznXB.js | Historical generated application/dependency bundle with compiled parses; rebuilding the preview uses current source. Existing Pages artifact left untouched. |

The bundled `worker/index.js` serves the daily-automation health shape (`service=archaios-daily-automation`, cron/jobs) and a preview dashboard shape. It is not proof of the actual deployed `archaios-core-api` Worker contract. Use observed direct Worker responses and the documented core contract for the release gate; do not silently accept either arbitrary `{ok:true}` or the wrong service.

No parser was replaced merely because it used `.json()`. No structural pass verifies facts, sources, billing, or paid access. This audit did not modify evidence-validator code, providers, games, database schema, auth rules, or production configuration.
