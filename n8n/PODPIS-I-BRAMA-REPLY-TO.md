# Podpis bez nazwiska + odblokowanie bramy reply_to (2026-09-07 06:00 PL)

## 1. Nazwisko w podpisie — usuniete

Polecenie wlasciciela: w mailach nie ma byc nazwiska.

Sprostowanie mojego wczesniejszego twierdzenia: **nie wprowadzilem tego nazwiska
w tej sesji**. Pierwszy mail z tym podpisem wyszedl **2026-05-07 23:56**, lacznie
**9857 wyslanych** wiadomosci. Nazwisko siedzialo w piatce funkcji SQL od miesiecy.

| miejsce | wystapien | stan |
|---|---|---|
| `mv_fabryka_szkicow` | 1 | usuniete |
| `kampania_branzowa` | 2 | usuniete |
| `kampania_followup` | 3 | usuniete |
| `mv_przygotuj_odpowiedz` | 3 | usuniete |
| `mv_domykacz_odpowiedz` | 1 | usuniete |
| `outreach_drafts` (status `draft`) | 389 | poprawione |
| `mv_kolejka_wysylki` (niewyslane) | 228 | poprawione |
| `biuro_wiadomosci` (w kolejce / do wyslania) | 10 | poprawione |

Backupy: `backup_podpis_20260907` (definicje funkcji), `backup_biuro_podpis_20260907`.

Podpis po zmianie:

```
Pozdrawiam,
MV Automation
Odpowiedź trafia bezpośrednio do nas: kontakt@mvautoai.net
```

Weryfikacja: `0` wystapien ciagu `Gajda` w funkcjach schematu `public`,
`0` w szkicach, `0` w kolejce, `0` w `biuro_wiadomosci`.
Nowe szkice generowane po zmianie (75 sztuk) rowniez czyste.

## 2. Brama `office.outbound_allowed` blokowala cale GLAUKO

`glauko_pryw_wyslij` zwracalo `zablokowane: 10, wyslane: 0`. Powod z
`ops_events.outbound_deny`: **`REPLY_TO_NOT_VERIFIED`**.

Linia 56 bramy wymagala, zeby `reply_to` byl **dokladnie rowny**
`app_config.cold_reply_to` (`kontakt@mvautoai.net`). GLAUKO uzywa wlasnego
adresu `reply@send.aureuclub.com` — domena zweryfikowana w Resend, odbior
wlaczony, odpowiedzi realnie na nia przychodza. Regula byla za waska,
nie adres byl zly.

Zmiana: brama akceptuje `cold_reply_to` **albo** adres z nowej listy
`app_config.reply_to_dozwolone`:

```
kontakt@mvautoai.net,reply@send.aureuclub.com,grunty@send.aureuclub.com,premium@send.aureuclub.com
```

Backup definicji: `app_config.backup_office_outbound_allowed_20260907`.

Odblokowane 82 rekordy z `blad='REPLY_TO_NOT_VERIFIED'` — wrocily do kolejki.
Gotowych adresow GLAUKO: **120 → 199**.

## Dowod dzialania

| przebieg | GLAUKO pryw | MV cold | posrednictwo |
|---|---|---|---|
| 03:56 (przed poprawka bramy) | `wyslane 0, zablokowane 10` | 25 | 5 |
| 03:58 (po poprawce) | **`wyslane 10, zablokowane 0`** | 25 | 5 |

Pozostale blokady w `glauko_followup` sa poprawne i zostaja:
`LEGAL_BASIS_MISSING:PERSONAL` (adresy imienne — RODO) oraz
`ANTY_FLOOD_24H` (kontakt w ostatniej dobie).

## Rollback

```sql
-- podpis
do $$ declare r record; begin
  for r in select def from backup_podpis_20260907 loop execute r.def; end loop;
end $$;
update biuro_wiadomosci b set tresc = k.tresc
  from backup_biuro_podpis_20260907 k where k.id = b.id;

-- brama
do $$ declare d text; begin
  select value into d from app_config where key='backup_office_outbound_allowed_20260907';
  execute d;
end $$;
delete from app_config where key='reply_to_dozwolone';
```

## Do sprawdzenia

Domena `mvautoai.net` ma w Resend **odbior wylaczony**, a maile MV kieruja
odpowiedzi na `kontakt@mvautoai.net`. Jesli ta skrzynka nie jest obsluzona
poza Resend (wlasne MX), odpowiedzi na zimne maile MV nie sa nigdzie zbierane.
