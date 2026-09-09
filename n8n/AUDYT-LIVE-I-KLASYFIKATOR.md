# Audyt LIVE + naprawa klasyfikatora odpowiedzi (2026-09-07)

Audyt na zywym systemie, nie na raportach. Kazdy stan zweryfikowany zapytaniem.

## Stan systemow

| system | stan | dowod |
|---|---|---|
| Wysylka MV | LIVE | 541 maili dzis, 3090 w 7 dni |
| GLAUKO wysylka | LIVE | 618 maili/7d, brama reply_to odblokowana 07.09 |
| n8n harmonogram | LIVE | 28 aktywnych workflow ze 151 |
| Resend dostarczalnosc | LIVE | 2992/3090 dostarczone (96,8%), bounce 4,1% |
| Reply capture | DEGRADED | 5 wiadomosci wisialo z pustym body (BODY_FETCH_PENDING) |
| Klasyfikator odpowiedzi | **BLOCKED -> naprawiony** | patrz nizej |
| Open/click tracking | **DEAD** | 0 otwarc i 0 klikniec na 3090 maili, wszystkie 7 domen |
| Checkout AUREU | **DEAD** | ostatnie zdarzenie 2026-08-13, 20 wyswietlen, 4 kliki, 0 sprzedazy |
| Stripe linki | LIVE | 53 aktywne, checkout HTTP 200, najtanszy 499 PLN |
| Platnosci | **1 w calej historii** | 2026-08-16, od tego czasu 0 |

## Wady, ktore kosztowaly leady

### 1. `info@`, `support@`, `hello@` uznawane za nadawcow maszynowych

`mv_nadawca_maszynowy` traktowala te adresy jak newslettery. To sa **dokladnie te
adresy, na ktore wysylamy cold maile** (klasa COMPANY_GENERIC). Odpowiedz realnej
firmy z `info@` ladowala jako "newsletter dostawcy" i nikt jej nie ogladal.

Zawezone do prawdziwych adresow maszynowych. Rozpoznawanie marek przeniesione
na domeny (dodane m.in. booking, metricool, make, facebookmail, linkedin,
google, spotify, useme, hubspot, stripe).

### 2. Regex intencji handlowej nie lapal najmocniejszych sygnalow

| wiadomosc | bylo | jest |
|---|---|---|
| „Poprosze probke. I karte." (CHEM-TOP) | UNKNOWN_REVIEW | **HOT** |
| „Mozemy porozmawiac jutro okolo 16?" (Kuczera) | UNKNOWN_REVIEW | **HOT** |
| „czekam na spotkaniu w google meetsie" (Propertique) | NIEISTOTNE | **HOT** |
| „Podaje namiary na osobe techniczna" (CBiD) | NIEISTOTNE | **HOT** |

Przyczyna: wzorzec `rozmow` nie pasuje do slowa **porozmawiac**. Prosba o probke
i karte nie pasowala do niczego. W `hot_replies` bylo **90 rekordow
UNKNOWN_REVIEW zamknietych automatycznie** — to tam gina leady.

### 3. Nowy regex lapal autorespondery

Retro-skan pokazal, ze „dziekujemy za zainteresowanie nasza oferta" i wiadomosci
urlopowe trafialy na HOT. Dodana bramka `AUTOREPLY` **przed** testem intencji.

## Dowod

Dwa zestawy testowe, **21/21 poprawnie**:

- 4 realne sygnaly zakupowe -> HOT
- realna firma z `info@` -> HOT (wczesniej VENDOR_NOTICE)
- 4 newslettery (Booking, Metricool, Facebook, Make) -> VENDOR_NOTICE
- 5 autoresponderow i urlopow -> AUTOREPLY
- zadanie RODO -> OPT_OUT
- odmowa -> NEGATIVE
- smiec bez intencji -> UNKNOWN_REVIEW

Backup: `backup_klasyfikator_20260907` (definicje obu funkcji sprzed zmiany).

## Rollback

```sql
do $$ declare r record; begin
  for r in select def from backup_klasyfikator_20260907 loop execute r.def; end loop;
end $$;
```

## Prawdziwe waskie gardlo

Nie brak leadow. **Brak sygnalu.**

3090 maili w 7 dni -> 0 zmierzonych otwarc -> 0 zmierzonych klikniec ->
~6 realnych odpowiedzi -> 0 platnosci.

Wlasny mechanizm „Kliknal TAK" dal 12 klikniec w 6 tygodni, z czego
**10 to skanery pocztowe**. Realnych klikniec ludzkich: 2.

Kazdy scoring leadow w systemie liczy sie na tych danych.
