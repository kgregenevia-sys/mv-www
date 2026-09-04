-- MV — kroplówka kolejki orch_zadania (WDROŻONE 2026-09-04 06:26 UTC)
--
-- DLACZEGO JEDNORAZOWE ROZŁOŻENIE NIE WYSTARCZYŁO
-- 2026-09-04 01:25 rozłożono 220 zadań na porcje po 20 co 10 minut (do 03:05).
-- Efekt był chwilowy:
--   02:59  orch_tick padał w 3 z 18 cykli (17%)  — porcje jeszcze dojrzewały
--   08:24  orch_tick padał w 20 z 36 cykli (56%) — wszystkie porcje dojrzałe,
--          funkcja znów brała całość naraz
--
-- Jednorazowe przesunięcie w czasie z definicji wygasa. Potrzebny mechanizm
-- stały, który utrzymuje liczbę dojrzałych zadań poniżej progu.
--
-- CO ROBI
-- mv_kolejka_kroplowka(p_max_dojrzalych, p_odstep_min) zostawia najstarsze
-- p_max_dojrzalych zadań gotowych do przetworzenia, a nadmiar przesuwa
-- na kolejne okna co p_odstep_min minut. Uruchamiana cronem co 10 minut,
-- więc kolejka dowolnej wielkości sączy się równomiernie.
--
-- Nic nie usuwa, nie zmienia statusów ani logiki — operuje wyłącznie na
-- next_attempt_at, które orch_tick i tak respektuje.
--
-- WYNIK
--   pierwszy przebieg: 201 dojrzałych → zostawiono 25, przesunięto 176
--   pomiar orch_tick przy progu 25: 14,0 s (06:25:33 → 06:25:47)
--   pomiar orch_tick przy progu 10: 10,2 s (06:26:02 → 06:26:12)
--
-- WAŻNE OGRANICZENIE
-- Zejście z progu 25 na 10 skróciło wykonanie tylko o 3,8 s. To znaczy, że
-- orch_tick ma STAŁY NARZUT rzędu 10 sekund, niezależny od długości kolejki —
-- wąskim gardłem nie jest liczba zadań pending, tylko coś w samej funkcji
-- (qa_torow, zasil_qa, przeliczenia torów). Kroplówka utrzymuje wykonanie
-- poniżej limitu, ale margines jest wąski.
--
-- Trwałe rozwiązanie wymaga profilowania orch_tick i albo rozbicia jej na
-- mniejsze funkcje wołane osobno, albo dodania parametru limitu porcji.
--
-- ROLLBACK
--   select cron.unschedule('mv_kolejka_kroplowka_10m');
--   drop function if exists public.mv_kolejka_kroplowka(int, int);
--   -- przywrócenie oryginalnych terminów z 2026-09-04 01:25:
--   -- update orch_zadania z set next_attempt_at = b.next_attempt_at
--   -- from backup_orch_zadania_retry_20260904 b where b.id = z.id;

create or replace function public.mv_kolejka_kroplowka(p_max_dojrzalych int default 25, p_odstep_min int default 10)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_dojrzale int;
  v_przesuniete int := 0;
begin
  select count(*) into v_dojrzale
  from orch_zadania
  where status='pending' and coalesce(next_attempt_at, now()) <= now();

  if v_dojrzale <= p_max_dojrzalych then
    return jsonb_build_object('ok', true, 'dojrzale', v_dojrzale, 'przesuniete', 0, 'akcja', 'w normie');
  end if;

  with nadmiar as (
    select id, row_number() over (order by created_at) - 1 as nr
    from orch_zadania
    where status='pending' and coalesce(next_attempt_at, now()) <= now()
    offset p_max_dojrzalych
  )
  update orch_zadania z
  set next_attempt_at = now() + (((n.nr / p_max_dojrzalych) + 1) * make_interval(mins => p_odstep_min)),
      updated_at = now()
  from nadmiar n
  where z.id = n.id;

  get diagnostics v_przesuniete = row_count;

  return jsonb_build_object('ok', true, 'dojrzale_przed', v_dojrzale,
                            'przesuniete', v_przesuniete, 'zostawiono', p_max_dojrzalych);
end
$fn$;

revoke all on function public.mv_kolejka_kroplowka(int, int) from public;
grant execute on function public.mv_kolejka_kroplowka(int, int) to anon, authenticated;

select cron.schedule('mv_kolejka_kroplowka_10m', '2-59/10 * * * *', $$select public.mv_kolejka_kroplowka(10, 10);$$);

-- Podgląd bez zmian:
--   select count(*) from orch_zadania where status='pending' and coalesce(next_attempt_at, now()) <= now();
-- Pomiar orch_tick:
--   select clock_timestamp(), orch_tick((select value from app_config where key='orch_token')), clock_timestamp();
