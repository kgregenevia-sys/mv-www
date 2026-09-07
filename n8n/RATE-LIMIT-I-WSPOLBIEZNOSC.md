# Glowny blocker przychodu: 68% wysylek odrzucanych przez rate limit (2026-09-07)

## Objaw

`mv_straznik_glowny` = `ok:false`, `"http: 297 bledow w ostatniej godzinie"`.

## Pomiar

| godzina UTC | wyslane OK | odrzucone 429 |
|---|---|---|
| 23:00 | 22 | 69 |
| 00:00 | 45 | 111 |
| 01:00 | 28 | 16 |
| 02:00 | 50 | 51 |
| 03:00 | 70 | 0 |
| **04:00** | **21** | **296** |
| 05:00 | 21 | 0 |

Razem 7 godzin: **258 wyslanych, 543 odrzucone**. Okolo **68 % prob wysylki
ladowalo w koszu.**

Tresc bledu z `ops_http_failures`:

```
{"statusCode":429,"name":"rate_limit_exceeded",
 "message":"Too many requests. You can only make 10 requests per second."}
```

## Przyczyna

Jeden przebieg `n8n_tick_wysylka()` zlecal **do 160 zadan HTTP naraz**:

| tor | porcja bylo |
|---|---|
| glauko_pryw | 10 |
| glauko_partie | 25 |
| glauko_followup | 25 |
| posrednictwo | 25 |
| ziemia | 20 |
| MV cold | 50 |
| NEXION | 5 |
| **razem** | **160** |

Wszystkie w jednej transakcji, przez `pg_net`. `pg_net.batch_size = 200`, wiec
worker wypuszczal cala paczke w jednej iteracji. Limit Resend to 10/s.

Drugi problem: **brak blokady wspolbieznosci**. Dwa nakladajace sie przebiegi
(harmonogram n8n + wywolanie reczne) wysylaly rownolegle, podwajajac skok.

## Naprawa

1. **Blokada wspolbieznosci** — `pg_try_advisory_lock(778811)` na wejsciu.
   Drugi przebieg konczy sie `{"pominieto":"inny przebieg wysylki trwa"}`.
2. **Male porcje + przerwa 2 s miedzy torami**, zeby worker `pg_net` zdazyl
   opróznic kolejke:

| tor | porcja jest |
|---|---|
| glauko_pryw | 5 |
| glauko_partie | 8 |
| glauko_followup | 5 |
| posrednictwo | 8 |
| ziemia | 5 |
| MV cold | 8 |
| NEXION | 3 |
| **razem** | **42** |

Zadna pojedyncza porcja nie przekracza 8 zadan, wiec zostaje zapas do limitu 10/s.

`ALTER SYSTEM SET pg_net.batch_size` bylo pierwszym wyborem, ale MCP opakowuje
kazde zapytanie w transakcje, a `ALTER SYSTEM` w transakcji nie dziala.
Naprawa po stronie aplikacji daje ten sam efekt.

## Dowod

Przebieg po zmianie: **30,9 s** (w tym 12 s przerw), `glauko_pryw: wyslane 3`,
zero bledow HTTP w przebiegu.

Przy okazji ujawnil sie prawdziwy sufit dnia: `coldmail_daily_cap = 600`
i **jest osiagniety** (600/600). MV cold i posrednictwo na dzis skonczone.

## Przepustowosc

42 zadania co 15 minut = 168/h = ok. 4000/dobe. Wczesniejsza **realna**
przepustowosc to bylo ~37/h, bo reszta szla w 429.

## Rollback

```sql
do $$ declare d text; begin
  select value into d from app_config where key='backup_n8n_tick_wysylka_20260907';
  execute d;
end $$;
```
