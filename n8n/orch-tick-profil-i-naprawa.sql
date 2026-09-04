-- MV — orch_tick: właściwa przyczyna timeoutów i naprawa (WYKONANE 2026-09-04 07:46 UTC)
--
-- OBJAW (utrzymywał się mimo trzech wcześniejszych prób naprawy)
-- Tor BIURO/orch_tick zwracał HTTP 500 z kodem 57014 „canceling statement due to
-- statement timeout" w 12-16% cykli orkiestratora, godzina po godzinie:
--   00:00 UTC  7/50 (14,0%)   04:00  7/50 (14,0%)
--   01:00      3/50 ( 6,0%)   05:00  6/50 (12,0%)
--   02:00      1/50 ( 2,0%)   06:00  8/50 (16,0%)
--   03:00      6/50 (12,0%)   07:00  5/42 (11,9%)  <- do 07:46
--
-- CO BYŁO BŁĘDNE W POPRZEDNICH DIAGNOZACH
-- 1. „za dużo zadań pending w kolejce"  -> rozłożenie w czasie (rozladowanie-kolejki-orch.sql)
-- 2. „jednorazowe rozłożenie wygasa"    -> kroplówka (kroplowka-kolejki.sql)
-- Obie chybiły: orch_tick W OGÓLE NIE CZYTA tabeli orch_zadania. Dławienie tej
-- kolejki nie mogło pomóc i nie pomogło. Kroplówkę wycofano, 207 terminów
-- przywrócono z backup_orch_zadania_retry_20260904.
--
-- WŁAŚCIWA DIAGNOZA — PROFILOWANIE
-- orch_tick deleguje do pięciu funkcji. Zmierzone czasy jednego przebiegu:
--   lux_cobroker_biuro_tick   9,40 s   <-- 95% całości
--   posrednictwo_biuro_tick   0,2  s
--   mv_dyspozytor_tick        0,1  s
--   mv_qa_szkice_zasil        0,1  s
--   orch_qa_tick              0,1  s
--   RAZEM                     ~9,9 s   przy limicie PostgREST rzędu 10 s
--
-- Czyli orch_tick balansował dokładnie na granicy limitu — stąd „losowe" 12-16%
-- padów zamiast padów stałych. Długość kolejki orch_zadania nie miała z tym nic
-- wspólnego (dowód: po naprawie 208 dojrzałych zadań w kolejce, a tick 0,54 s).
--
-- DLACZEGO lux_cobroker_biuro_tick PALI 9,4 s NA NIC
-- Funkcja wewnętrznie przycina limit do lux_daily_cap = 30, niezależnie od
-- parametru przekazanego przez orch_tick. Indeksy są na miejscu, koszt siedzi
-- w pętli bramkowej. Ostatni przebieg zwrócił {"approved": 0, "sent_today": 0}
-- — 9,4 s co 5 minut, zero wysłanych ofert. Wywoływanie jej co 5 minut przy
-- dziennym limicie 30 nie ma sensu; raz na godzinę w zupełności wystarczy.
--
-- ROZWIĄZANIE
-- Wyjęcie lux_cobroker_biuro_tick z gorącej ścieżki orch_tick i przeniesienie
-- do osobnego crona co godzinę. Żadnej funkcjonalności nie ubyło — zmieniła się
-- tylko częstotliwość wywołania z 12x/h na 1x/h, powyżej dziennego limitu 30.
--
-- DOWÓD DZIAŁANIA (pomiar bezpośredni, 2026-09-04 07:46:59 UTC)
--   przed:  ~9,9 s  (na granicy statement_timeout)
--   po:      0,54 s (07:46:59.262 -> 07:46:59.801) — ok. 18x szybciej
--   wynik:  {"ok": true, "qa_torow": {...},
--            "kolejki": {"AUREU": 2, "GLAUKO": 202, "NEXION": 6}}
--   przy czym w kolejce leżało 208 dojrzałych zadań — czyli kolejka nigdy nie
--   była wąskim gardłem.
--
-- POTWIERDZENIE Z PRODUKCJI (pomiar 08:47 UTC, godzina po wdrożeniu)
--   godzina UTC   cykli   błędów 57014
--   04:00           50      7  (14,0%)   <- przed
--   05:00           50      6  (12,0%)   <- przed
--   06:00           50      8  (16,0%)   <- przed
--   07:00           50      5  (10,0%)   <- przed (zmiana o 07:46)
--   08:00           40      0  ( 0,0%)   <- po
--   Łącznie od 07:47: 49 cykli, 0 błędów.
--   Cron lux_cobroker_1h wystartował 08:18:00, status succeeded.
--
-- ZNALEZIONE PRZY OKAZJI (osobny problem, nie dotyczy orch_tick)
-- Strażnik główny zgłasza filar 4: 23 błędy HTTP w ostatniej godzinie.
-- Rozbicie: 546 WORKER_RESOURCE_LIMIT dokładnie o :15 i :45 — czyli
-- re_skaner_tick() -> edge function 're-skaner', cron re_skaner_10m
-- ('0-59/15'), 4 pady na godzinę. Tabela re_listings ma 0 wierszy.
-- Do tego 401 Unauthorized (strona błędu Google) ok. 3x/h przy zadaniach
-- '1-59/15' — wygasły token OAuth Gmaila.
--
-- Osobno: mv_watchdog_http_10min mimo nazwy chodzi RAZ NA GODZINĘ ('54 * * * *'),
-- a konserwator_http kasuje net._http_response starsze niż 20 minut co 30 minut.
-- Watchdog widzi więc tylko ~20-minutową próbkę na godzinę i stempluje wszystkie
-- wpisy czasem partii, nie czasem błędu. Filar 4 strażnika liczy zatem
-- "błędy w ostatniej godzinie" na podstawie jednej próbki — zaniża i przekłamuje
-- moment wystąpienia. Do decyzji, bo zmiana częstotliwości zwiększy liczbę alarmów.
--
-- BACKUP I ROLLBACK
--   backup: app_config.backup_orch_tick_def_20260904 (pełna oryginalna definicja)
--   rollback:
--     select cron.unschedule('lux_cobroker_1h');
--     -- następnie wykonać treść z:
--     -- select value from app_config where key='backup_orch_tick_def_20260904';

create or replace function public.orch_tick(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_disp jsonb; v_zasil jsonb; v_qa jsonb; v_posr jsonb;
begin
  if not public.orch_auth(p_token) then raise exception 'BRAK AUTORYZACJI'; end if;

  v_posr  := public.posrednictwo_biuro_tick(25);
  v_disp  := public.mv_dyspozytor_tick(10);
  v_zasil := public.mv_qa_szkice_zasil();
  v_qa    := public.orch_qa_tick(p_token, 200);

  return jsonb_build_object(
    'ok', true,
    'posrednictwo', v_posr,
    'dyspozytor', v_disp,
    'zasil_qa', v_zasil,
    'qa_torow', v_qa,
    'lux_cobroker', 'przeniesiony do crona lux_cobroker_1h',
    'kolejki', (select jsonb_object_agg(tor, n)
                from (select tor, count(*) n from orch_zadania
                      where status in ('pending','error') group by tor) t));
end
$function$;

select cron.schedule('lux_cobroker_1h', '18 * * * *',
  $$select public.lux_cobroker_biuro_tick(600);$$);

-- Pomiar kontrolny:
--   select clock_timestamp(), orch_tick((select value from app_config where key='orch_token')), clock_timestamp();
-- Awaryjność toru BIURO po godzinach (oczekiwane 0%):
--   select date_trunc('hour', created_at) g, count(*) cykli,
--          count(*) filter (where blad is not null) bledy
--   from orch_runs where tor='BIURO' and created_at > now() - interval '6 hours'
--   group by 1 order by 1;
