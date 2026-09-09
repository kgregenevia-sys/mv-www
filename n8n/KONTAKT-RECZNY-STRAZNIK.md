# Straznik kontaktu recznego (2026-09-07)

## Moj blad

Napisalem, ze handoff CHEM-TOP nie nastapil i ze nie mam kanalu do Szuleckiego.
**Oba twierdzenia byly falszywe.** Handoff byl zrobiony i zapisany w bazie:

```json
ops_events id=170454, 2026-09-05 10:23:43, event_type=KONTAKT_RECZNY, source=wlasciciel
{"kto": "Krzysztof Szulecki",
 "co": "probka glaukonitu + karta oferty",
 "email": "cezary.topolski@chem-top.pl",
 "kanal": "recznie, poza systemem",
 "skutek": "lead zamkniety jako obsluzony - automat i follow-up NIE moga go juz dotknac",
 "zrodlo_informacji": "wlasciciel potwierdzil 05.09"}
```

Szukalem kontaktu do Szuleckiego w `app_config` i w Gmailu. Nie sprawdzilem
`ops_events`, gdzie caly handoff byl opisany od dwoch dni.

## To sie juz raz zdarzylo i kosztowalo wiarygodnosc

W historii sa dwa zapisy tego samego bledu:

```
GLAUKO_ROZMOWA_ODHACZONA:
"2026-08-31 wlasciciel napisal 'juz odpowiednia osoba dzwoni' - nie zapisalem tego
 w bazie, wiec automat 2026-09-02 21:00 zaprzeczyl klientowi"

AUTOODPOWIEDZI_WSTRZYMANE:
"automat zaprzeczyl klientowi, ze wlasny czlowiek sie z nim kontaktowal"
"automat podwazyl wiarygodnosc wlasnego handlowca wobec kierownika laboratorium CBiD"
```

Skutek tamtego bledu: trzeba bylo wyslac do CBiD sprostowanie z przeprosinami
i wylaczyc autoodpowiedzi (`reply_autosend_enabled` true -> false).

## Naprawa systemowa

`public.kontakt_reczny_check(email)` — czyta `ops_events` typu `KONTAKT_RECZNY`
i zwraca, czy sprawe przejal czlowiek poza systemem, kto i kiedy.

Wpiete na **poczatku** `cash_today_score`. Sprawa przejeta recznie:

- dostaje `cash_today_score = 0` i `ttc = TTC-D`,
- nigdy nie trafia do listy CASH TODAY,
- nie generuje zadnej akcji.

Dowod:

```json
{"id":617,"score":0,"ttc":"TTC-D",
 "powod":"SPRAWE PRZEJAL CZLOWIEK POZA SYSTEMEM - nie dotykac",
 "kto":"Krzysztof Szulecki"}
```

Dodatkowo `cezary.topolski@chem-top.pl` wpisany do `mv_suppression` z powodem
wskazujacym na handoff — twarda blokada dla kazdego automatu wysylkowego.

## Stan CHEM-TOP

| pole | wartosc |
|---|---|
| glauko_status | **HANDED_OFF** |
| handoff_owner | Krzysztof Szulecki (GLAUKOGREEN) |
| handoff_date | 2026-09-05 10:23 |
| kanal | recznie, poza systemem |
| next_action | **NIC. Nie dotykac.** |
| kontrola statusu | 2026-09-19 |

## Regula na przyszlosc

Przed jakakolwiek akcja na leadzie sprawdzam **cztery** zrodla, nie dwa:
`mv_suppression`, `reply_capture`, `sales_opportunities` **oraz `ops_events`**.
Zapis o recznym kontakcie wlasciciela jest nadrzedny wobec wszystkiego,
co widzi automat.
