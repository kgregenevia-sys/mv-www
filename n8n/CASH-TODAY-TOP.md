# CASH TODAY — realny ranking po odsianiu falszywych sygnalow (2026-09-07)

## Dlaczego 58 rekordow to nie 58 szans

Pierwsza wersja `cash_today_score` dala 10 pozycji TTC-A/B. **Szesc z nich bylo falszywych** —
kliki skanerow pocztowych i autorespondery, ktore sam wczesniej zdemaskowalem, a scoring
wzial historyczne etykiety `reply_capture` zamiast poprawionego klasyfikatora.

Poprawka: sygnal czlowieka liczony **na zywo** przez `mv_klasyfikuj_inbound`, z odrzuceniem:
- `KLIK_TAK` od adresow oznaczonych `lead_tak.bot_ocena.bot = true`,
- AUTOREPLY, VENDOR_NOTICE, NEGATIVE, OPT_OUT.

Wypadli: PAULO DENTAL, STOMATOLOGIA BOROWSKI, ARCA MEDICA, CORTEN MEDIC, HELIMED
(kliki skanera), homebrand.pl i gabinety-novina.pl (autoresponder / odmowa).

## Druga poprawka: luki w danych, nie brak sygnalu

Po pierwszej korekcie wypadli **Kuczera i Szpital Kolno** — bo ich sygnaly nie mialy
zapisanej tresci w `reply_capture`:

- Kuczera: trzy wiadomosci z 06.09 mialy `body_text` puste (`BODY_FETCH_PENDING`),
  tresc pobralem recznie z Resend i nigdy nie wrocila do bazy. Uzupelnione.
- Szpital Kolno: sygnal przyszedl na **Gmail**, a `reply_capture` zbiera tylko Resend inbound.
  Dopisany rekord zrodlowy.

**To jest luka architektoniczna:** sygnaly z Gmaila nie trafiaja do `reply_capture`,
wiec caly scoring ich nie widzi.

## Ranking koncowy — 4 pozycje, nie 10

| # | TTC | score | klient | ostatni sygnal czlowieka | stan |
|---|---|---|---|---|---|
| 1 | TTC-B | **86,2** | Szpital Kolno | 04.09 | termin zaproponowany |
| 2 | TTC-B | 80,9 | Propertique | 02.09 | przeprosiny wyslane |
| 3 | **TTC-A** | 73,8 | Pawel Kuczera | 06.09 | **rozmowa dzis 16:00** |
| 4 | TTC-B | 69,0 | Przychodnia Alfa | 31.08 | follow-up wyslany |
| 5 | TTC-C | 58,9 | DSCM | 19.08 | **zablokowany supresja** |

## Wykonane NEXT ACTIONS

**Szpital Kolno** — odpowiedz w watku Gmail (`1a07a9162e8af798`).
Zaproponowana konkretna godzina: wtorek 08.09, 11:00. Zakres demo przebudowany:
**bez tezy "nie odbieracie telefonow"**, bo klientka wprost temu zaprzeczyla.
Zamiast tego: obsluga po godzinach, szczyt obciazenia, rownolegle polaczenia,
zebranie powodu kontaktu, raport powodow. Zadnych wymyslonych oszczednosci,
zadnej ceny — widelki 3000-8000 PLN **nie byly komunikowane klientowi**.

**Przychodnia Alfa** — follow-up po tygodniu od "przeanalizuje z managerka i wroce"
(Resend `dd794223-6ddb-4b8b-a0dc-6a24ac252c91`). Z jawnym wyjsciem: jedno slowo i wykreslam.

**DSCM — NIE WYSLANE, celowo.** Adres jest w `mv_suppression`
("ODPOWIEDZIAL_POZYTYWNIE_20260819 - przeszedl do sprzedazy"). Prezes Zarzadu
Sebastian Drabik odpisal **TAK** 19 sierpnia, zostawil numer **501 170 942**
i nikt nie oddzwonil przez **19 dni**. Zdjecie supresji to decyzja wlasciciela, nie moja.

## GLAUKO — model roboczy

`glauko_revenue_model = PER_TON`, `glauko_expected_margin_pln_per_ton = 90`,
`glauko_revenue_model_status = DO_WERYFIKACJI_BIZNESOWEJ`.

Kolumny `estimated_tonnage_min/max` i `potential_revenue_min/max` dodane.
**Zadna nie wypelniona** — w danych CBiD i CHEM-TOP nie ma tonazu.
Tonazu nie wymyslam, wiec `expected_revenue` pozostaje NULL.

## CHEM-TOP — handoff przygotowany, NIE wykonany

Powod: **Szulecki nie ma w systemie ani maila, ani numeru.** W `app_config` jest
wylacznie `glauko_ludzie_kontaktowi = "Krzysztof Szulecki - GLAUKOGREEN, kontakt telefoniczny"`.
Przeszukalem Gmail — zero korespondencji z nim.

Pakiet do przekazania (gotowy):
- klient: Cezary Topolski, wlasciciel CHEM-TOP
- chce: **probke glaukonitu + karte materialu**
- adres: ul. Brzozowa 19 A, 87-100 Torun
- telefon: 512 044 972, NIP 879-211-69-39
- cel: testy sorpcyjne
- historia: odpisal 04.09 "Poprosze probke. I karte."; nasz system zapytal o adres,
  ktory byl juz w jego stopce — klient nie odpisal i ma racje

Do CHEM-TOP **nie poszedl** i nie pojdzie kolejny mail.
