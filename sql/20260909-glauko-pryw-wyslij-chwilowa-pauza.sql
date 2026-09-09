-- 2026-09-09 GLAUKO: chwilowa pauza wysylki nie moze trwale spalac kontaktu
--
-- OBJAW
--   51 poprawnych adresow w glauko_firmy_prywatne mialo blad =
--   'SEND_ALLOWED_DENY:["mv_send_pause"]' (wpisany 08.09 19:02 - 09.09 01:50).
--   Kolumna blad wyklucza rekord z kolejki NA STALE, a mv_send_pause to stan
--   CHWILOWY, ktory zdjal sie sam (app_config.mv_send_pause = 'false').
--   Efekt: kolejka spadla do 10 adresow przy 639 juz wyslanych.
--
-- PRZYCZYNA
--   glauko_pryw_wyslij traktowala jako odraczalne tylko ANTY_FLOOD / RATE / THROTTL.
--   Kazda inna odmowa outbound_send - w tym globalna pauza - szla do kolumny blad.
--
-- POPRAWKA
--   Rozszerzenie listy przyczyn odraczalnych o mv_send_pause / PAUSE / FREEZE /
--   SUPERVISOR_STOP. Zadna bramka nie jest omijana: adres pozostaje NIEWYSLANY,
--   wraca do kolejki i przy kolejnym tiku przechodzi pelna kontrole
--   outbound_allowed od nowa (suppression, opt-out, dedup, klasa odbiorcy).
--
-- BACKUP / ROLLBACK
--   app_config.backup_glauko_pryw_wyslij_20260909  - pelna poprzednia definicja funkcji
--   app_config.backup_glauko_send_pause_deny_20260909 - lista 51 odblokowanych adresow
--
-- DOWOD PO ZMIANIE
--   kolejka 10 -> 61, nadal_spalone = 0.

update glauko_firmy_prywatne
   set blad = null
 where blad = 'SEND_ALLOWED_DENY:["mv_send_pause"]';

-- w glauko_pryw_wyslij, galaz obslugi odmowy:
--   if v_powod ilike '%ANTY_FLOOD%' or v_powod ilike '%RATE%' or v_powod ilike '%THROTTL%'
--      or v_powod ilike '%mv_send_pause%' or v_powod ilike '%PAUSE%'
--      or v_powod ilike '%FREEZE%' or v_powod ilike '%SUPERVISOR_STOP%' then
--     v_odroczone := v_odroczone + 1;      -- odroczenie, kontakt zostaje w kolejce
--   else
--     update glauko_firmy_prywatne set blad = v_powod where email=r.email;
--   end if;
