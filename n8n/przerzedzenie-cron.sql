-- MV — przerzedzenie harmonogramów pg_cron (WYKONANE 2026-09-03 17:45 UTC)
--
-- !!! WYNIK: TA ZMIANA NIE NAPRAWILA AWARII !!!
-- Pomiar w oknie 17:52-18:04 (w pelni po zmianie): 38 z 45 uruchomien padlo (84%),
-- wobec 95% przed zmiana. Zmniejszenie liczby startow o polowe nie pomoglo,
-- wiec hipoteza "za duzo zadan na ~2 sloty" jest obalona.
--
-- WLASCIWA PRZYCZYNA: sloty background workerow sa wyczerpane, a nie zajete.
-- pg_stat_activity pokazuje ZERO workerow pg_cron (tylko launcher), baze bezczynna
-- i brak blokad — a mimo to pg_cron nie startuje ani jednego workera.
-- To objaw wycieku slotow max_worker_processes. Naprawa: RESTART INSTANCJI
-- (panel Supabase → Settings → General → Restart project). Z poziomu SQL sie nie da.
--
-- EPILOG (19:15 UTC): awaria ustapila SAMOISTNIE o 18:45, BEZ restartu instancji.
-- pg_postmaster_start_time() = 2026-07-10 — instancja dziala nieprzerwanie.
-- Ostatni pad 18:44:00, pierwszy sukces 18:45:00, potem 119 uruchomien i 0 padow.
-- Teza o wycieku slotow wymagajacym restartu tez okazala sie bledna.
-- Definitywnej przyczyny nie ustalono; przebieg wskazuje na czynnik przejsciowy
-- po stronie platformy Supabase, nie na harmonogram ani kod.
--
-- Przerzedzenie weszlo o 17:45, awaria trwala jeszcze godzine — wiec nie ono ja
-- zakonczylo. Zmniejszylo natomiast zalegla kolejke: o 18:00 bylo 223 startow,
-- o 19:00 juz 81 przy zerowej awaryjnosci. Zmiane zostawiono w mocy.
--
-- DIAGNOZA
-- Do 14:00 UTC system pracował bezbłędnie: ~333 uruchomienia/h, 0-1 padów.
-- Od 15:00 UTC nagła kaskada:
--   15:00:00  ops_refresh_min, mx-gate, mv-safety → "canceling statement due to statement timeout"
--   15:01:00  początek lawiny "job startup timeout"
--   17:39     38 z 40 ostatnich uruchomień pada
--
-- Baza w tym czasie jest BEZCZYNNA (1 aktywne zapytanie, 20/60 połączeń,
-- brak długich transakcji i blokad). Wąskim gardłem nie są zapytania, tylko
-- sloty background workerów: max_worker_processes = 6, z czego na stałe zajmują
-- pg_cron launcher, pg_net worker, logical replication launcher i autovacuum
-- launcher. Dla zadań pg_cron zostaje ~2 sloty. Przy szczytach 13-14 startów
-- w jednej minucie kolejka nie ma szans się rozładować.
--
-- DECYZJA
-- Przerzedzenie zamiast wyłączania: żaden tor nie zostaje zatrzymany,
-- zmienia się tylko częstotliwość. Zadania częstsze niż 15 min → 15 min,
-- zadania 15-29 min → 30 min. Offsety zachowane (modulo nowy krok), więc
-- starty pozostają rozproszone w obrębie godziny.
--
-- WYNIK: 49 zadań zmienionych, 0 wyłączonych, 151 aktywnych bez zmian.
-- Backup: backup_cron_schedule_20260903 (jobid, jobname, schedule, active).
-- Rollback: n8n/rollback-cron.sql
--
-- UWAGA: skrypt NIE jest idempotentny — ponowne uruchomienie przesunęłoby
-- zadania 15-minutowe na 30-minutowe. Przed powtórzeniem sprawdź stan:
--   select count(*) from cron.job where active
--     and schedule ~ '^(\*|[0-9]+-59)/([1-9]|1[0-4]) \* \* \* \*$';

do $$
declare
  r record;
  v_offset int;
  v_krok int;
  v_nowy_krok int;
  v_nowy text;
  v_zmienione int := 0;
begin
  for r in
    select jobid, jobname, schedule from cron.job
    where active and schedule ~ '^(\*|[0-9]+-59)/[0-9]+ \* \* \* \*$'
  loop
    v_offset := coalesce(nullif(split_part(split_part(r.schedule, '/', 1), '-', 1), '*')::int, 0);
    v_krok   := split_part(split_part(r.schedule, '/', 2), ' ', 1)::int;

    v_nowy_krok := case
      when v_krok < 15 then 15
      when v_krok < 30 then 30
      else v_krok
    end;

    if v_nowy_krok <> v_krok then
      v_offset := v_offset % v_nowy_krok;
      v_nowy := v_offset || '-59/' || v_nowy_krok || ' * * * *';
      perform cron.alter_job(r.jobid, schedule => v_nowy);
      v_zmienione := v_zmienione + 1;
    end if;
  end loop;

  insert into ops_events (event_type, entity_type, entity_id, source, metadata)
  values ('CRON_PRZERZEDZENIE', 'pg_cron', 'awaria-workerow-20260903', 'audyt',
    jsonb_build_object('zmienionych_zadan', v_zmienione,
                       'backup', 'backup_cron_schedule_20260903'));
end $$;

-- Weryfikacja po ~15 minutach: oczekiwane zero "job startup timeout"
-- with t as (select status, return_message from cron.job_run_details order by runid desc limit 60)
-- select status, count(*) from t group by 1;
