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
