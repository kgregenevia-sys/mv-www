-- MV — rollback odciążenia pg_cron
-- Przywraca stan active każdego zadania sprzed operacji odciazenie-cron.sql.
--
-- Użyj, gdy orkiestrator master (n8n ol8UAkJNVzPTlnUN) nie prowadzi torów poprawnie.
-- Przed rollbackiem dezaktywuj orkiestrator, żeby nie dublować wywołań RPC.

begin;

update cron.job j
set active = b.active
from backup_cron_odciazenie_20260903 b
where b.jobid = j.jobid
  and j.active is distinct from b.active;

insert into ops_events (event_type, entity_type, entity_id, source, metadata)
values (
  'CRON_ROLLBACK',
  'pg_cron',
  'orkiestrator-master',
  'audyt-2026-09-03',
  jsonb_build_object('zrodlo_backupu', 'backup_cron_odciazenie_20260903')
);

commit;

-- Wariant awaryjny: przywrócenie ze snapshotu pełnego harmonogramu z 2026-09-03
-- (tabela backup_cron_job_20260903 zawiera jobid, schedule, command, active).
-- update cron.job j set active = b.active
-- from backup_cron_job_20260903 b where b.jobid = j.jobid;
