# P0.1-P0.5 — fabryka szkicow, tor platnosci, instrumentacja (2026-09-07)

## P0.1 — FABRYKA: PASS

### Przyczyna

Unique index `idx_outreach_drafts_lead_variant (lead_id, variant)`.
Wariant budowany jako `segment-TYP-vN`, gdzie `N = abs(hashtext(lead_id)) % 3`
— **deterministyczny per lead**. Kolejny follow-up dla tego samego leada dawal
identyczny wariant, wiec `ON CONFLICT DO NOTHING` po cichu go odrzucal,
a `v_ok` i tak sie inkrementowal. Raport pokazywal sukces, kolejka stala.

### Naprawa

Klucz konfliktu **nie zostal zmieniony**. Zmieniona semantyka wariantu:
kolejny follow-up dostaje numer sekwencyjny z liczby juz wyslanych wiadomosci
do tego leada — `MED_ESTETYKA-FU2-v1`, `PRAWO-FU3-v1`.

Duble tej samej wiadomosci nadal niemozliwe: index dziala, a lead z
niewyslanym szkicem jest wykluczany przez `WHERE not exists (... status='draft')`.

Licznik przepisany na `GET DIAGNOSTICS v_ins = ROW_COUNT` — liczy wylacznie
faktycznie wstawione wiersze. Dolozone `kandydaci` i `pominiete_konflikt`.

### Dowod regresji

```
before:   617
kandydaci: 40
utworzone: 18
pominiete_konflikt: 0
odrzucone_qa: 22
bledy: 0
after:    635
```

617 + 18 = 635. Zgadza sie co do sztuki. Powstalo 18 followupow z numerem,
wczesniej niemozliwych. Zero maili testowych do realnych klientow.

Backup: `app_config.backup_mv_fabryka_szkicow_przed_konflikt_20260907`.

## P0.3 — CTA: PASS

Szkice z linkiem platniczym: **15 -> 33**.

Przyklad wygenerowanej tresci (zanonimizowany):

> *Wracam do tematu: Zapytania po godzinach pracy rejestracji — [FIRMA]*
>
> „Jesli prosciej byloby zaczac od konkretu zamiast rozmowy — audyt automatyzacji
> za 499 zl: przechodzimy przez Panstwa obsluge zgloszen, wskazujemy, gdzie gina
> kontakty, i podajemy twarda wycene wdrozenia. Przy decyzji o wdrozeniu 499 zl
> zaliczamy na jego poczet.
> https://buy.stripe.com/dRmbIT38w5cN7V93y3dQQ0b"

COLD zachowuje rozmowe jako glowne CTA, audyt jako druga opcja.
FU prowadzi audytem. Zaden limit, suppression ani opt-out nie zostal obejsciony.

## P0.2 — TOR PLATNOSCI

### TEST E2E: PASS (bez Stripe, bez pieniedzy)

Brak klucza `sk_test_` w systemie — jest wylacznie `rk_live_` (restricted live).
Test mode Stripe niewykonalny. Wykonany zamiast tego **podpisany syntetyczny event**:

```
HMAC-SHA256(timestamp + "." + body, mv_stripe_whsec)
  -> POST /functions/v1/mv-stripe-hook
  -> HTTP 200 {"ok":true,"testmode":true,"revenue_effect":false}
  -> mv_payments: evt_E2E_TEST_20260907, 499 PLN, is_test=true, livemode=false
```

Pierwsza proba dala `bad_signature` — podpisywalem tekst, a `pg_net` wysyla
znormalizowany JSONB. Poprawka: podpis liczony nad `jsonb::text`.

**Ustalenie:** poprawny sekret to `mv_stripe_whsec`.
`stripe_webhook_secret` zwraca `bad_signature` i nie nadaje sie do tego endpointu.

### LIVE CONFIG: VERIFIED

Odpytany Stripe API kluczem trzymanym w bazie, HTTP 200. Cztery endpointy,
wszystkie `enabled`, wszystkie `livemode: true`:

| endpoint | url | zdarzenia |
|---|---|---|
| we_1TybuQ… | `/mv-stripe-hook` | checkout.session.completed, async_payment_succeeded/failed, payment_intent.payment_failed, invoice.paid/payment_succeeded/payment_failed |
| we_1U4sh0… | `/nx-stripe-hook` | checkout.session.completed, customer.subscription.updated/deleted |
| we_1TwBmH… | `/apiintel-stripe-webhook` | checkout.session.completed, invoice.paid |
| we_1TrTEg… | `/stripe-webhook` | checkout.session.completed, invoice.paid |

`stripe_webhooks` jest puste nie dlatego, ze cos jest zepsute — tylko dlatego,
ze **nigdy nie bylo platnosci**, wiec nie bylo czego dostarczyc.

### FULFILLMENT: NIEPOTWIERDZONY — i to jest poprawne

`digital_sales` puste, `product_id` i `package` null. Powod: tryb testowy
**celowo** zatrzymuje sie przed fulfillmentem (`revenue_effect: false`).
Zeby przejsc ten odcinek, trzeba by wyslac event z `livemode: true`, czyli
wstrzyknac fałszywa platnosc LIVE do tabel przychodowych. Nie robie tego.

**STATUS: TEST PASS / LIVE CONFIG PASS / LIVE PAYMENT NOT TESTED**

## P0.5 — INSTRUMENTACJA

`v_revenue_dashboard` z twardym rozdzialem test/live. `paid_live` i `revenue_live_pln`
licza wylacznie `is_test=false AND livemode=true`.

Stan: emails_sent 251, cta_w_kolejce 33, paid_live 0, revenue_live 0,00 PLN,
test_events_odseparowane 2.

Obie platnosci w bazie to zdarzenia testowe. **Realny przychod: 0 PLN.**
