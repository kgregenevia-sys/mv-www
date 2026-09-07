# Regresja outbound bez masowej wysylki (2026-09-07 06:00-06:15 UTC)

Cel: udowodnic, ze naprawa dubli dziala, zanim ruszy kolejny pelny cykl.

## TEST 1 — race condition

10 wywolan `office.outbound_allowed` na jeden adres, ten sam tor, ta sama kampania.

```
proba 1  06:05:21.697  ALLOWED:COMPANY_GENERIC
proba 2  06:05:22.104  ANTY_FLOOD:ANTY_FLOOD_WYSCIG
proba 3  06:05:22.109  ANTY_FLOOD:ANTY_FLOOD_WYSCIG
...
proba 10 06:05:22.121  ANTY_FLOOD:ANTY_FLOOD_WYSCIG
```

**PASS** — dokladnie 1x ALLOW, 9x BLOCK.

## TEST 2 — advisory lock i podwojne pobranie z kolejki

Dwa zabezpieczenia, niezalezne od siebie:

1. `n8n_tick_wysylka` — `pg_try_advisory_lock(778811)`, drugi przebieg konczy sie
   `{"pominieto":"inny przebieg wysylki trwa"}`. Obecnosc w kodzie potwierdzona.
2. `mv_wyslij_partie` — pobranie z kolejki przez **`FOR UPDATE SKIP LOCKED`**
   plus przejscie stanu `READY -> CLAIMED` ze stemplem `claimed_by`.
   Porzucone CLAIMED wracaja do READY po 10 minutach.

Kontrola empiryczna: **0 adresow** w `mv_kolejka_wysylki` ze stanem
SUBMITTED/CONFIRMED wystepuje wiecej niz raz.

**PASS**

Zastrzezenie: prawdziwy test dwoch rownoleglych sesji nie jest bezpiecznie
wykonalny z jednego kanalu SQL — zawieszona blokada sesyjna zatrzymalaby produkcje.
Dowod opiera sie na kodzie obu zabezpieczen i na braku podwojnych pobran w danych.

## TEST 3 — synchroniczny attempt

```
attempt zapisany: 06:03:59.556
ALLOW zwrocony:   06:03:59.570
```

Zapis wyprzedza decyzje o 14 ms, bez czekania na webhook Resend.

Ujawniona wada przy okazji: `email_events_event_type_check` nie zawieral wartosci
`attempt`, wiec insert **leial cicho do kosza** (bramka ma `exception when others then null`).
Ograniczenie rozszerzone. Bez tego testu naprawa byla pozorna.

**PASS**

## TEST 4 — retry

| scenariusz | wynik | ocena |
|---|---|---|
| a) retry natychmiast po probie | `ANTY_FLOOD_WYSCIG` | blokada, poprawnie |
| b) po 16 min, brak `sent` | `PIERWSZY_KONTAKT` | przechodzi, poprawnie |
| c) istnieje `sent` z ostatnich 24 h | `ANTY_FLOOD_24H` | blokada, poprawnie |

**PASS po poprawce.** Pierwsze podejscie **FAIL**: liczylem `attempt` do limitu
dobowego, przez co jedna nieudana wysylka blokowala adres na 24 h.
`attempt` sluzy teraz wylacznie 15-minutowej strazy wyscigu; reguly 24 h i 20 h
licza wylacznie potwierdzone `sent`.

## TEST 5 — tozsamosci torow

| tor | oczekiwany | faktyczny | zrodlo |
|---|---|---|---|
| MV | MV Automation | `MV Automation <kontakt@[domena]>` | kod `mv_wyslij_partie` |
| MV podpis | MV Automation | `Pozdrawiam,\nMV Automation\n+48 453 108 326` | `mv_podpis()` |
| GLAUKO | GLAUKOGREEN | `GLAUKOGREEN <kontakt@glauko.mvautoai.site>` | `app_config.glauko_verified_sender` |
| NEXION | z konfiguracji | `NEXION — KG Regenevia <kontakt@mvautoai.site>` | `app_config.nexion_from` |
| AUREU | z konfiguracji | `AUREU <kontakt@send.aureuclub.com>` | `app_config.lux_mail_from` |
| POSREDNICTWO | Wojciech Kozakowski | ustawione | `app_config.tozsamosc_tor_posrednictwo` |
| GRUNTY | Wojciech Kozakowski | ustawione | `app_config.tozsamosc_tor_ziemia` |

**PASS**

### Sprostowanie

Wczesniej zglosilem "sprzecznosc": walidator `tresc_waliduj` blokuje nazwisko
Wojciech Kozakowski. Sprawdzenie sygnatury pokazalo
`tresc_waliduj(p_brand, p_caption, p_hashtags)` — to walidator **tresci social media**,
nie maili. Na sciezce wysylki nie ma konfliktu. Walidator zostawiony bez zmian.

## TEST 6 — skan hardcode

Strona SQL i konfiguracji: **czysto**. Zero wystapien "Albestia" w funkcjach.
Nazwisko "Gajda" wystepuje juz tylko w samej regule zakazu (`tresc_waliduj`)
i w notatkach statusu Instagrama — poza sciezka wysylki.

Strona n8n: **FAIL**. Cztery aktywne workflow wysylkowe maja **14 literalow
tozsamosci wpisanych na sztywno** i **ani jednego odwolania do `app_config`**.

Najgrozniejsze: workflow `zMvQH4q85DKb3GsV` (AUTOPILOT ODPOWIEDZI), ktory
automatycznie odpowiada goracym leadom, wciaz zawieral:

```
RECEPCJA: { od: 'Albestia Kozakowski <...>',
            podpis: 'Albestia Kozakowski\nKierownik zespolu MV Automation\n...' }
```

To ten sam podpis, ktory dostala Arca Medica 3 sekundy po kliknieciu TAK.

## TEST 7 — dry run 50 rekordow kolejki

| pozycja | wynik |
|---|---|
| input | 50 |
| qualified | 50 |
| blocked RODO | 0 |
| blocked suppression | 0 |
| blocked anti-flood | 0 |
| ready_to_send | 50 |
| **duplicate recipients** | **0** |
| **wrong identity** | **0** |

**PASS**

## Sprzatanie

Adres testowy i wszystkie jego zdarzenia usuniete. `attempt` w bazie: 0.

## Backupy

`backup_antyflood_20260907`, `app_config.backup_n8n_tick_wysylka_20260907`,
`backup_albestia_20260907`, `backup_klasyfikator_20260907`.
