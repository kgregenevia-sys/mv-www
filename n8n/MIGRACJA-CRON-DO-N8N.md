# Odblokowanie migracji pg_cron → n8n (2026-09-06)

## Na czym polegała blokada

Workflow `D3tvXbjxvMDXdLRx` („SUPABASE TICKI") był gotowy od 18:52, ale **nieaktywny**.
Zapis blokady w `ops_events`:

> „n8n API nie potrafi podpiac ISTNIEJACEGO credentiala do wezla — newCredential()
> tworzy tylko placeholder na nowy. Odpowiedz API: HTTP Request nodes were skipped
> during credential auto-assignment, must be configured manually. Bez credentiala
> wszystkie 6 wywolan zwrocilyby 401."

Węzły używały `authentication: predefinedCredentialType` + `nodeCredentialType: supabaseApi`,
bez podpiętego credentiala. Przekazanie zadania właścicielowi brzmiało: otworzyć workflow
w UI, w każdym z 6 węzłów wybrać credential, zapisać, aktywować.

## Jak zdjęta

Credential jest niepotrzebny. PostgREST wymaga tylko dwóch nagłówków — `apikey`
i `Authorization: Bearer` — a te można zbudować w węźle Code. Dokładnie tak działa
`MV ORKIESTRATOR MASTER` (`ol8UAkJNVzPTlnUN`), który przez dwa dni wykonał 1055 cykli
toru BIURO bez ani jednego credentiala.

Nowa struktura: 6 wyzwalaczy czasowych → 6 węzłów Code (budują nagłówki i URL)
→ jeden wspólny węzeł HTTP Request. 14 węzłów łącznie.

## Klucz w kodzie — świadomie

Pierwsze podejście czytało `MV_SUPABASE_ANON` ze zmiennych środowiskowych z pustym
fallbackiem. Test wykazał, że **ta zmienna nie jest w tym n8n ustawiona**:

```
execution 123291 → error: "Brak MV_SUPABASE_ANON w zmiennych srodowiskowych n8n. [line 7]"
```

Dlatego klucz `anon` stoi w kodzie. To legacy anon JWT, który z definicji jest
**publikowalny** — Supabase wysyła go do każdej przeglądarki, potwierdzone przez
`get_publishable_keys` (`disabled: false`). Nie jest sekretem i może stać w publicznym
repozytorium. Zmienna środowiskowa, jeśli kiedyś powstanie, ma pierwszeństwo.

`orch_token` **nie występuje** w kodzie n8n — wrappery czytają go z `app_config`.

## Dowód działania

| | execution | wynik |
|---|---|---|
| przed | 123291 | `error` — brak klucza |
| po | **123297** | **`success`** |

Ślad w bazie, `orch_runs` tor `TICKI`:

```
2026-09-06 21:50:15  n8n_tick_5min
{"ts":"2026-09-06T21:50:15+00:00","kadencja":"5min",
 "rolka_f2":{"ok":true,"bledy":0,"przyjete":0},
 "rolka_f3":{"ok":true,"bledy":0,"gotowe":0,"zapytano":0,"ponowione":0}}
```

## Logowanie przeniesione do bazy

Pierwsza wersja miała w n8n węzły „Ocena wyniku" i „Zapisz przebieg". SDK odrzuca
deklaracje funkcji, funkcje strzałkowe i `let`, przez co odczyt planu z poprzedniego
węzła robił się karkołomny. Zamiast walczyć ze składnią — każdy wrapper `n8n_tick_*`
loguje się teraz sam przez `n8n_tick_log(faza, wynik)`.

Lepiej niż pierwotnie: ślad zostaje nawet jeśli n8n zgubi odpowiedź, a workflow
schudł o dwa węzły. `n8n_tick_log` ma odebrany `EXECUTE` dla `anon` — wołają ją
wyłącznie wrappery jako SECURITY DEFINER.

## Cutover

Backup: `backup_cron_cutover_n8n_20260906`. Wygaszono (`active = false`, nie usunięto)
14 crontabów pokrytych przez wrappery:

`rolka_f2`, `rolka_f3`, `mv-straznik-stopow-10min`, `potwierdz_wysylke`, `mx-gate`,
`oksana_zbierz_2m`, `re_skaner_10m`, `delivery_health_1015`, `glauko_ted_f1`,
`glauko_ted_f2`, `glauko_ted_f3`, `re_grunty_potwierdzenie`, `rolka_f1`, `oksana_publikuj_h`

`rolka_archiwum_h` **została aktywna** — nie ma odpowiednika w żadnym wrapperze.

Do `n8n_tick_30min` dopisano `re_skaner_tick()`, więc skaner gruntów jedzie teraz
z n8n zamiast z własnego crona.

## Rollback

```sql
-- crony z powrotem:
do $$ declare r record; begin
  for r in select jobid from cron.job j
           join backup_cron_cutover_n8n_20260906 b on b.jobname = j.jobname
  loop perform cron.alter_job(r.jobid, active => true); end loop;
end $$;
```
oraz `unpublish_workflow D3tvXbjxvMDXdLRx`.

## Co migracja NIE obejmuje

Wrappery pokrywają wyłącznie te 14 zadań. **Nie obejmują** ok. 48 crontabów usuniętych
2026-09-04 22:21 (`backup_wygaszenie_20260904`), w tym pollerów Stripe, routerów
inbound i bezpieczników. To osobna sprawa, opisana w `ops_events` jako
`P0_REVENUE_BLIND_CRONY_USUNIETE_NIE_WYGASZONE`.

---

# Orkiestrator włączony (2026-09-06 21:59 UTC)

`ol8UAkJNVzPTlnUN` był `active = false` od 4 września 22:20 — dlatego 23 tory
(BIURO, ZDROWIE, REPLY, LEADY, TREŚCI, PRZYCHÓD) nie chodziły przez dwa dni.

## Weryfikacja przed włączeniem

Wszystkie **26 funkcji RPC** wołanych przez router sprawdzone: istnieją i mają
`EXECUTE` dla roli `anon`. Żadna nie padła ofiarą czystki cronów z 4 września.

Tryb: **DRY**. `MV_ORCH_TRYB` nie jest ustawiona w n8n, więc obowiązuje fallback
`DRY` — klasa `wysylka` jest pomijana. Zero wysyłek.

## Usunięty duplikat

`re_skaner_tick` był w dwóch miejscach naraz: w `n8n_tick_30min` (dopisany godzinę
wcześniej) i w routerze orkiestratora jako tor `LEADY_ZIEMIA`. Zdjęty z wrappera —
właścicielem jest orkiestrator, bo daje log per tor w `orch_runs`.

> **Jeżeli orkiestrator zostanie kiedyś wyłączony, skaner przestanie chodzić.**
> Trzeba go wtedy dopisać z powrotem do `n8n_tick_30min` albo włączyć cron
> `re_skaner_10m` z `backup_cron_cutover_n8n_20260906`.

## Wracają też dwie rzeczy skasowane 4 września

- `mv_straznik_glowny` — tor ZDROWIE, co 15 minut. Jego cron `mv_straznik_glowny_15m`
  został usunięty w czystce; teraz strażnik czterech filarów znów pilnuje systemu.
- `lux_cobroker_biuro_tick` — tor LEADY_LUX, co 60 minut. Cron `lux_cobroker_1h`,
  założony przy naprawie `orch_tick`, też zniknął w czystce.

## Dowód — cykl z harmonogramu o 22:00 UTC

**15 torów, zero błędów.**

| tor | faza |
|---|---|
| BIURO | `mv_biuro_tick`, `orch_tick`, `mv_dyspozytor_tick`, `orch_qa_tick` |
| ZDROWIE | `mv_straznik_glowny`, `system_watchdog`, `orch_watchdog` |
| REPLY | `mv_reply_klasyfikuj`, `mv_domena_ramp` |
| LEADY_GLAUKO | `glauko_ted_tick`, `glauko_health_tick` |
| LEADY_ZIEMIA | `re_skaner_tick` |
| LEADY_LUX | `lux_cobroker_biuro_tick` |
| POSREDNICTWO | `posrednictwo_biuro_tick`, `posrednictwo_refill_kolejka` |
| TRESCI_MV | `mv_publikator_generuj` |
| TRESCI_AUREU | `aureu_content_tick` |

Werdykt strażnika z tego cyklu:
`{"ok": true, "filary": {"pg_cron": "ZDROWY", "minut_od_zadania": 1, "maile_dzis": 0, "bledy_http_1h": 0}}`

Oba workflow n8n chodzą równolegle bez kolizji: `TICKI` obsługuje 14 przeniesionych
crontabów, orkiestrator 23 tory.

## Co zgłosił orch_watchdog

- `dead_letter`: **AUREU 103**, GLAUKO 1 — sprawa otwarta od 30 sierpnia.
- `stalled`: `SCOUT_TED`, `POSREDNICTWO_WYSYLKA`.
- tory AUREU, GLAUKO, NEXION bez wykonania od 4 września — powinny odżyć teraz,
  gdy orkiestrator znów je zasila.

## Rollback

`unpublish_workflow ol8UAkJNVzPTlnUN`

---

# Poprawka: pollery płatności miały własne klucze (2026-09-06 23:05 UTC)

## Błąd, który wprowadziłem

Przenosząc wywołania edge functions do wrapperów skopiowałem **same adresy URL**,
pomijając nagłówki i body z oryginalnych crontabów. Efekt w `ops_http_failures`
po pierwszym przebiegu kadencji godzinowej o 22:49:

```
403  {"ok":false,"error":"bad_key"}      × 3
403  {"ok":false,"error":"forbidden"}    × 2
401  {"ok":false,"err":"unauthorized"}   × 1
```

Oryginały przekazywały klucze, których moja wersja nie miała:

| edge function | czego wymaga |
|---|---|
| `mv-stripe-poll`, `nx-stripe-poll`, `aureu-ads-straznik` | `body.k` = `app_config.office_key` |
| `domykacz-executor` | nagłówek `x-exec-key` = `app_config.domykacz_exec_secret` |
| `stripe-poll` | nic — sam `Content-Type`, żadnego klucza |
| `gmail-imap-poll` | klucz w query stringu `?k=…` |

Dorzucenie nagłówków `apikey`/`Authorization` z klucza `anon` też szkodziło —
te funkcje ich nie oczekują.

## Naprawa i dowód

Nagłówki i body odtworzone **1:1** z `backup_wygaszenie_20260904`. Test bezpośredni:

| request | edge function | wynik |
|---|---|---|
| 242190 | `stripe-poll` | **200** `{"ok":true,"checked":0,"inserted":0}` |
| 242191 | `mv-stripe-poll` | **200** `{"ok":true,"mapowanie_linkow":135}` |
| 242192 | `nx-stripe-poll` | **200** `{"ok":true,"payment_links_seen":100,"nexion_links_mapped":6}` |

Wykrywanie płatności realnie wróciło: 135 zmapowanych linków płatniczych MV
i 6 linków Nexion.

## Wniosek na przyszłość

Przy przenoszeniu crontabu do wrappera trzeba skopiować **całe wywołanie** —
URL, nagłówki, body i timeout — a nie sam adres. `backup_wygaszenie_20260904`
trzyma pełne komendy i jest jedynym źródłem prawdy o tym, czego dana funkcja wymaga.
