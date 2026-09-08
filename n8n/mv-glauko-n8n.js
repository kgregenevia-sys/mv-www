// MV GLAUKO — caly tor GLAUKO w jednym workflow n8n.
//
// ZASTEPUJE trzy zadania pg_cron (patrz app_config.plan_migracji_do_n8n):
//   glauko_watchdog_15min      -> tor WATCHDOG
//   mv_glauko_pryw_30min       -> tor NADAJNIK
//   mv_skalper_glauko_10min    -> tor SKALPER
//
// Jeden zegar co 5 minut decyduje, ktore tory sa wymagalne w danej minucie.
// Wykonanie SEKWENCYJNE (batch = 1) — baza nie dostaje rownoleglych wywolan.
//
// UWAGA — repozytorium mv-www jest PUBLICZNE (hostuje mvautoai.net).
// Ten plik NIE zawiera kluczy. Workflow celowo przerywa, jesli w srodowisku
// n8n nie ma MV_SUPABASE_ANON. Ustaw w n8n: Settings > Variables.
//
// KOLEJNOSC WDROZENIA (obowiazkowa, inaczej podwojna wysylka):
//   1. create_workflow_from_code z tego pliku
//   2. sprawdzic jeden przebieg recznie (execute_workflow)
//   3. DOPIERO POTEM wylaczyc trzy zadania pg_cron:
//      select cron.unschedule('glauko_watchdog_15min');
//      select cron.unschedule('mv_glauko_pryw_30min');
//      select cron.unschedule('mv_skalper_glauko_10min');
//   4. publish_workflow
//
// ROLLBACK: dezaktywuj ten workflow i przywroc trzy zadania pg_cron
// z harmonogramami zapisanymi w app_config.plan_migracji_do_n8n.
//
// GLAUKO = WATCHDOG, NIE CLOSER. Tor WATCHDOG wywoluje glauko_watchdog(),
// ktora obserwuje skrzynke i powiadamia wlasciciela. Nigdy nie odpisuje
// klientowi — po HANDED_OFF kontakt prowadzi zleceniodawca.

import { workflow, node, trigger, sticky, splitInBatches, nextBatch, ifElse, expr } from '@n8n/workflow-sdk';

const zegar = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Zegar 5 minut',
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } },
    position: [0, 0]
  },
  output: [{}]
});

const planCyklu = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Plan cyklu GLAUKO',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode:
        'function zmienna(nazwa, domyslna) {\n' +
        '  try { return ($env && $env[nazwa]) ? $env[nazwa] : domyslna; } catch (e) { return domyslna; }\n' +
        '}\n' +
        '\n' +
        'const BAZA   = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co");\n' +
        'const APIKEY = zmienna("MV_SUPABASE_ANON", "");\n' +
        '\n' +
        'if (!APIKEY) {\n' +
        '  throw new Error("Brak MV_SUPABASE_ANON w zmiennych srodowiskowych n8n. Ustaw: Settings > Variables.");\n' +
        '}\n' +
        '\n' +
        'const NAGLOWKI = { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" };\n' +
        'const teraz  = new Date();\n' +
        'const minuta = teraz.getUTCMinutes();\n' +
        'const godzina= teraz.getUTCHours();\n' +
        '\n' +
        '// Okno wysylkowe 6-16 UTC = 8-18 czasu polskiego. Poza nim nadajnik milczy.\n' +
        'const oknoWysylki = godzina >= 6 && godzina <= 16;\n' +
        '\n' +
        'const tory = [];\n' +
        '\n' +
        '// SKALPER — co 10 minut. Dosypuje firmy z KRS do glauko_firmy_prywatne.\n' +
        'if (minuta % 10 === 0) {\n' +
        '  tory.push({\n' +
        '    tor: "SKALPER",\n' +
        '    metoda: "GET",\n' +
        '    url: BAZA + "/functions/v1/mv-skalper-glauko?ile=500",\n' +
        '    body: null\n' +
        '  });\n' +
        '}\n' +
        '\n' +
        '// WATCHDOG — co 15 minut. Obserwuje skrzynke, powiadamia wlasciciela.\n' +
        '// NIE odpisuje klientom (po HANDED_OFF kontakt prowadzi zleceniodawca).\n' +
        'if (minuta % 15 === 0) {\n' +
        '  tory.push({\n' +
        '    tor: "WATCHDOG",\n' +
        '    metoda: "POST",\n' +
        '    url: BAZA + "/rest/v1/rpc/glauko_watchdog",\n' +
        '    body: { p_godzin: 24 }\n' +
        '  });\n' +
        '}\n' +
        '\n' +
        '// NADAJNIK — co 30 minut w oknie wysylkowym. Bramki (hard_stop, capy,\n' +
        '// suppression, outbound_allowed) zostaja po stronie RPC — nie omijamy ich tutaj.\n' +
        'if (minuta % 30 === 0 && oknoWysylki) {\n' +
        '  tory.push({\n' +
        '    tor: "NADAJNIK",\n' +
        '    metoda: "POST",\n' +
        '    url: BAZA + "/rest/v1/rpc/glauko_pryw_wyslij",\n' +
        '    body: { p_limit: 5 }\n' +
        '  });\n' +
        '}\n' +
        '\n' +
        'return tory.map(function (t) {\n' +
        '  return { json: Object.assign({}, t, { naglowki: NAGLOWKI, url_zdarzenie: BAZA + "/rest/v1/ops_events" }) };\n' +
        '});'
    },
    position: [220, 0]
  },
  output: [{}]
});

const czyJestCoRobic = ifElse({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'Czy jakis tor wymagalny',
    parameters: {
      conditions: {
        options: { caseSensitive: true, version: 2, typeValidation: 'strict' },
        combinator: 'and',
        conditions: [{
          operator: { type: 'number', operation: 'gt' },
          leftValue: expr('{{ $input.all().length }}'),
          rightValue: 0
        }]
      }
    },
    position: [440, 0]
  }
});

const kolejkaTorow = splitInBatches({
  type: 'n8n-nodes-base.splitInBatches',
  version: 3,
  config: {
    name: 'Kolejka torow GLAUKO',
    parameters: { batchSize: 1, options: {} },
    position: [660, 0]
  }
});

const wywolajTor = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Wywolaj tor GLAUKO',
    parameters: {
      method: expr('{{ $json.metoda }}'),
      url: expr('{{ $json.url }}'),
      sendHeaders: true,
      specifyHeaders: 'json',
      jsonHeaders: expr('{{ JSON.stringify($json.naglowki) }}'),
      sendBody: expr('{{ $json.body !== null }}'),
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body || {}) }}'),
      options: {
        response: { response: { neverError: true, fullResponse: true } },
        timeout: 45000
      }
    },
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    position: [880, 0]
  },
  output: [{}]
});

const ocenaWyniku = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Ocena wyniku toru',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode:
        'const wejscie = $("Kolejka torow GLAUKO").first().json;\n' +
        'const odp = $json || {};\n' +
        'const kod = Number(odp.statusCode || 0);\n' +
        'const ok  = kod >= 200 && kod < 300;\n' +
        '\n' +
        'return { json: {\n' +
        '  tor: wejscie.tor,\n' +
        '  ok: ok,\n' +
        '  kod: kod,\n' +
        '  wynik: odp.body !== undefined ? odp.body : null,\n' +
        '  blad: ok ? null : String(JSON.stringify(odp.body || "")).slice(0, 300),\n' +
        '  naglowki: wejscie.naglowki,\n' +
        '  url_zdarzenie: wejscie.url_zdarzenie\n' +
        '} };'
    },
    position: [1100, 0]
  },
  output: [{}]
});

const zapiszLog = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Zapisz przebieg w ops_events',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.url_zdarzenie }}'),
      sendHeaders: true,
      specifyHeaders: 'json',
      jsonHeaders: expr('{{ JSON.stringify(Object.assign({}, $json.naglowki, { Prefer: "return=minimal" })) }}'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ event_type: "GLAUKO_N8N_PRZEBIEG", entity_type: "glauko", entity_id: $json.tor, metadata: { ok: $json.ok, kod: $json.kod, wynik: $json.wynik, blad: $json.blad, workflow_id: $workflow.id, execution_id: $execution.id } }) }}'),
      options: {
        response: { response: { neverError: true } },
        timeout: 20000
      }
    },
    onError: 'continueRegularOutput',
    position: [1320, 0]
  },
  output: [{}]
});

const notatka = sticky(
  '## MV GLAUKO — caly tor w n8n\n\n' +
  'Zastepuje trzy zadania pg_cron: glauko_watchdog_15min, mv_glauko_pryw_30min,\n' +
  'mv_skalper_glauko_10min. Jeden zegar co 5 minut, wykonanie sekwencyjne.\n\n' +
  'ZMIENNA SRODOWISKOWA (wymagana): MV_SUPABASE_ANON.\n' +
  'Opcjonalna: MV_SUPABASE_URL. Bez MV_SUPABASE_ANON workflow celowo przerywa.\n\n' +
  'HARMONOGRAM TOROW:\n' +
  'SKALPER  — co 10 min, calodobowo. KRS -> glauko_firmy_prywatne.\n' +
  'WATCHDOG — co 15 min, calodobowo. Obserwuje skrzynke, powiadamia wlasciciela.\n' +
  'NADAJNIK — co 30 min, 6-16 UTC (8-18 PL). Wysylka ofert, 5 na przebieg.\n\n' +
  'GLAUKO = WATCHDOG, NIE CLOSER. Po HANDED_OFF agenci nie kontaktuja klienta\n' +
  'ponownie — kontakt prowadzi zleceniodawca. glauko_watchdog() tylko informuje.\n\n' +
  'BRAMKI BEZPIECZENSTWA zostaja po stronie RPC: glauko_hard_stop, glauko_daily_cap,\n' +
  'suppression, office.outbound_allowed. Ten workflow ich nie omija i nie moze.\n\n' +
  'KOLEJNOSC WDROZENIA — najpierw uruchom ten workflow i sprawdz jeden przebieg,\n' +
  'DOPIERO POTEM wylacz trzy zadania pg_cron. Odwrotna kolejnosc = przerwa\n' +
  'w wysylce, rownoczesne wlaczenie obu = podwojna wysylka do tego samego klienta.\n\n' +
  'ROLLBACK: dezaktywuj workflow, przywroc zadania pg_cron wedlug harmonogramow\n' +
  'zapisanych w app_config.plan_migracji_do_n8n.',
  [zegar, planCyklu, czyJestCoRobic, kolejkaTorow],
  { color: 4 }
);

export default workflow('mv-glauko-n8n', 'MV GLAUKO - skalper, nadajnik, watchdog')
  .add(zegar)
  .to(planCyklu)
  .to(czyJestCoRobic
    .onTrue(kolejkaTorow
      .onEachBatch(wywolajTor.to(ocenaWyniku.to(zapiszLog.to(nextBatch(kolejkaTorow)))))
    )
  )
  .add(notatka);
