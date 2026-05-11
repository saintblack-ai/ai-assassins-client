# ARCHAIOS Business Launch Checklist

## Business Formation

- Form ARCHAIOS LLC / chosen legal entity.
- Confirm business name availability.
- Obtain EIN from IRS.
- Create operating agreement.
- Open business bank account.
- Obtain Alabama/local business privilege license.
- Track Alabama Business Privilege Tax filing requirements.

## Platform Activation

- Complete Stripe business profile.
- Connect business bank account to Stripe.
- Add legal business name to app footer/terms.
- Prepare privacy policy and terms of service.
- Confirm production domain.
- Set production env variables only in deployment dashboards.

## ARCHAIOS / AI Assassins Technical Status

- Local Vite app runs at http://localhost:5173.
- Dashboard UI loads.
- Pricing modal loads.
- Supabase files present.
- Vercel config present.
- Stripe agent/pricing files present.
- Worker deployment not yet confirmed.
- Production checkout not enabled until business banking and Stripe are ready.

## Safety Rules

- Never commit .env files.
- Never expose API keys.
- Never put Stripe secret keys in frontend code.
- Use VITE_ only for safe public frontend values.
