# Jeden spójny system MV — audyt i plan scalenia

Data audytu: 2026-09-03. Wszystkie liczby poniżej pochodzą z odpytania działającej
instancji n8n (`n8n.kgregenevia.pro`) i bazy Supabase `mdsvcobwuezriexyqqby`.

## 1. POTWIERDZONE — co faktycznie stoi

### Warstwy

| Warstwa | Stan |
|---|---|
| n8n | 136 workflow, w tym **68 aktywnych** |
| Supabase (Postgres 17) | **786 funkcji** RPC w schemacie `public` |
| pg_cron | 174 zadania, w tym **151 aktywnych** |
| Repo `mv-www` | strona statyczna `mvautoai.net` (bez kodu automatyzacji) |
| Notion | Ops Hub „MV Automation — Centrala”, mapa systemu z 2026-06-11 |

### Agenci

`biuro_agenci` zawiera **20 aktywnych agentów**, nie 13. Nazwa workflow
„ORCH - Biuro 13 agentow 24/7” jest nieaktualna. Rejestry są rozjechane —
raport z Notion (2026-08-31) odnotował `ai_agents` = 16 vs `office_agent_registry` = 28.

Agenci wg marek:
- **MV** (16): nadzorca, qa_judge, matcher, publikator, media_producer,
  content_distribution, product_marketing, zaangazowanie_ig, strateg, domykacz,
  reply_router, zwiadowca, analityk, fabryka_szkicow, wartownik_mail, broker, yt_agent
- **AUREU** (2): kurator, wartownik_licytacji
- **NEXION** (1): nexion_growth

Linie biznesowe obsługiwane przez RPC (potwierdzone sygnatury):
GLAUKO, pośrednictwo, sprzedaż ziemi/nieruchomości (`re_*`, `lux_*`),
Purpurowy Kod (`kp_*`, `pk_*`), social (`social_*`, `mv_publikator_*`).

### Architektura faktyczna

n8n jest **cienką warstwą** — węzły to w praktyce `httpRequest` → `POST /rest/v1/rpc/<funkcja>`.
Cała logika biznesowa siedzi w funkcjach Postgres. Ten sam token i klucz anon
są wklejone plaintextem w węzłach dziesiątek workflow.

## 2. PRZYCZYNA ŹRÓDŁOWA — dlaczego „nic nie robią”

Nie jest nią zamrożenie wysyłki. Bramki są **otwarte**:
`global_send_freeze=false` (od 2026-09-03 12:56), `mv_send_pause=false`,
`sending_enabled=true`, `glauko_send_enabled=true`, `nexion_send_enabled=true`,
`posrednictwo_send_enabled=true`.

Przyczyną jest **wysycenie instancji bazy**:

| Parametr | Wartość |
|---|---|
| `max_worker_processes` | **6** |
| `cron.max_running_jobs` | 32 |
| `max_connections` | 60 |
| aktywne zadania pg_cron | 151 |
| z tego uruchamiane co minutę | **97** |

pg_cron startuje każde zadanie jako osobny background worker. Przy 6 dostępnych
workerach i 97 zadaniach na minutę zadania nie mają na czym wystartować.

**Dowód:** na 3000 ostatnich uruchomień `cron.job_run_details` — **589 nieudanych
(19,6%)**, dominujący komunikat: `job startup timeout`. Dotyka to torów przychodowych:
`mv_reply_router_5min` (22 pady), `potwierdz_wysylke` (22), `domykacz-executor-2min` (21),
`re_grunty_potwierdzenie` (22), `posrednictwo-drain` (11), `gmail_imap_poll_5m` (18).

**Drugi dowód:** podczas audytu baza wielokrotnie odrzucała nawet trywialne zapytania
(`select max(created_at) from email_events`, `select state from pg_stat_activity`,
`select mv_heartbeat()`) — „Connection terminated due to connection timeout”.
Tabele są małe (największa 247 MB) i mają indeksy, więc to nie kwestia danych,
tylko braku zasobów wykonawczych.

**Skutek widoczny w danych:** `agent_tasks` — ostatnie zadania utworzone o 14:55,
przy audycie o 16:46. Rozkład statusów: 7113 `done`, 4104 `no_op`, 3953 `cancelled`,
567 `failed`, 565 `quarantined`. Ponad połowa cyklu pracy agentów kończy się bez efektu.

## 3. WYKONANE

1. **Backup harmonogramu** — tabela `backup_cron_job_20260903` (174 wiersze,
   pełna definicja każdego zadania pg_cron wraz z `command` i `active`).
2. **Jeden wspólny kod n8n** — `n8n/mv-orkiestrator-master.js`,
   wdrożony jako workflow `ol8UAkJNVzPTlnUN`
   („MV ORKIESTRATOR MASTER - jeden system”), **nieaktywny**.
   Walidacja SDK: `valid`, 13 węzłów.
3. **Test uruchomienia** (execution 112946): workflow zatrzymał się na własnej
   bramce bezpieczeństwa — „Brak MV_ORCH_TOKEN lub MV_SUPABASE_ANON”. Zachowanie
   zgodne z projektem: bez skonfigurowanych sekretów orkiestrator nie startuje.
4. **Weryfikacja kontraktu RPC** — wszystkie 32 funkcje wywoływane przez orkiestrator
   sprawdzone w `pg_proc` pod kątem nazwy i sygnatury. Zero zgadywania parametrów.

## 4. Jak działa orkiestrator

```
Zegar 5 min
  └─ Plan cyklu (Code) ─ router: 30 torów, każdy z własnym cadence i klasą
       └─ Czy jest co robić (IF)
            └─ Kolejka torów (batch = 1, SEKWENCYJNIE)
                 ├─ Wywołaj RPC (3 próby, 45 s, błąd nie zabija cyklu)
                 ├─ Ocena wyniku (kod HTTP → sukces/błąd)
                 ├─ Zapis do orch_runs (orch_log_run)
                 └─ następna partia
            └─ po pętli: Podsumowanie → zapis zbiorczy → alarm gdy błędy
```

Klucz do stabilności: **batch = 1**. Zamiast 97 równoległych zadań na minutę
baza dostaje jedno wywołanie naraz.

### Tory

| Klasa | Tory |
|---|---|
| sterowanie | BIURO (`mv_biuro_tick`, `orch_tick`, `mv_dyspozytor_tick`, `orch_qa_tick`), REPLY (`mv_reply_klasyfikuj`, `mv_domena_ramp`) |
| zdrowie | `mv_heartbeat`, `mv_guard_tick`, `mv_stuck_watchdog`, `system_watchdog`, `orch_watchdog`, `glauko_health_tick`, `revenue_controller` |
| leady | GLAUKO (`glauko_ted_tick`), ZIEMIA (`re_skaner_tick`), LUX (`lux_cobroker_biuro_tick`), POŚREDNICTWO (`posrednictwo_biuro_tick`, `posrednictwo_refill_kolejka`) |
| treści | MV (`mv_publikator_generuj`), AUREU (`aureu_content_tick`), PURPUROWY KOD (`kp_oferta_tick`) |
| publikacja | `mv_aureu_publish_tick`, `kp_ig_tick` |
| wysyłka | MV, GLAUKO (+followup), NEXION, ZIEMIA, POŚREDNICTWO, PURPUROWY KOD |

### Konfiguracja (zmienne środowiskowe n8n)

| Zmienna | Rola |
|---|---|
| `MV_SUPABASE_URL` | opcjonalna, domyślnie projekt produkcyjny |
| `MV_SUPABASE_ANON` | klucz anon Supabase — **wymagany** |
| `MV_ORCH_TOKEN` | token `p_token` do RPC — **wymagany** |
| `MV_ORCH_TRYB` | `DRY` (domyślnie, bez wysyłek) albo `LIVE` |
| `MV_ALERT_KANAL` | kanał alarmu, domyślnie `ops` |

Sekrety są w jednym miejscu zamiast w setkach węzłów. Bramki bezpieczeństwa wysyłki
(`hard_stop`, capy dzienne, freeze) pozostają po stronie RPC — orkiestrator ich nie omija.

### Rollback

Dezaktywacja workflow `ol8UAkJNVzPTlnUN`. Harmonogram pg_cron w
`backup_cron_job_20260903`, przywracany skryptem `n8n/rollback-cron.sql`.

## 5. DO DECYZJI — bez tego system nadal będzie stał

### Decyzja A: odciążenie pg_cron (priorytet 1)

Sam orkiestrator nie pomoże, dopóki 97 zadań na minutę zajmuje 6 workerów.
Skrypt `n8n/odciazenie-cron.sql` wyłącza zadania, których tory przejmuje
orkiestrator, i zostawia resztę nietkniętą. Jest w pełni odwracalny.

Kolejność bezpiecznego wdrożenia:
1. Ustawić zmienne środowiskowe w n8n, `MV_ORCH_TRYB=DRY`.
2. Uruchomić orkiestrator ręcznie, sprawdzić `orch_runs` (tor `ORKIESTRATOR`).
3. Wykonać `odciazenie-cron.sql`.
4. Aktywować orkiestrator, obserwować 60 minut: `cron.job_run_details` bez
   `job startup timeout`, `agent_tasks` z nowymi wierszami.
5. Dopiero wtedy `MV_ORCH_TRYB=LIVE`.

### Decyzja B: rotacja sekretów

Token `p_token` i klucz anon są plaintextem w węzłach dziesiątek workflow n8n.
Rekomendacja: rotacja tokenu i przeniesienie do zmiennych środowiskowych
oraz credentials n8n. Wymaga jednoczesnej aktualizacji funkcji `orch_auth`.

### Decyzja C: wygaszenie zdublowanych workflow

Po potwierdzeniu, że orkiestrator prowadzi tory, dezaktywować stare ORCH-y:
`Cl6mJ8gN2UiqVYQA` (Biuro 13 agentów), `u9BBHB7tVOjA4ekr` (Dyspozytor i QA),
`gKs0jxqPoQ8Qhfj2` (NEXION Growth), `8H9YVqYelS6ZPQoW` (AUREU Curator),
`e08foCnkk1ys2arn` (MV Content i Watchdog), `LipWSUzbq7zI9aVM` (Glaukogreen Scout),
`yAY2FzhmttzhKut9` (Publikator Facebook).

### Decyzja D: uspójnienie rejestru agentów

Trzy rejestry (`biuro_agenci` 20, `ai_agents` 16, `office_agent_registry` 28)
opisują tę samą kadrę pod różnymi nazwami. Do wyboru jedno źródło prawdy —
rekomendacja: `biuro_agenci`, bo to na nim operuje `mv_biuro_tick`.

## 6. ZABLOKOWANE

- Pomiar wysyłek i przychodu z ostatniej doby (`emails_sent_today()`,
  agregaty na `email_events`) — baza nie zwraca wyników w limicie czasu.
  Odblokuje się po Decyzji A.
- Podpięcie alarmu Telegram: `alert_telegram(p_text, p_kanal)` istnieje,
  ale poprawna wartość `p_kanal` nie została potwierdzona — węzeł alarmu ma
  `neverError`, więc zły kanał nie wywróci cyklu.
