-- MV — odciążenie pg_cron po wdrożeniu orkiestratora master
-- Data przygotowania: 2026-09-03
--
-- KONTEKST
-- max_worker_processes = 6, a pg_cron uruchamia każde zadanie jako osobny
-- background worker. Przy 151 aktywnych zadaniach (97 co minutę) zadania nie
-- mają na czym wystartować — 19,6% ostatnich uruchomień padło z "job startup timeout".
--
-- CO ROBI TEN SKRYPT
-- Wyłącza wyłącznie te zadania pg_cron, których tory przejmuje workflow n8n
-- "MV ORKIESTRATOR MASTER" (ol8UAkJNVzPTlnUN). Nic nie usuwa — ustawia active=false.
-- Pozostałe zadania zostają nietknięte.
--
-- WARUNEK WSTĘPNY
-- Orkiestrator musi być skonfigurowany (MV_SUPABASE_ANON, MV_ORCH_TOKEN)
-- i przetestowany ręcznie w trybie DRY.
--
-- ROLLBACK: n8n/rollback-cron.sql

begin;

-- 1. Backup stanu sprzed zmiany (idempotentny, osobna tabela na tę operację)
create table if not exists backup_cron_odciazenie_20260903 as
select jobid, jobname, schedule, command, active, now() as backup_at
from cron.job;

-- 2. Podgląd: co zostanie wyłączone (uruchom sam SELECT przed COMMIT)
select jobid, jobname, schedule
from cron.job
where active
  and command ~* (
    'mv_biuro_tick|orch_tick|mv_dyspozytor_tick|orch_qa_tick|orch_watchdog'
    '|mv_heartbeat|mv_guard_tick|mv_stuck_watchdog|system_watchdog'
    '|mv_reply_klasyfikuj|mv_reply_router_tick|mv_domena_ramp'
    '|glauko_ted_tick|glauko_health_tick|glauko_wyslij_partie|glauko_followup_tick'
    '|re_skaner_tick|re_wyslij_partie'
    '|lux_cobroker_biuro_tick'
    '|posrednictwo_biuro_tick|posrednictwo_refill_kolejka|posrednictwo_drain_safe'
    '|mv_publikator_generuj|aureu_content_tick|kp_oferta_tick'
    '|mv_aureu_publish_tick|kp_ig_tick|kp_send_due'
    '|revenue_controller|mv_wyslij_partie|nexion_wyslij_partie'
  )
order by jobname;

-- 3. Wyłączenie
update cron.job
set active = false
where active
  and command ~* (
    'mv_biuro_tick|orch_tick|mv_dyspozytor_tick|orch_qa_tick|orch_watchdog'
    '|mv_heartbeat|mv_guard_tick|mv_stuck_watchdog|system_watchdog'
    '|mv_reply_klasyfikuj|mv_reply_router_tick|mv_domena_ramp'
    '|glauko_ted_tick|glauko_health_tick|glauko_wyslij_partie|glauko_followup_tick'
    '|re_skaner_tick|re_wyslij_partie'
    '|lux_cobroker_biuro_tick'
    '|posrednictwo_biuro_tick|posrednictwo_refill_kolejka|posrednictwo_drain_safe'
    '|mv_publikator_generuj|aureu_content_tick|kp_oferta_tick'
    '|mv_aureu_publish_tick|kp_ig_tick|kp_send_due'
    '|revenue_controller|mv_wyslij_partie|nexion_wyslij_partie'
  );

-- 4. Ślad w dzienniku zdarzeń
insert into ops_events (event_type, entity_type, entity_id, source, metadata)
values (
  'CRON_ODCIAZENIE',
  'pg_cron',
  'orkiestrator-master',
  'audyt-2026-09-03',
  jsonb_build_object(
    'workflow_n8n', 'ol8UAkJNVzPTlnUN',
    'backup_tabela', 'backup_cron_odciazenie_20260903',
    'powod', 'job startup timeout przy max_worker_processes=6'
  )
);

commit;

-- 5. Weryfikacja po 60 minutach — oczekiwane: zero "job startup timeout"
-- with t as (select status, return_message from cron.job_run_details order by runid desc limit 500)
-- select status, count(*) from t group by 1;
