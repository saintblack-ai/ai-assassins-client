-- ARCHAIOS / AI Assassins restored-core subscription repair
-- Prepared 2026-09-27. SAFE STAGING FILE ONLY: do not run in production until reviewed.
--
-- Purpose:
-- 1. Bring the restored subscriptions table up to the contract used by the current app.
-- 2. Support Stripe subscription lifecycle reconciliation without deleting legacy columns/data.
-- 3. Add idempotency/index support needed by the Stripe webhook.
--
-- This migration is intentionally additive and non-destructive.

begin;

alter table public.subscriptions
  add column if not exists created_at timestamptz default now(),
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists monthly_amount numeric not null default 0,
  add column if not exists billing_state text,
  add column if not exists last_stripe_event_id text;

create unique index if not exists subscriptions_stripe_subscription_id_uidx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists subscriptions_user_updated_idx
  on public.subscriptions (user_id, updated_at desc);

-- The existing Edge Function upserts revenue_summary using scope.
-- The restored database currently has no unique scope index, so add one.
create unique index if not exists revenue_summary_scope_uidx
  on public.revenue_summary (scope)
  where scope is not null;

commit;

-- Post-apply validation (read-only):
-- select column_name, data_type from information_schema.columns
-- where table_schema='public' and table_name='subscriptions'
-- order by ordinal_position;
--
-- select indexname, indexdef from pg_indexes
-- where schemaname='public'
-- and tablename in ('subscriptions','revenue_summary')
-- order by tablename,indexname;
