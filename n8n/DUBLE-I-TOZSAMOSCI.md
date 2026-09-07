# Duble wysylki i chaos tozsamosci (2026-09-07)

## Czesc 1: przyczyna dubli — wyscig, nie zla regula

`office.anty_flood` byla logicznie poprawna: max 1 mail na adres na 24 h,
minimalny odstep 20 h, liczone po odbiorcy niezaleznie od nadawcy.

Problem: czytala **`email_events`**, ktore zapisuje dopiero **webhook Resend**,
asynchronicznie. Dwa rownolegle przebiegi pytaly bramke w tej samej sekundzie,
obie widzialy "brak poprzedniej wysylki" i obie przepuszczaly.

Stad duble z odstepem **0 s** (`gmina@aleksandrow-lodzki.pl`, `apteka@wim.mil.pl`)
i **7 s** (`biuro@belnihel.pl`).

### Naprawa

1. **Slad proby zapisywany synchronicznie.** `office.outbound_allowed` przy decyzji
   ALLOW dla klas COLD_OUTREACH / SALES_FOLLOWUP dopisuje do `email_events` wiersz
   `event_type='attempt'` w tej samej transakcji co decyzja.
2. **Straz wyscigu w `anty_flood`**: jesli istnieje `attempt` z ostatnich **15 minut**,
   blokada `ANTY_FLOOD_WYSCIG`. Reguly 24 h / 20 h licza teraz `sent` **i** `attempt`.
3. Okno 15 minut, a nie 24 h, celowo — lapie wyscig, ale nie blokuje ponowienia
   po nieudanej wysylce.

Wymagalo rozszerzenia `email_events_event_type_check` o wartosc `attempt`.
Bez tego insert leial cicho do kosza (bramka ma `exception when others then null`).

### Dowod

```
proba 1 -> {"block": false, "reason": "PIERWSZY_KONTAKT"}
[bramka zapisuje slad proby]
proba 2 -> {"block": true,  "reason": "ANTY_FLOOD_WYSCIG"}
```

Dodatkowo `n8n_tick_wysylka` ma `pg_try_advisory_lock(778811)` — dwa nakladajace sie
przebiegi sa niemozliwe, drugi konczy sie `{"pominieto":"inny przebieg wysylki trwa"}`.

Backup: `backup_antyflood_20260907`.

## Czesc 2: 47 tozsamosci nadawcy w 30 dni

123 firmy dostaly po kilka maili, **108 z nich od roznych nadawcow**.

Koszt policzalny:

- **Pawel Kuczera**: „Napisal Pan do mnie z dwoch roznych maili. Otrzymalem ta sama
  wiadomosc od Wojciecha Kozakowskiego i Michala Gajdy…"
- **Arca Medica**: kliknal TAK o 06:40:06, o 06:40:09 dostal oferte podpisana
  **„Albestia Kozakowski"**, nastepnego dnia kolejny mail od innego nadawcy. Cisza.

Zrodlo „Albestii" znalezione i usuniete: funkcja `mv_podpis()` miala nazwisko
wpisane na sztywno. Wyczyszczone z 8 funkcji (`mv_podpis`, `lead_klik_tak`,
`kampania_kliniki`, `kampania_posrednictwo`, `mv_coldmail_burst`,
`investor_outreach_tick`, `ruslan_run`, `lux_cobroker_biuro_tick`).
Backup: `backup_albestia_20260907`.

### Mapa tozsamosci — jedno zrodlo prawdy

`app_config.tozsamosc_tor_*`. Zmiana nadawcy w torze = zmiana klucza, nie kodu.

| tor | nadawca |
|---|---|
| MV | MV Automation |
| GLAUKO | GLAUKOGREEN |
| NEXION | NEXION — KG Regenevia |
| AUREU | AUREU |
| posrednictwo | **DO DECYZJI WLASCICIELA** |
| ziemia | **DO DECYZJI WLASCICIELA** |

### Sprzecznosc do rozstrzygniecia

W bazie stoi walidator `public.tresc_waliduj`:

```sql
IF t ~ 'michał gajda|michal gajda|wojciech kozakowski'
  THEN v := array_append(v,'zakazane nazwisko');
```

Nazwisko **Wojciech Kozakowski jest tam oznaczone jako zakazane** — obok Michala Gajdy.
Jednoczesnie `app_config.podmiot_reprezentacja = 'Wojciech Kozakowski'`, a w ostatnich
dniach z tym nazwiskiem wyszlo **463 maile** (grunty i premium).

Nie zmieniam tego samodzielnie. Decyzja wlasciciela: albo zdejmujemy nazwisko
z walidatora i zostaje jako nadawca posrednictwa/ziemi, albo tory przechodza
na nazwe firmowa i wtedy trzeba przepisac workflow n8n
(`POSREDNICTWO PREMIUM · Wysylka`, `GRUNTY n8n · Wysylka oferty`).
