# AI Assassins Client Readiness

## Current Status

The AI Assassins client repo is the public SaaS/app layer connected to ARCHAIOS Core.

## Detected Components

- Frontend app present
- package.json present
- Vercel config present
- Supabase folder present
- Worker code references Stripe and Supabase sync logic

## Known Environment Names

These names may be required depending on deployment:

- OPENAI_API_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_BACKEND_URL
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

## Next Checks

1. Verify package.json scripts.
2. Confirm Vercel deployment config.
3. Confirm Supabase SQL files.
4. Confirm Stripe checkout route.
5. Confirm Cloudflare Worker env variables.
6. Test local dashboard route.
7. Test checkout flow only after env variables are ready.

## Safety Rules

- Never commit .env files.
- Never expose API keys.
- Never put Stripe secret keys in frontend code.
- Use VITE_ variables only for safe public frontend values.
