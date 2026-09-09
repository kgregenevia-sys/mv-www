# JOB REVENUE ENGINE — cykl 1 (2026-09-07)

## Wynik: 2 realne opportunities, jedna priorytetu A

Silnik nie zwrocil 500 smieci. Zwrocil dwie rzeczy, ktore realnie leza w skrzynce
i nikt ich nie prowadzil.

### #1 — Szpital Kolno · SCORE 80,2 · PRIORYTET A

| pole | wartosc |
|---|---|
| zrodlo | Gmail, watek `1a06c7a8c731cc5d` |
| klient | Szpital Kolno, `rejestracja@szpitalkolno.pl` |
| opublikowano | 2026-09-04 12:52 |
| co powiedzial | *"Bardzo chetnie zobaczymy jak wyglada zaproponowane rozwiazanie z Panstwa strony"* |
| budzet szac. | 3000-8000 PLN |
| nasza cena | 6000 PLN |
| koszt szac. | 800 PLN |
| **marza** | **7200 PLN** (wzgledem gornego widelka) |
| TTC | TTC-C |
| skladowe score | skill 0,75 / profit 1,0 / win 0,60 / speed 0,78 / strategic 0,9 |
| **stan** | **DEMO UMOWIONE NA WTOREK 8 WRZESNIA** |

**CAN_WE_DELIVER: TAK.** Recepcja AI to istniejacy produkt MV, nie nowy build.
Wykonawcy: `media_producer` (scenariusz demo), `fabryka_szkicow` (personalizacja),
`domykacz` (zamkniecie). Zapisane rowniez do `sales_opportunities` id=626.

### #2 — Tom Butcher · SCORE 61,8 · PRIORYTET C

| pole | wartosc |
|---|---|
| zrodlo | n8n Community, ogloszenie "Infra-only n8n work — paid trial" |
| klient | `tom@butcherlawoffice.com` |
| budzet szac. | 500-3000 USD |
| marza | 2500 PLN |
| TTC | TTC-D |
| **stan** | **APLIKACJA JUZ ZLOZONA 06.09 06:26** — czekamy na odpowiedz |

Aplikacja zawierala odpowiedzi na dwa pytania techniczne (podejscie do weryfikacji,
pre-change checks). Nie wymaga zadnej akcji poza czekaniem.

## Filtr REAL_JOB

`job_opportunities.real_job` — rekordy ze zrodel `test`, `test_regresja`, `synthetic`,
`selftest` oraz URL-e `przyklad.test` / `example.com` sa oznaczane `false`
i nie wchodza do pipeline. Indeks czesciowy `ix_job_opp_real ... where real_job`.

Stan: **2 realne, 1 testowy odfiltrowany.**

## Zrodla, ktore zwrocily 0 — z podaniem powodu

| zrodlo | wynik | powod |
|---|---|---|
| Upwork | 0 | tresc ogloszen za loginem, brak credentiali |
| Fiverr | 0 | katalog wykonawcow, nie ogloszen zleceniodawcow |
| Freelancer.com | 0 | tresc i budzety za loginem |
| Contra | 0 | katalog wykonawcow |
| n8n Community | **1** | forum publiczne, czytelne bez logowania |
| Gmail | **1** | skrzynka wlasciciela |
| CRM Supabase | 0 nowych | istniejace leady juz w `sales_opportunities` |

Wniosek operacyjny: **jedyne dwa produktywne zrodla to wlasna skrzynka i forum n8n.**
Marketplace'y bez credentiali nie daja nic — nie da sie z nich czytac tresci ogloszen
bez logowania, a obchodzenia zabezpieczen nie robimy.

## Czego brakuje do pelnego P15

Workflow n8n `JOB_DISCOVERY` nie zostal jeszcze zbudowany — cykl 1 wykonany
recznie przez agenta, zeby najpierw udowodnic, ze zrodla w ogole cokolwiek zwracaja.
Dopiero to uzasadnia budowe harmonogramu.
