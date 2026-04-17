# Vercel Route Fix

Generated: 2026-04-17

## Problem

The Vercel production alias currently loads the root route and dashboard route, but several direct SPA routes return `404`:

- `https://ai-assassins-client.vercel.app/landing`
- `https://ai-assassins-client.vercel.app/pricing`
- `https://ai-assassins-client.vercel.app/operator`
- `https://ai-assassins-client.vercel.app/book-growth`

Current observed live status before deployment of this fix:

| Route | Status |
|---|---:|
| `/` | `200` |
| `/landing` | `404` |
| `/pricing` | `404` |
| `/dashboard` | `200` |
| `/operator` | `404` |
| `/book-growth` | `404` |

## Cause

The local repo had a `vercel.json` rewrite file, but it was untracked and therefore not part of the deployed Vercel project state.

The previous local rewrite list was also route-specific. That would only cover known routes and could miss future SPA routes.

## Fix

`vercel.json` now uses a single Vite SPA fallback rewrite:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This makes Vercel serve the React app shell for direct client-side routes including:

- `/landing`
- `/pricing`
- `/dashboard`
- `/operator`
- `/book-growth`
- `/links`
- `/admin`

## Files Changed

- `vercel.json`
- `docs/VERCEL_ROUTE_FIX.md`

## Validation Performed Locally

Local config inspection confirms:

- `vercel.json` exists at repo root.
- `vercel.json` parses as valid JSON.
- Vercel CLI is installed and authenticated.
- Vercel sees the existing `ai-assassins-client` production deployment.
- Existing production deployment is still 3 days old and therefore does not include this local route fix.
- `npm run build` completes successfully with the updated Vercel config present.

## Post-Deployment Validation

After deploying the current repo state to Vercel, verify:

```bash
curl -L -s -o /dev/null -w '%{http_code}\n' https://ai-assassins-client.vercel.app/landing
curl -L -s -o /dev/null -w '%{http_code}\n' https://ai-assassins-client.vercel.app/pricing
curl -L -s -o /dev/null -w '%{http_code}\n' https://ai-assassins-client.vercel.app/dashboard
curl -L -s -o /dev/null -w '%{http_code}\n' https://ai-assassins-client.vercel.app/operator
curl -L -s -o /dev/null -w '%{http_code}\n' https://ai-assassins-client.vercel.app/book-growth
```

Expected result:

```text
200
200
200
200
200
```

## Deployment Boundary

This change does not deploy anything.

To make it live, the repo must be deployed to Vercel after this file is committed or otherwise included in the deployment artifact.
