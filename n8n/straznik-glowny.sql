-- MV — STRAŻNIK GŁÓWNY (WDROŻONY 2026-09-04 ~00:30 czasu PL)
--
-- PO CO
-- Awaria pg_cron z 3 września trwała 3 h 44 min i nie wywołała żadnego
-- powiadomienia. W systemie działa CZTERNAŚCIE watchdogów (8 w bazie,
-- 6 w n8n) — każdy pilnuje swojego kawałka i żaden nie krzyknął.
--
-- Kluczowe ustalenie: funkcja mv_cron_zdrowie() JUŻ ISTNIAŁA i wykrywa
-- dokładnie ten błąd ("job startup timeout = brak wolnego workera"),
-- ale (a) żaden cron jej nie wywoływał i (b) kończy się na wpisie do
-- ops_events z 'outbound', false — czyli nie powiadamia nikogo.
--
-- Drugie ustalenie: alert_telegram() ma białą listę kanałów
-- (app_config.telegram_kanaly_dozwolone = 'sukces,stop_kasy').
-- Alarm wysłany na kanał spoza listy jest CICHO wyciszany — trafia
-- do ops_events jako ALERT_WYCISZONY i nie dociera na telefon.
-- Dlatego strażnik używa kanału 'stop_kasy'.
--
-- CO ROBI
-- Jedna funkcja sprawdza cztery filary naraz i wysyła JEDEN alarm:
--   1. pg_cron startuje zadania      (mv_cron_zdrowie, próg 20% padów / 20 min)
--   2. agenci produkują zadania      (agent_tasks, próg 60 min bez nowego)
--   3. wysyłka idzie                 (emails_sent_today, 12:00-21:00 czasu PL)
--   4. integracje odpowiadają        (ops_http_failures, próg 20 błędów/h)
-- Antyspam: najwyżej jeden alarm na godzinę (event STRAZNIK_ALARM).
--
-- DOWODY
-- - test na zdrowym systemie: {"ok": true, "filary": {"pg_cron": "ZDROWY",
--   "minut_od_zadania": 3, "maile_dzis": 0, "bledy_http_1h": 7}}
-- - wykrycie na PRAWDZIWYCH danych awarii (okno 420 min obejmujące 15:00-18:44):
--   {"ok": false, "stan": "GLODZENIE", "pct": 51.6, "event_id": 157592}
--   czyli gdyby strażnik był podpięty rano, alarm poszedłby o 15:15
-- - test dostarczenia na telefon: alert_telegram(..., 'stop_kasy') => true
--
-- ZNANE OGRANICZENIE
-- Strażnik działa w pg_cron, więc pilnuje mechanizmu, w którym sam siedzi.
-- Przy 3 września przechodziło 5-20% zadań, więc szansa na wystartowanie
-- była — ale to nie jest gwarancja. Docelowo drugi, niezależny strażnik
-- powinien stać w n8n i odpytywać bazę z zewnątrz (workflow ol8UAkJNVzPTlnUN
-- ma taki alarm wbudowany w każdy cykl).
--
-- ROLLBACK
--   select cron.unschedule('mv_straznik_glowny_15m');
--   drop function if exists public.mv_straznik_glowny(boolean);

create or replace function public.mv_straznik_glowny(p_alarmuj boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_cron jsonb;
  v_problemy text[] := '{}';
  v_ost_zadanie timestamptz;
  v_min_od_zadania int;
  v_wyslane_dzis int;
  v_godzina_pl int;
  v_http_bledy int;
  v_ostatni_alarm timestamptz;
  v_wyslano boolean := false;
  v_tresc text;
begin
  -- FILAR 1: czy pg_cron w ogóle startuje zadania
  v_cron := mv_cron_zdrowie(20, 20);
  if not coalesce((v_cron->>'ok')::boolean, true) then
    v_problemy := v_problemy || ('pg_cron: ' || coalesce(v_cron->>'pct','?') || '% zadan nie startuje');
  end if;

  -- FILAR 2: czy agenci produkują zadania
  select max(created_at) into v_ost_zadanie from agent_tasks;
  v_min_od_zadania := round(extract(epoch from (now() - v_ost_zadanie))/60);
  if v_min_od_zadania > 60 then
    v_problemy := v_problemy || ('agenci: brak nowych zadan od ' || v_min_od_zadania || ' min');
  end if;

  -- FILAR 3: czy wysyłka idzie w godzinach pracy
  v_godzina_pl := extract(hour from (now() at time zone 'Europe/Warsaw'));
  v_wyslane_dzis := emails_sent_today();
  if v_godzina_pl between 12 and 21 and v_wyslane_dzis = 0 then
    v_problemy := v_problemy || 'wysylka: zero maili mimo godzin pracy';
  end if;

  -- FILAR 4: czy integracje odpowiadają
  select count(*) into v_http_bledy from ops_http_failures where wykryto_o > now() - interval '1 hour';
  if v_http_bledy > 20 then
    v_problemy := v_problemy || ('http: ' || v_http_bledy || ' bledow w ostatniej godzinie');
  end if;

  if array_length(v_problemy, 1) is null then
    return jsonb_build_object('ok', true, 'filary', jsonb_build_object(
      'pg_cron', v_cron->>'stan', 'minut_od_zadania', v_min_od_zadania,
      'maile_dzis', v_wyslane_dzis, 'bledy_http_1h', v_http_bledy));
  end if;

  v_tresc := 'STRAZNIK MV: ' || array_to_string(v_problemy, ' | ');

  select max(created_at) into v_ostatni_alarm from ops_events
   where event_type = 'STRAZNIK_ALARM' and created_at > now() - interval '1 hour';

  if p_alarmuj and v_ostatni_alarm is null then
    v_wyslano := alert_telegram(v_tresc, 'stop_kasy');
    insert into ops_events(event_type, entity_type, entity_id, source, actor_agent, status, metadata)
    values ('STRAZNIK_ALARM', 'system', 'mv_straznik_glowny', 'mv_straznik_glowny', 'watchdog', 'alarm',
            jsonb_build_object('problemy', v_problemy, 'telegram', v_wyslano,
                               'minut_od_zadania', v_min_od_zadania, 'maile_dzis', v_wyslane_dzis));
  end if;

  return jsonb_build_object('ok', false, 'problemy', v_problemy, 'telegram', v_wyslano,
                            'antyspam', v_ostatni_alarm is not null);
end
$fn$;

select cron.schedule('mv_straznik_glowny_15m', '9-59/15 * * * *', $$select public.mv_straznik_glowny(true);$$);

-- Podgląd stanu bez wysyłania alarmu:
--   select public.mv_straznik_glowny(false);
