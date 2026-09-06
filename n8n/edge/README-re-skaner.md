# re-skaner — naprawa HTTP 546 (2026-09-06)

## Objaw

Edge function `re-skaner` padała z `HTTP 546 WORKER_RESOURCE_LIMIT` przy każdym
wywołaniu — 4 razy na godzinę. Skutek: 51 inwestorów tkwiło w statusie `nowy`,
`re_investor_contacts` nie przyrastało od 2026-09-04.

## Dwie diagnozy — pierwsza była błędna

**v3 (błędna): pamięć.** `pobierz()` robiło `await r.text()` na całej odpowiedzi
i dopiero potem `.slice(0, 400000)`. Cięcie po fakcie nie chroni pamięci — cały
plik był już wczytany. Wdrożyłem strumieniowe czytanie z twardym limitem 300 kB,
odrzucanie odpowiedzi nie-HTML po nagłówku i odrzucanie zadeklarowanych gigantów.

Test: **nadal `HTTP 546`** (request 242106). Hipoteza obalona.

**v4 (właściwa): CPU.** Log edge runtime pokazał wprost:

```
20:43:21.224  booted (time: 33ms)
20:43:24.783  CPU Time exceeded     <- level: error
20:43:24.783  shutdown
```

Budżet CPU wypalony w 3,5 s zegara. Winowajcą było `wyciagnijMaile()`, które
robiło `html.match(globalny złożony regex)` po CAŁYM dokumencie. Przy 3 ścieżkach
na firmę i 4 firmach na wywołanie to ~12 przebiegów wzorca
`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}` po setkach kilobajtów
zminifikowanego HTML/JS, gdzie ten wzorzec intensywnie się cofa (backtracking).

Naprawa: zamiast skanować regexem cały dokument, szukamy znaku `@` natywnym
`indexOf` (skan liniowy, bardzo tani), a dopiero wokół każdego trafienia czytamy
po znaku w oknie ±64. Złożony regex znika z gorącej pętli. Limity pamięci z v3
zostały — są sensowne same w sobie, choć nie one były przyczyną.

## Dowód

| | request | wynik |
|---|---|---|
| przed (v2) | 242106 | `546 WORKER_RESOURCE_LIMIT` |
| po (v4) | 242107 | **`200`**, 4 firmy w 5837 ms |

Wynik v4: `{"ok":true,"przetworzonych":4,"z_kontaktem":1,"bez_kontaktu":3,"bledow":1}`.
Zapisane kontakty (`info@griffin-cp.com` jako `funkcyjny`/0.9, adres imienny jako
`imienny`/0.5) klasyfikują się tak samo jak przed zmianą — brak regresji jakości.

## Harmonogram

`re_skaner_10m` był `active = false` od `PGCRON_TRIAGE` z 2026-09-04 16:52, kiedy
inny agent zapauzował 101 zadań niekrytycznych w trakcie awarii pg_cron. Włączony
ponownie na `12-59/30 * * * *` (2 przebiegi/h × 4 firmy). pg_cron ma zapas:
14 aktywnych zadań, 46 uruchomień w ostatniej godzinie, zero nieudanych.

## UWAGA — kolizja z migracją do n8n

Workflow n8n `D3tvXbjxvMDXdLRx` („SUPABASE TICKI") przejmuje harmonogram z pg_cron,
ale **nie zawiera `re_skaner_tick()`** — żadna z funkcji `n8n_tick_*` go nie woła.
Workflow jest nieaktywny (blokada: n8n API nie potrafi podpiąć istniejącego
credentiala do węzła).

Przy aktywacji migracji trzeba **jednocześnie**:
1. dodać `perform public.re_skaner_tick();` do `n8n_tick_30min()`,
2. wykonać `select cron.unschedule('re_skaner_10m');`

Inaczej albo skaner znów zniknie z harmonogramu, albo będzie chodził podwójnie.

## Rollback

```sql
select cron.alter_job((select jobid from cron.job where jobname='re_skaner_10m'), active => false);
```
Kod: poprzednie wersje edge function są dostępne w Supabase (v2 = stan sprzed naprawy).
