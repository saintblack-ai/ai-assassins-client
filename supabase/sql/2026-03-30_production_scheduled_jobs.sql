-- Production scheduled jobs for ARCHAIOS / AI Assassins
--
-- Prerequisites
-- 1. Enable pg_cron from Supabase Dashboard -> Integrations -> Cron.
-- 2. Enable pg_net and Vault from Supabase Dashboard -> Database -> Extensions.
-- 3. Deploy the Edge Function named `subscription-reconciliation` before creating the cron jobs below.
-- 4. Replace the placeholder values in the Vault section before running this script in production.

create schema if not exists ops;

create table if not exists ops.analytics_daily_rollups (
  rollup_date date primary key,
  lead_submissions bigint not null default 0,
  cta_clicks bigint not null default 0,
  alerts_generated bigint not null default 0,
  active_subscriptions bigint not null default 0,
  pro_subscriptions bigint not null default 0,
  elite_subscriptions bigint not null default 0,
  source_tables jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function ops.table_exists(target_schema text, target_table text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.tables
    where table_schema = target_schema
      and table_name = target_table
  );
$$;

create or replace function ops.find_timestamp_column(target_schema text, target_table text, candidates text[])
returns text
language sql
stable
as $$
  select column_name
  from information_schema.columns
  where table_schema = target_schema
    and table_name = target_table
    and column_name = any(candidates)
  order by array_position(candidates, column_name)
  limit 1;
$$;

create or replace function ops.count_rows_for_date(target_schema text, table_candidates text[], date_column_candidates text[], target_date date)
returns table (table_name text, row_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_table text;
  selected_column text;
  sql text;
begin
  select candidate
  into selected_table
  from unnest(table_candidates) as candidate
  where ops.table_exists(target_schema, candidate)
  limit 1;

  if selected_table is null then
    return query select null::text, 0::bigint;
    return;
  end if;

  selected_column := ops.find_timestamp_column(target_schema, selected_table, date_column_candidates);

  if selected_column is null then
    return query select selected_table, 0::bigint;
    return;
  end if;

  sql := format(
    'select %L::text as table_name, count(*)::bigint as row_count
       from %I.%I
      where timezone(''utc'', %I)::date = $1',
    selected_table,
    target_schema,
    selected_table,
    selected_column
  );

  return query execute sql using target_date;
end;
$$;

create or replace function ops.run_daily_analytics_rollup(target_date date default ((timezone('utc', now()))::date - 1))
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_source record;
  cta_source record;
  alert_source record;
  active_count bigint := 0;
  pro_count bigint := 0;
  elite_count bigint := 0;
  sources jsonb := '{}'::jsonb;
begin
  select *
  into lead_source
  from ops.count_rows_for_date(
    'public',
    array['leads', 'lead_submissions'],
    array['created_at', 'submitted_at', 'timestamp'],
    target_date
  );

  select *
  into cta_source
  from ops.count_rows_for_date(
    'public',
    array['cta_clicks', 'cta_events'],
    array['created_at', 'clicked_at', 'timestamp'],
    target_date
  );

  select *
  into alert_source
  from ops.count_rows_for_date(
    'public',
    array['alerts'],
    array['timestamp', 'created_at'],
    target_date
  );

  if ops.table_exists('public', 'subscriptions') then
    select
      count(*) filter (where status in ('active', 'trialing')),
      count(*) filter (where status in ('active', 'trialing') and tier = 'pro'),
      count(*) filter (where status in ('active', 'trialing') and tier = 'elite')
    into active_count, pro_count, elite_count
    from public.subscriptions;
  end if;

  sources := jsonb_build_object(
    'leads', coalesce(lead_source.table_name, 'missing'),
    'cta_clicks', coalesce(cta_source.table_name, 'missing'),
    'alerts', coalesce(alert_source.table_name, 'missing'),
    'subscriptions', case when ops.table_exists('public', 'subscriptions') then 'subscriptions' else 'missing' end
  );

  insert into ops.analytics_daily_rollups (
    rollup_date,
    lead_submissions,
    cta_clicks,
    alerts_generated,
    active_subscriptions,
    pro_subscriptions,
    elite_subscriptions,
    source_tables,
    generated_at,
    updated_at
  )
  values (
    target_date,
    coalesce(lead_source.row_count, 0),
    coalesce(cta_source.row_count, 0),
    coalesce(alert_source.row_count, 0),
    active_count,
    pro_count,
    elite_count,
    sources,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (rollup_date)
  do update
    set lead_submissions = excluded.lead_submissions,
        cta_clicks = excluded.cta_clicks,
        alerts_generated = excluded.alerts_generated,
        active_subscriptions = excluded.active_subscriptions,
        pro_subscriptions = excluded.pro_subscriptions,
        elite_subscriptions = excluded.elite_subscriptions,
        source_tables = excluded.source_tables,
        generated_at = excluded.generated_at,
        updated_at = timezone('utc', now());

  return jsonb_build_object(
    'ok', true,
    'rollup_date', target_date,
    'lead_submissions', coalesce(lead_source.row_count, 0),
    'cta_clicks', coalesce(cta_source.row_count, 0),
    'alerts_generated', coalesce(alert_source.row_count, 0),
    'active_subscriptions', active_count,
    'pro_subscriptions', pro_count,
    'elite_subscriptions', elite_count,
    'source_tables', sources
  );
end;
$$;

create or replace function ops.invoke_subscription_reconciliation()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  service_role_key text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'supabase_project_url';

  select decrypted_secret into service_role_key
  from vault.decrypted_secrets
  where name = 'supabase_service_role_key';

  if project_url is null then
    raise exception 'Missing Vault secret: supabase_project_url';
  end if;

  if service_role_key is null then
    raise exception 'Missing Vault secret: supabase_service_role_key';
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/subscription-reconciliation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'job', 'daily-subscription-reconciliation',
      'triggered_at', timezone('utc', now())
    ),
    timeout_milliseconds := 10000
  )
  into request_id;

  return request_id;
end;
$$;

-- Vault secrets
-- Replace the placeholder values before execution.
do $$
declare
  project_url_secret_id uuid;
  service_role_secret_id uuid;
begin
  select id
  into project_url_secret_id
  from vault.secrets
  where name = 'supabase_project_url';

  if project_url_secret_id is null then
    perform vault.create_secret(
      'https://YOUR-PROJECT-REF.supabase.co',
      'supabase_project_url',
      'Supabase project URL used by pg_net cron invocations'
    );
  else
    perform vault.update_secret(
      project_url_secret_id,
      'https://YOUR-PROJECT-REF.supabase.co',
      'supabase_project_url',
      'Supabase project URL used by pg_net cron invocations'
    );
  end if;

  select id
  into service_role_secret_id
  from vault.secrets
  where name = 'supabase_service_role_key';

  if service_role_secret_id is null then
    perform vault.create_secret(
      'REPLACE_WITH_SERVICE_ROLE_JWT',
      'supabase_service_role_key',
      'Service role JWT used for subscription reconciliation cron invocations'
    );
  else
    perform vault.update_secret(
      service_role_secret_id,
      'REPLACE_WITH_SERVICE_ROLE_JWT',
      'supabase_service_role_key',
      'Service role JWT used for subscription reconciliation cron invocations'
    );
  end if;
end;
$$;

-- Idempotent cron registration.
do $$
declare
  reconciliation_job_id bigint;
  analytics_job_id bigint;
begin
  select jobid into reconciliation_job_id
  from cron.job
  where jobname = 'daily-subscription-reconciliation';

  if reconciliation_job_id is not null then
    perform cron.unschedule(reconciliation_job_id);
  end if;

  select jobid into analytics_job_id
  from cron.job
  where jobname = 'daily-analytics-rollup';

  if analytics_job_id is not null then
    perform cron.unschedule(analytics_job_id);
  end if;

  perform cron.schedule(
    'daily-subscription-reconciliation',
    '25 2 * * *',
    $job$select ops.invoke_subscription_reconciliation();$job$
  );

  perform cron.schedule(
    'daily-analytics-rollup',
    '40 2 * * *',
    $job$select ops.run_daily_analytics_rollup();$job$
  );
end;
$$;

comment on function ops.invoke_subscription_reconciliation() is
  'Calls the subscription-reconciliation Edge Function via pg_net using Vault-managed credentials.';

comment on function ops.run_daily_analytics_rollup(date) is
  'Builds daily production analytics rollups for leads, CTA clicks, alerts, and active paid subscriptions.';
