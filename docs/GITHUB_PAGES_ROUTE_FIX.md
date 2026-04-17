# GitHub Pages Route Fix

Generated: 2026-04-17

## Problem

Direct GitHub Pages routes for the React single-page app returned GitHub's default `404` page:

- `/ai-assassins-client/landing`
- `/ai-assassins-client/pricing`
- `/ai-assassins-client/dashboard`
- `/ai-assassins-client/operator`
- `/ai-assassins-client/book-growth`

The root route loaded correctly:

- `/ai-assassins-client/`

## Cause

GitHub Pages serves static files. A browser request for `/ai-assassins-client/pricing` looks for a deployed file at `pricing/index.html`.

The workflow already had a SPA fallback step that copied `dist/index.html` to `dist/404.html`, but that only helps the browser render the app after GitHub Pages has already returned a `404` response. It does not make the direct route return HTTP `200`.

## Fix

The GitHub Pages workflow now creates route-specific static shell files after `npm run build`:

- `dist/landing/index.html`
- `dist/pricing/index.html`
- `dist/dashboard/index.html`
- `dist/operator/index.html`
- `dist/book-growth/index.html`

It also keeps:

- `dist/404.html`

This makes known direct routes resolve as real static files while preserving the generic SPA fallback for unexpected routes.

## Files Changed

- `.github/workflows/deploy.yml`
- `docs/GITHUB_PAGES_ROUTE_FIX.md`

## Base Path Handling

`vite.config.js` already sets the GitHub Pages base path in GitHub Actions:

```js
return `/${repoName}/`;
```

For this repo, the expected production base is:

```text
/ai-assassins-client/
```

The local GitHub Actions-style build confirmed that generated HTML references assets under:

```text
/ai-assassins-client/assets/
```

## Validation Commands

Local artifact validation:

```bash
GITHUB_ACTIONS=true GITHUB_REPOSITORY=saintblack-ai/ai-assassins-client GITHUB_REPOSITORY_OWNER=saintblack-ai npm run build
cp dist/index.html dist/404.html
for route in landing pricing dashboard operator book-growth; do mkdir -p "dist/${route}" && cp dist/index.html "dist/${route}/index.html"; done
find dist -maxdepth 2 -name index.html -o -name 404.html
```

Expected artifact files:

```text
dist/index.html
dist/404.html
dist/landing/index.html
dist/pricing/index.html
dist/dashboard/index.html
dist/operator/index.html
dist/book-growth/index.html
```

Post-deployment live checks:

```bash
curl -L -s -o /dev/null -w '%{http_code}\n' https://saintblack-ai.github.io/ai-assassins-client/landing
curl -L -s -o /dev/null -w '%{http_code}\n' https://saintblack-ai.github.io/ai-assassins-client/pricing
curl -L -s -o /dev/null -w '%{http_code}\n' https://saintblack-ai.github.io/ai-assassins-client/dashboard
curl -L -s -o /dev/null -w '%{http_code}\n' https://saintblack-ai.github.io/ai-assassins-client/operator
curl -L -s -o /dev/null -w '%{http_code}\n' https://saintblack-ai.github.io/ai-assassins-client/book-growth
```

Expected result after the workflow deploys:

```text
200
200
200
200
200
```

## Current Live Status

Before deployment of this workflow fix, live GitHub Pages still returns `404` for the direct routes because the live artifact does not yet include those route-specific `index.html` files.

## Local Validation Result

Validated locally on 2026-04-17 by serving the generated artifact under `/ai-assassins-client/`.

| Route | Local HTTP Status |
|---|---:|
| `/ai-assassins-client/landing/` | `200` |
| `/ai-assassins-client/pricing/` | `200` |
| `/ai-assassins-client/dashboard/` | `200` |
| `/ai-assassins-client/operator/` | `200` |
| `/ai-assassins-client/book-growth/` | `200` |
| `/ai-assassins-client/` | `200` |
