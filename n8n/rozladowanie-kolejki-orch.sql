-- MV — rozładowanie zatoru w orch_zadania (WYKONANE 2026-09-04 01:25 UTC)
--
-- OBJAW
-- Tor BIURO/orch_tick zwracał HTTP 500 z kodem 57014 („canceling statement due
-- to statement timeout") w 10 z 24 cykli orkiestratora (42%).
--
-- DIAGNOZA
-- Kolejka orch_zadania była zapchana:
--   pending      218  (GLAUKO 212, NEXION 6), najstarsze z 2026-08-19 — 16 dni
--   dead_letter  103  (AUREU), od 2026-08-30
--   ready         62  (GLAUKO), wszystkie z jednej chwili 2026-09-03 12:55
--
-- 212 zadań GLAUKO typu SZANSA tkwiło w pętli:
--   - błąd „QA_REWORK", attempt_count 3 przy max_attempts 4
--   - żadne nie zablokowane (locked_at null), żadne nie czekało na retry
--     (next_attempt_at w przeszłości) — czyli wszystkie 212 kwalifikowały się
--     do przetworzenia w KAŻDYM wywołaniu orch_tick
--   - orch_tick nie ma parametru limitu porcji, więc brał całość naraz
--     i przekraczał statement_timeout przed końcem
--
-- Zakleszczenie: kolejka była za duża, żeby przerobić ją w jednym wywołaniu,
-- a bez przerobienia nie mogła się zmniejszyć. Zadania nigdy nie dochodziły
-- do czwartej próby, która wypchnęłaby je do dead_letter i oczyściła kolejkę.
--
-- ROZWIĄZANIE
-- Rozłożenie w czasie przez next_attempt_at: porcje po 20 zadań co 10 minut.
-- Nic nie usunięto, logiki nie zmieniono — orch_tick sam respektuje
-- next_attempt_at, więc bierze tylko dojrzałą porcję.
--
-- WYNIK
-- 220 zadań rozłożonych na 11 porcji (01:25 → 03:05 UTC).
-- Test bezpośredni: orch_tick wykonał się w 11,8 s (01:25:44 → 01:25:56)
-- i zwrócił {"ok": true, ...  "approved": 55} — wcześniej timeoutował.
--
-- ROLLBACK
--   update orch_zadania z set next_attempt_at = b.next_attempt_at
--   from backup_orch_zadania_retry_20260904 b where b.id = z.id;

create table if not exists backup_orch_zadania_retry_20260904 as
select id, status, next_attempt_at, attempt_count, now() as backup_at
from orch_zadania where status='pending';

with ponumerowane as (
  select id, row_number() over (order by created_at) - 1 as nr
  from orch_zadania
  where status='pending' and tor='GLAUKO' and coalesce(next_attempt_at, now()) <= now()
)
update orch_zadania z
set next_attempt_at = now() + ((p.nr / 20) * interval '10 minutes'),
    updated_at = now()
from ponumerowane p
where z.id = p.id;

-- Weryfikacja rozłożenia:
-- select count(*), min(next_attempt_at), max(next_attempt_at)
-- from orch_zadania where status='pending' and tor='GLAUKO';

-- Pomiar czasu orch_tick (powinien zmieścić się w limicie PostgREST):
-- select clock_timestamp(), orch_tick((select value from app_config where key='orch_token')), clock_timestamp();


-- DO ROZWAŻENIA — trwałe rozwiązanie
--
-- To jest obejście objawu. Trwale problem znika dopiero, gdy orch_tick dostanie
-- parametr limitu porcji, np. orch_tick(p_token text, p_limit int default 25),
-- i będzie brał najwyżej p_limit zadań na wywołanie. Wtedy kolejka dowolnej
-- wielkości rozładowuje się stopniowo, bez ryzyka timeoutu.
--
-- Osobno: 103 zadania AUREU w dead_letter od 30 sierpnia nikt nie przegląda.
-- Warto ustalić, czy to trwałe odpady (do skasowania), czy utracona praca
-- do odzyskania.
