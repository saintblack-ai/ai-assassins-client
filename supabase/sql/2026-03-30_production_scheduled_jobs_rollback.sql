-- Rollback for 2026-03-30_production_scheduled_jobs.sql

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
end;
$$;

drop function if exists ops.invoke_subscription_reconciliation();
drop function if exists ops.run_daily_analytics_rollup(date);
drop function if exists ops.count_rows_for_date(text, text[], text[], date);
drop function if exists ops.find_timestamp_column(text, text, text[]);
drop function if exists ops.table_exists(text, text);

drop table if exists ops.analytics_daily_rollups;

delete from vault.secrets
where name in ('supabase_project_url', 'supabase_service_role_key');

drop schema if exists ops;
