create table if not exists public.cron_job_runs (
  id bigint generated always as identity primary key,
  run_id text not null,
  job text not null,
  trigger text not null,
  status text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists cron_job_runs_job_created_at_idx
  on public.cron_job_runs (job, created_at desc);

create table if not exists public.dashboard_signal_runs (
  id bigint generated always as identity primary key,
  run_id text not null,
  trigger text not null,
  generated_at timestamptz not null,
  signal_count integer not null default 0,
  top_severity text not null default 'normal',
  signals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists dashboard_signal_runs_generated_at_idx
  on public.dashboard_signal_runs (generated_at desc);

create table if not exists public.activity_feed_runs (
  id bigint generated always as identity primary key,
  run_id text not null,
  trigger text not null,
  event_type text not null,
  title text not null,
  detail text not null,
  created_at timestamptz not null
);

create index if not exists activity_feed_runs_created_at_idx
  on public.activity_feed_runs (created_at desc);

create table if not exists public.metrics_snapshots (
  id bigint generated always as identity primary key,
  run_id text not null,
  trigger text not null,
  generated_at timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists metrics_snapshots_generated_at_idx
  on public.metrics_snapshots (generated_at desc);
