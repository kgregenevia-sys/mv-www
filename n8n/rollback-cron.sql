-- MV — rollback zmian w pg_cron z 2026-09-03
--
-- Wariant 1 (domyślny): cofnięcie PRZERZEDZENIA harmonogramów.
-- Przywraca oryginalne `schedule` każdego zadania sprzed operacji
-- n8n/przerzedzenie-cron.sql.
--
-- UWAGA: przerzedzenie było naprawą awarii "job startup timeout".
-- Cofnięcie przywróci szczyty 13-14 startów na minutę przy ~2 wolnych
-- slotach background workerów, czyli najprawdopodobniej także awarię.
-- Rób to tylko, jeśli max_worker_processes zostało podniesione.

begin;

do $$
declare r record;
begin
  for r in
    select b.jobid, b.schedule
    from backup_cron_schedule_20260903 b
    join cron.job j on j.jobid = b.jobid
    where j.schedule is distinct from b.schedule
  loop
    perform cron.alter_job(r.jobid, schedule => r.schedule);
  end loop;
end $$;

insert into ops_events (event_type, entity_type, entity_id, source, metadata)
values ('CRON_ROLLBACK_SCHEDULE', 'pg_cron', 'awaria-workerow-20260903', 'audyt',
        jsonb_build_object('zrodlo_backupu', 'backup_cron_schedule_20260903'));

commit;


-- Wariant 2: cofnięcie ODCIĄŻENIA (wyłączenia zadań), jeśli kiedykolwiek
-- zostanie wykonane n8n/odciazenie-cron.sql. Przed rollbackiem dezaktywuj
-- orkiestrator w n8n, żeby nie dublować wywołań RPC.
--
-- begin;
-- update cron.job j set active = b.active
-- from backup_cron_odciazenie_20260903 b
-- where b.jobid = j.jobid and j.active is distinct from b.active;
-- insert into ops_events (event_type, entity_type, entity_id, source, metadata)
-- values ('CRON_ROLLBACK_ACTIVE', 'pg_cron', 'orkiestrator-master', 'audyt',
--         jsonb_build_object('zrodlo_backupu', 'backup_cron_odciazenie_20260903'));
-- commit;


-- Wariant awaryjny: pełny snapshot harmonogramu z 2026-09-03
-- (backup_cron_job_20260903 zawiera jobid, schedule, command, active).
