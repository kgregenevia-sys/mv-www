# Wysyłka odblokowana i wpięta w n8n (2026-09-07 01:40 PL)

Decyzja właściciela: zero blokad, rozgrzewanie domen, wszystko automatycznie w n8n.

## Co blokowało

| flaga | było | jest |
|---|---|---|
| `glauko_hard_stop` | `true` | **`false`** |
| `glauko_send_enabled` | `false` | **`true`** |
| `glauko_daily_cap` | `20` | **`400`** |
| lista odbiorców | **0 gotowych** | **362** |

Backup stanu: `app_config.backup_glauko_flagi_20260907`.

## Skąd wzięła się lista

`glauko_firmy_prywatne` była wyczerpana do zera — 204 wysłane, 29 z błędem.
Z `glauko_ted_stage` (610 rekordów z przetargów TED, CPV remediacyjne) wyciągnięte
362 unikalne, poprawne adresy, nieobecne na liście i nieobjęte supresją.

## Sprawdzenie przed zdjęciem blokad

`glauko_health_tick` zwróciło `HEALTHY`: 523 wysłane w 7 dni, **0 skarg**,
hard bounce **0,96 %** przy progu 3 %. Żadnej przesłanki do stopu.

Korekta wcześniejszego szacunku: mówiłem o skoku 18×, licząc od sztucznie
ściętego capa 20. Realny wolumen to ~75 maili dziennie, więc 362 to około 5×.

## Rozgrzewanie zamiast blokad

`glauko_cap_ramp` (kadencja dzienna w n8n) rośnie ×1,5 na dobę, minimum +10,
do sufitu 10000 — ale tylko gdy wykorzystanie capa przekracza 60 %. Czyli rampa
idzie za realnym wolumenem, nie za deklaracją. Obniża cap o połowę tylko przy
skardze albo bounce ≥ 3 %.

`glauko_cap_last_ramp` wyczyszczone, żeby rampa mogła ruszyć od razu.

## Kto teraz wysyła

Nowa funkcja `n8n_tick_wysylka()` — jedno miejsce dla wszystkich torów:

| tor | funkcja | porcja |
|---|---|---|
| GLAUKO lista prywatna | `glauko_pryw_wyslij` | 10 |
| GLAUKO kolejka | `glauko_wyslij_partie` | 25 |
| GLAUKO followup | `glauko_followup_tick` | 25 |
| Pośrednictwo | `posrednictwo_drain_safe` | 25 |
| Ziemia | `re_wyslij_partie` | 20 |
| MV cold | `mv_wyslij_partie` | 50 |
| NEXION | `nexion_wyslij_partie` | 5 |

Wpięta w `n8n_tick_15min`, czyli **jedzie co 15 minut z n8n**, 24/7.
Capy i bramki zostają po stronie funkcji — każda pilnuje własnego limitu.

## Dowód działania

- `glauko_pryw_wyslij(2)` → `{"ok":true,"wyslane":2}` — maile poszły do
  13 WOG i 15 WOG (jednostki z przetargów remediacyjnych TED).
- `n8n_tick_wysylka()` pierwszy przebieg, 6853 ms:
  NEXION `wyslane: 5`, MV `przekazane_do_api: 24`, kolejka MV 193 → 168.

Stare workflow wysyłkowe (`MV Cold Email Daily v2`, `GLAUKO Cold Outreach`,
`MV Cold Email Daily 75/day` i pozostałe) sprawdzone — **wszystkie `active: false`**,
więc nie ma ryzyka podwójnej wysyłki. Wcześniejsze ostrzeżenie o tym ryzyku
opierało się na notatce sprzed kilku dni, nie na stanie faktycznym.

## Tempo

350 adresów zostało, porcja 10 co 15 minut = 40/godzinę. Cała lista wychodzi
w około 9 godzin, czyli do jutrzejszego południa.

## Rollback

```sql
update app_config set value='true'  where key='glauko_hard_stop';
update app_config set value='false' where key='glauko_send_enabled';
update app_config set value='20'    where key='glauko_daily_cap';
```
