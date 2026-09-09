# Korekta modelu GLAUKO: handoff, nie sprzedaz (2026-09-07)

## Blad, ktory naprawiam

Traktowalem HOT GLAUKO jak CASH TODAY. To bledne. Model jest inny:

```
MV/KG: POZYSKUJE LEAD -> KWALIFIKUJE -> PRZEKAZUJE DO REALIZACJI
                                             |
                        po handoff MV = WATCHDOG, nie CLOSER
```

HOT GLAUKO = **BIG MONEY PIPELINE**, nie przychod dzisiaj.

## Dwa oddzielne silniki

`sales_opportunities.engine`:

- **A_CASH_NOW** — 58 szans. MV Automation, Audyt, Phase-0, NEXION, AUREU, job opportunities.
  Lejek: LEAD -> OFFER -> CHECKOUT -> PAID.
- **B_BIG_MONEY** — 2 szanse. GLAUKO.
  Lejek: DISCOVER -> QUALIFY -> HANDOFF -> MONITOR -> PAYMENT TRIGGER -> REVENUE DUE -> PAID.

Lejki sie nie mieszaja.

## Etapy GLAUKO (`glauko_status`)

`QUALIFIED -> HANDED_OFF -> ACCEPTED -> TECHNICAL_CONTACT -> SAMPLE_DOC ->
TEST_ANALYSIS -> COMMERCIAL_PROCESS -> ORDER_CONTRACT -> REALIZATION ->
PAYMENT_TRIGGER -> REVENUE_DUE -> PAID`

Etapy odczytane z realnego przebiegu spraw w danych, nie wymyslone.

## Pola handoff

`handoff_owner`, `handoff_date`, `expected_value`, `expected_revenue`,
`next_external_milestone`, `expected_payment_trigger`, `last_external_status`,
`next_status_check`.

## MODEL ROZLICZENIA: BRAK DANYCH

Przeszukalem cala konfiguracje GLAUKO — 42 klucze. **Nie ma zapisanych warunkow
prowizji ani modelu rozliczenia z GLAUKOGREEN.** Jest wylacznie
`glauko_internal_margin_confidential = true`.

Zgodnie z poleceniem "NIE WYMYSLAJ warunkow prowizji": `expected_revenue` zostaje
**NULL** we wszystkich rekordach GLAUKO. Zapisane w `app_config.glauko_model_rozliczenia`.

**To jest pytanie do wlasciciela** — bez tego nie da sie policzyc BIG MONEY PIPELINE w zlotowkach.

## Stan dwoch spraw GLAUKO — po weryfikacji dowodow

### CBiD — HANDOFF POTWIERDZONY, status TECHNICAL_CONTACT

Dowod z korespondencji klienta, nie z naszych zalozen:
- 02.09 `a.beben@cbid.pl`: *"w dniu dzisiejszym odbyla sie rozmowa techniczna z Panem Krzysztofem Szuleckim"*
- 03.09: *"pan Krzysztof Szulecki wczoraj zadzwonil do mnie i powiedzial, ze jest z firmy GLAUKOGREEN"*

`handoff_owner` = Krzysztof Szulecki, `handoff_date` = 2026-09-02.
**NIE KONTAKTOWAC KLIENTA.** Kontrola statusu 14.09 — u Szuleckiego, nie u CBiD.

### CHEM-TOP — HANDOFF NIE NASTAPIL, status QUALIFIED

Odpowiedz z 04.09 wyszla z **naszego** systemu (`kontakt@glauko.mvautoai.site`),
nie od Szuleckiego. Klient czeka na probke — a to zobowiazanie po stronie GLAUKOGREEN.

`next_action`: **przekazac Szuleckiemu**, wraz z adresem ze stopki klienta
(ul. Brzozowa 19A, 87-100 Torun, tel. 512 044 972). Nie pisac ponownie do klienta.

## Nowa regula obowiazkowa dla calego JOB ENGINE

**NIGDY nie klasyfikuj leada na podstawie jednej ostatniej wiadomosci.**

Kolejnosc: `THREAD CONTEXT -> PRODUCT -> CAMPAIGN -> OWNER -> HANDOFF STATUS -> NEXT ACTION`.

### Co ta regula wylapala od razu — Szpital Kolno

Sklasyfikowalem go z jednej wiadomosci. Po przeczytaniu **calego** watku:

| co twierdzilem | jak jest naprawde |
|---|---|
| "demo umowione na wtorek" | godzina **NIE** ustalona; poprosilismy o przedzial 9:00-15:00, klientka nie odpisala |
| tor niejasny | MV Recepcja AI, temat "Polaczenia AI", **nie GLAUKO**, zero handoffu |
| cena 6000 PLN | to byla **moja estymacja**, nie ustalenie z klientem |
| "klient ma bol" | odwrotnie: *"staramy sie aby wszystkie polaczenia byly odbierane, jezeli nie mozemy odebrac to oddzwaniamy"* |

Ostatni punkt jest najwazniejszy sprzedazowo. Agnieszka Milewska, Kierownik Rejestracji,
**nie zglasza problemu** — jest ciekawa. Demo musi pokazac to, czego oddzwanianie nie
rozwiazuje: zgloszenia po godzinach i w szczycie. Prezentacja zbudowana na zalozeniu
"tracicie polaczenia" trafi w sciane.
