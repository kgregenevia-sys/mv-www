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

## 2. PRZYCZYNA ŹRÓDŁOWA — dlaczego „nic nie robią"

> **Korekta wobec pierwszej wersji tego dokumentu.** Napisałem wcześniej, że
> problemem jest 97 zadań uruchamianych co minutę. To było błędne odczytanie
> wzorców cron — te harmonogramy (`*/10 * * * *`, `7,37 * * * *`) mają gwiazdki
> w polach godzin, nie minut. Faktyczne obciążenie to ~333 uruchomienia na
> godzinę i ono nie jest przyczyną.

Przyczyną nie jest też zamrożenie wysyłki. Bramki są **otwarte**:
`global_send_freeze=false` (od 2026-09-03 12:56), `mv_send_pause=false`,
`sending_enabled=true`, `glauko_send_enabled=true`, `nexion_send_enabled=true`,
`posrednictwo_send_enabled=true`.

### To była nagła awaria, nie chroniczne przeciążenie

Rozkład uruchomień pg_cron 3 września (UTC):

| Godzina | Startów | Padło |
|---|---|---|
| 05:00–14:00 | 254–333/h | **0–1** |
| 15:00 | 333 | **293** |
| 16:00 | 333 | **321** |
| 17:00 | 210 | **182** |

Ten sam harmonogram pracował bezbłędnie przez cały dzień. Kaskada:

```
15:00:00  ops_refresh_min, mx-gate, mv-safety
          → "canceling statement due to statement timeout"
15:01:00  początek lawiny "job startup timeout"
17:39     38 z 40 ostatnich uruchomień pada
```

### Wąskim gardłem są sloty background workerów, nie zapytania

W trakcie awarii baza jest **bezczynna**: 1 aktywne zapytanie, 20 z 60 połączeń,
brak długich transakcji, brak blokad. Tabele są małe (największa 247 MB)
i zaindeksowane.

| Parametr | Wartość |
|---|---|
| `max_worker_processes` | **6** |
| zajęte na stałe | pg_cron launcher, pg_net worker, logical replication launcher, autovacuum launcher |
| **wolne dla zadań pg_cron** | **~2** |
| szczyt startów w jednej minucie | **13–14** (pełne godziny) |

Przy dwóch slotach i czternastu zadaniach startujących w tej samej minucie
kolejka nie ma jak się rozładować. Do 14:00 zadania kończyły się na tyle
szybko, że mieściły się w oknie. Gdy o 15:00 kilka zapytań przekroczyło
`statement_timeout`, sloty przestały się zwalniać i kaskada stała się
samopodtrzymująca.

**Skutek w danych:** `agent_tasks` — ostatnie zadania utworzone o 14:55.
Rozkład statusów: 7113 `done`, 4104 `no_op`, 3953 `cancelled`, 567 `failed`,
565 `quarantined`.

Padają tory przychodowe: `mv_reply_router_5min`, `potwierdz_wysylke`,
`domykacz-executor-2min`, `re_grunty_potwierdzenie`, `posrednictwo-drain`,
`gmail_imap_poll_5m`.

### Weryfikacja: przerzedzenie NIE naprawiło awarii

Przerzedzenie harmonogramów (49 zadań, ~50% mniej startów) zostało wykonane
o 17:45 UTC. Pomiar w oknie **17:52–18:04, czyli w pełni po zmianie**:

| Moment | Pady |
|---|---|
| przed naprawą (17:39) | 38 z 40 = **95%** |
| pierwszy pomiar (17:49, próbka 17) | 9 z 17 = 53% |
| **pomiar rozstrzygający (17:52–18:04)** | **38 z 45 = 84%** |

Pierwszy pomiar był złudzeniem małej próbki. **Zmniejszenie liczby startów
o połowę nie pomogło — hipoteza „za dużo zadań na ~2 sloty" jest obalona.**

### Właściwa przyczyna: sloty workerów są wyczerpane, a nie zajęte

W trakcie trwającej awarii `pg_stat_activity` pokazuje:

- **zero** background workerów pg_cron (jest tylko `pg_cron launcher`),
- 10 połączeń klientów, baza bezczynna,
- brak blokad i długich transakcji.

Mimo to każde zadanie kończy się `job startup timeout` — pg_cron nie jest
w stanie wystartować **ani jednego** workera, choć nic ich nie zajmuje.
Równolegle własne zapytania diagnostyczne regularnie kończą się
„Connection terminated due to connection timeout" — instancja ma problem
z uruchamianiem nowych procesów i przyjmowaniem nowych połączeń, a nie
z obciążeniem.

To objaw wycieku slotów `max_worker_processes`: workery zakończyły się
nieprawidłowo, a sloty nie wróciły do puli. Stan tego typu nie ustępuje sam
i nie da się go naprawić z poziomu SQL.

~~Jedyne skuteczne rozwiązanie: restart instancji Postgres.~~
**Ta teza również okazała się błędna** — patrz sekcja niżej. Awaria ustąpiła
samoistnie o 18:45, bez restartu.

Przerzedzenie zostawiono w mocy: nie szkodzi, a po restarcie zmniejsza ryzyko
powrotu kaskady. Cofnięcie: `n8n/rollback-cron.sql`.

### ROZWIĄZANIE: awaria ustąpiła samoistnie o 18:45, bez restartu

| Fakt | Wartość |
|---|---|
| ostatnie nieudane uruchomienie | **2026-09-03 18:44:00 UTC** |
| pierwsze udane po nim | **2026-09-03 18:45:00 UTC** |
| uruchomień od tego czasu | **119, z czego 0 nieudanych** |
| godzina 19:00–19:15 | 81 startów, **0 padów** |
| `pg_postmaster_start_time()` | **2026-07-10 00:21 UTC** |

Instancja działa nieprzerwanie od 10 lipca — **restartu nie było**.

To obala trzecią hipotezę z tego dokumentu (wyciek slotów `max_worker_processes`,
„stan nie ustępuje sam, konieczny restart"). Stan ustąpił sam po 3 godzinach
i 44 minutach, bez żadnej ingerencji w instancję.

**Uczciwy wniosek: definitywnej przyczyny nie ustalono.** Przebieg — nagły
początek, brak korelacji z obciążeniem, brak blokad i długich transakcji,
brak reakcji na zmniejszenie liczby zadań o połowę, samoistne ustąpienie —
wskazuje na czynnik przejściowy po stronie platformy Supabase (ograniczenie
zasobów instancji, throttling lub problem hosta), a nie na konfigurację
harmonogramu ani na kod.

Przerzedzenie harmonogramów weszło o 17:45, a awaria trwała jeszcze godzinę,
więc **nie ono ją zakończyło**. Zmniejszyło natomiast zaległą kolejkę: o 18:00
było 223 startów, o 19:00 już tylko 81 przy zerowej awaryjności.

### Stan po powrocie (2026-09-03 19:15 UTC)

| Wskaźnik | Wartość |
|---|---|
| `agent_tasks` — ostatnie zadanie | 19:15:00, czyli na bieżąco |
| zadania utworzone po 18:30 | 13 |
| `emails_sent_today()` | **213** (funkcja znów odpowiada) |
| pady pg_cron | **0** |

Agenci pracują. Diagnostyka bazy przestała się timeoutować.

### Wnioski na przyszłość

1. Awaria tej klasy nie ma sygnalizacji — trwała 3 godziny 44 minuty i nikt
   by o niej nie wiedział, gdyby nie ręczny audyt. System nie ma alarmu
   na „pg_cron przestał startować zadania".
2. Alarm powinien wykrywać udział `job startup timeout` w ostatnich
   uruchomieniach, np. próg 20% w oknie 15 minut.
3. Orkiestrator w n8n jest na to odporniejszy: nie zależy od
   `max_worker_processes`, a jego węzeł alarmowy raportuje każdy nieudany cykl.

## 3. WYKONANE

1. **Backup harmonogramu** — tabele `backup_cron_job_20260903` oraz
   `backup_cron_schedule_20260903` (po 174 wiersze, pełna definicja zadań
   pg_cron wraz z `command`, `schedule` i `active`).
2. **Przerzedzenie harmonogramów** (`n8n/przerzedzenie-cron.sql`) — próba naprawy,
   która NIE usunęła awarii (patrz weryfikacja wyżej), ale jest nieszkodliwa
   i zostaje w mocy:
   zadania częstsze niż 15 min → 15 min, zadania 15–29 min → 30 min, offsety
   zachowane modulo nowy krok. **49 zadań zmienionych, 0 wyłączonych,
   151 aktywnych bez zmian** — żaden tor nie został zatrzymany, zmieniła się
   wyłącznie częstotliwość. Ślad w `ops_events` jako `CRON_PRZERZEDZENIE`.
3. **Jeden wspólny kod n8n** — `n8n/mv-orkiestrator-master.js`,
   wdrożony jako workflow `ol8UAkJNVzPTlnUN`
   („MV ORKIESTRATOR MASTER - jeden system”), **nieaktywny**.
   Walidacja SDK: `valid`, 13 węzłów.
4. **Test uruchomienia** (execution 112946): workflow zatrzymał się na własnej
   bramce bezpieczeństwa — „Brak MV_ORCH_TOKEN lub MV_SUPABASE_ANON”. Zachowanie
   zgodne z projektem: bez skonfigurowanych sekretów orkiestrator nie startuje.
5. **Weryfikacja kontraktu RPC** — wszystkie 32 funkcje wywoływane przez orkiestrator
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

Klucz do stabilności: **batch = 1**. Zamiast kilkunastu zadań walczących
o ~2 wolne sloty background workerów Postgresa, baza dostaje jedno wywołanie
naraz, a współbieżnością steruje n8n.

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
`backup_cron_schedule_20260903` i `backup_cron_job_20260903`, przywracany
skryptem `n8n/rollback-cron.sql`.

## 5. DO DECYZJI — bez tego system nadal będzie stał

### Decyzja A: alarm na cichą awarię pg_cron (priorytet 1)

Awaria z 3 września trwała 3 godziny 44 minuty i nie wywołała żadnego
powiadomienia. Wykryto ją wyłącznie ręcznym audytem. To najpilniejsza luka:
system nie wie, kiedy przestaje działać.

Proponowany próg: udział `job startup timeout` powyżej 20% w oknie 15 minut
→ alarm do właściciela. Zapytanie kontrolne:

```sql
with t as (select status from cron.job_run_details order by runid desc limit 40)
select count(*) filter (where status='failed')::numeric / count(*) from t;
```

### Decyzja B: uruchomienie orkiestratora

Po przywróceniu instancji: tory powinien prowadzić jeden orkiestrator w n8n,
bo tam współbieżność jest sterowana (`batch = 1`), a nie zależy od
`max_worker_processes` Postgresa.

Kolejność bezpiecznego wdrożenia:
1. Ustawić zmienne środowiskowe w n8n, `MV_ORCH_TRYB=DRY`.
2. Uruchomić orkiestrator ręcznie, sprawdzić `orch_runs` (tor `ORKIESTRATOR`).
3. Wykonać `odciazenie-cron.sql` (wyłącza zadania przejęte przez orkiestrator).
4. Aktywować orkiestrator, obserwować 60 minut: `cron.job_run_details` bez
   `job startup timeout`, `agent_tasks` z nowymi wierszami.
5. Dopiero wtedy `MV_ORCH_TRYB=LIVE`.

### Decyzja C: rotacja sekretów

Token `p_token` i klucz anon są plaintextem w węzłach dziesiątek workflow n8n.
Rekomendacja: rotacja tokenu i przeniesienie do zmiennych środowiskowych
oraz credentials n8n. Wymaga jednoczesnej aktualizacji funkcji `orch_auth`.

### Decyzja D: wygaszenie zdublowanych workflow

Po potwierdzeniu, że orkiestrator prowadzi tory, dezaktywować stare ORCH-y:
`Cl6mJ8gN2UiqVYQA` (Biuro 13 agentów), `u9BBHB7tVOjA4ekr` (Dyspozytor i QA),
`gKs0jxqPoQ8Qhfj2` (NEXION Growth), `8H9YVqYelS6ZPQoW` (AUREU Curator),
`e08foCnkk1ys2arn` (MV Content i Watchdog), `LipWSUzbq7zI9aVM` (Glaukogreen Scout),
`yAY2FzhmttzhKut9` (Publikator Facebook).

### Decyzja E: uspójnienie rejestru agentów

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
