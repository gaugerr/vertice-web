-- Optional rollout script for the SQL Editor, after migrations and pg_cron are available.
-- Installs a DISABLED job. Review and explicitly activate it only during the rollout.
-- No credentials are needed: the job calls the server-only database routine directly.
begin;
do $$
declare retry_job bigint;
begin
  retry_job := cron.schedule(
    'vertice-cakto-process-pending',
    '* * * * *',
    'select public.cakto_process_pending(true, 20);'
  );
  perform cron.alter_job(job_id := retry_job, active := false);
end $$;
commit;
