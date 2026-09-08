# MV Automation — zasady pracy w tym repo

## 1. PLATFORMA WYKONAWCZA: n8n. Bez wyjątków.

n8n na serwerze właściciela (`https://n8n.kgregenevia.pro`, VPS 139.59.137.170)
jest **jedyną** platformą, na której wolno uruchamiać logikę biznesową
i harmonogramy.

- **Supabase** = wyłącznie baza danych oraz endpointy HTTP/RPC, które **woła n8n**.
- **NIGDY** `pg_cron` jako harmonogram produkcyjny.
- **NIGDY** funkcja SQL jako logika biznesowa toru sprzedażowego.
- **NIGDY** edge function jako samodzielny scheduler.

### Gdy n8n jest niedostępny (502 / down)

**ZATRZYMAJ SIĘ i zgłoś blokadę właścicielowi.**
NIE buduj obejścia na innej platformie. Obejście = praca do wyrzucenia,
bo właściciel nie może jej sam obsłużyć ani zobaczyć.

Diagnostyka blokady (nie zgadywać, sprawdzić):
```
curl -s -o /dev/null -w "%{http_code}" https://n8n.kgregenevia.pro/healthz
```
- `502` + `oferta.kgregenevia.pro` = 200  → proces n8n padł, Caddy/serwer sprawne.
  Jedyna naprawa: `docker restart n8n` na VPS. Agent nie ma do tego dostępu (brak SSH,
  brak tokenu providera, port 5678 zamknięty firewallem z zewnątrz).

### Dlaczego to jest tu zapisane

Właściciel powtórzył to wymaganie **12 razy między 3 a 8 września 2026**
(transkrypt: linie 3, 1909, 2157, 2413, 2524, 5252, 7595, 11109, 11384 + cele sesji).
Kolejne sesje gubiły je przy kompresji kontekstu i za każdym razem budowały
od nowa poza n8n. **Nie podważaj tej decyzji, nie proponuj alternatyw,
nie pytaj o nią ponownie.**

Stan migracji i lista workflow do przeniesienia: `app_config.plan_migracji_do_n8n`.
Zapis decyzji: `app_config.zasada_platformy_n8n`.

## 2. Raportowanie

- Rozdzielaj: **POTWIERDZONE / WYKONANE / ZABLOKOWANE / DO DECYZJI**.
- Przychód deklaruj **wyłącznie** przy potwierdzonym Stripe LIVE `paid=true`.
  Płatność testowa nigdy nie jest przychodem.
- Nie przedstawiaj planu jako pracy wykonanej.
- Sprawdź faktyczny stan systemu, zanim cokolwiek stwierdzisz.

## 3. Bramki, których nie wolno ruszać

Nie usuwaj i nie omijaj: supresji, opt-outów, deduplikacji, ochrony przed
odbiciami, kontroli reputacji domen, limitów wysyłki, ochrony przed
wielokrotnym kontaktem (`office.outbound_allowed` i cały jej łańcuch).
Zwiększanie wolumenu przez obchodzenie tych bramek jest zabronione.

## 4. GLAUKO — rola: WATCHDOG, nie CLOSER

Po `HANDED_OFF` agenci **nie kontaktują klienta ponownie**. `glauko_watchdog`
tylko obserwuje skrzynkę i informuje właściciela — nigdy nie odpisuje klientowi.
Marża 90 PLN/t jest **poufna** — nigdy nie przedstawiaj jej jako warunku
umownego ani potwierdzonej prowizji.
