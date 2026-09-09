# TOR B — Job Hunter: warstwa danych i scorer (2026-09-07)

## Co powstalo

Cztery tabele, wszystkie z deduplikacja, indeksami, ograniczeniami stanu:

- `job_opportunities` (25 kol.) — klucz deduplikacji `source|source_url` generowany
  kolumna STORED + UNIQUE, wiec to samo ogloszenie z tego samego zrodla nie wejdzie dwa razy
- `job_proposals` (15 kol.) — FK do opportunity, statusy DRAFT / READY_TO_SEND / SENT / ACCEPTED / REJECTED
- `job_projects` (12 kol.) — ACCEPTED / IN_PROGRESS / QA / DELIVERED / PAID / CANCELLED
- `job_deliveries` (12 kol.) — QA_PENDING / QA_PASS / QA_FAIL / NEEDS_FIX

Nie utworzono `job_tasks` — subtaski wykonawcze ida do istniejacego `agent_tasks`
(46 kolumn, 17 619 rekordow, dziala). Nie utworzono `agent_runs` — jest `orch_runs`.

## Scorer B2

`public.job_policz_score(id)` — dokladnie wzor z briefu:

```
SCORE = 0.30*skill_match + 0.25*expected_profit + 0.20*win_probability
      + 0.15*execution_speed + 0.10*strategic_value
```

- `skill_match` — pokrycie `required_skills` naszym stackiem
  (n8n, Make, Zapier, OpenAI, Claude, API, webhook, Supabase, Postgres, CRM, chatbot, agent, landing, MVP)
- `expected_profit` — marza wzgledem sufitu 5000 PLN
- `execution_speed` — 1,0 przy <4 h, liniowo do 0 przy 40 h
- `strategic_value` — 0,9 dla audytow / n8n / integracji / automatyzacji, inaczej 0,4

Progi: A >= 80, B 65-79, C 50-64, IGNORE < 50.

### Dowod dzialania

Rekord testowy id=1, "Audyt i naprawa workflow n8n", budzet 1500-2500 PLN,
6 h pracy, koszt 300 PLN, win 0,55:

```json
{"id":1,"ok":true,"score":75.2,"priority":"B","marza_pln":2200,
 "skladowe":{"skill_match":1,"expected_profit":0.44,"win_probability":0.55,
             "execution_speed":0.94,"strategic_value":0.9}}
```

Rekord oznaczony `source='test_regresja'` — do usuniecia przed produkcja.

## Czego jeszcze NIE ma

Workflow n8n dla JOB_DISCOVERY / JOB_SCORE / JOB_PROPOSAL / JOB_EXECUTION /
JOB_QA / JOB_DELIVERY / JOB_REVENUE. Agenci B1, B3-B8. Zrodla ogloszen.
