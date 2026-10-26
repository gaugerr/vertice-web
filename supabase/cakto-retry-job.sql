-- Optional rollout script for the SQL Editor, after migrations and pg_cron are available.
-- Installs DISABLED jobs. Running this script also pauses any existing jobs below.
-- Review and explicitly activate both jobs only during the rollout.
-- No credentials are needed: the job calls the server-only database routine directly.
begin;
do $$
declare
  retry_job bigint;
  cleanup_job bigint;
begin
  retry_job := cron.schedule(
    'vertice-cakto-process-pending',
    '*/5 * * * *',
    'select public.cakto_process_pending(true, 20);'
  );
  perform cron.alter_job(job_id := retry_job, active := false);
  cleanup_job := cron.schedule(
    'vertice-cakto-cron-history-cleanup',
    '15 4 * * *',
    $job$delete from cron.job_run_details
where jobid in (
  select jobid from cron.job
  where jobname in ('vertice-cakto-process-pending', 'vertice-cakto-cron-history-cleanup')
) and end_time < now() - interval '7 days';$job$
  );
  perform cron.alter_job(job_id := cleanup_job, active := false);
end $$;
commit;
