// UWAGA — ROZJAZD Z WERSJA WDROZONA (swiadomy)
//
// Ten plik trzyma PUSTE wartosci domyslne dla MV_ORCH_TOKEN i MV_SUPABASE_ANON,
// bo repozytorium mv-www jest PUBLICZNE (hostuje mvautoai.net).
//
// Wersja wdrozona w n8n (workflow ol8UAkJNVzPTlnUN) ma w wezle
// "Plan cyklu i konfiguracja" wpisane realne wartosci jako fallback — te same,
// ktore i tak sa plaintextem w kilkudziesieciu innych wezlach tej instancji.
// Dzieki temu automat dziala bez zmiennych srodowiskowych.
//
// Zmienne srodowiskowe n8n MAJA PIERWSZENSTWO nad wpisanymi wartosciami.
// Po ustawieniu MV_SUPABASE_ANON i MV_ORCH_TOKEN w srodowisku n8n mozna
// wyczyscic fallbacki w wezle. ZALECANA ROTACJA TOKENU p_token.
//
// Przy kolejnej edycji: nie nadpisuj wdrozonej wersji tym plikiem bez
// przywrocenia fallbackow, bo automat sie zatrzyma.

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
    name: 'Plan cyklu i konfiguracja',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 
        'function zmienna(nazwa, domyslna) {\n' +
        '  try { return ($env && $env[nazwa]) ? $env[nazwa] : domyslna; } catch (e) { return domyslna; }\n' +
        '}\n' +
        '\n' +
        'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n' +
        'const TOKEN = zmienna("MV_ORCH_TOKEN", "");\n' +
        'const APIKEY = zmienna("MV_SUPABASE_ANON", "");\n' +
        'const TRYB = zmienna("MV_ORCH_TRYB", "DRY").toUpperCase();\n' +
        '\n' +
        'if (!TOKEN || !APIKEY) {\n' +
        '  throw new Error("Brak MV_ORCH_TOKEN lub MV_SUPABASE_ANON w zmiennych srodowiskowych n8n.");\n' +
        '}\n' +
        '\n' +
        'const NAGLOWKI = { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" };\n' +
        '\n' +
        'const TORY = [\n' +
        '  { tor: "BIURO", rpc: "mv_biuro_tick", cadence: 5, klasa: "sterowanie", body: { p_token: TOKEN } },\n' +
        '  { tor: "BIURO", rpc: "orch_tick", cadence: 5, klasa: "sterowanie", body: { p_token: TOKEN } },\n' +
        '  { tor: "BIURO", rpc: "mv_dyspozytor_tick", cadence: 5, klasa: "sterowanie", body: { p_limit: 25 } },\n' +
        '  { tor: "BIURO", rpc: "orch_qa_tick", cadence: 10, klasa: "sterowanie", body: { p_token: TOKEN, p_limit: 50 } },\n' +
        '  { tor: "ZDROWIE", rpc: "mv_straznik_glowny", cadence: 15, klasa: "zdrowie", body: { p_alarmuj: true } },\n' +
        '  { tor: "ZDROWIE", rpc: "system_watchdog", cadence: 30, klasa: "zdrowie", body: {} },\n' +
        '  { tor: "ZDROWIE", rpc: "orch_watchdog", cadence: 30, klasa: "zdrowie", body: { p_token: TOKEN } },\n' +
        '  { tor: "REPLY", rpc: "mv_reply_klasyfikuj", cadence: 10, klasa: "sterowanie", body: { p_token: TOKEN, p_limit: 200 } },\n' +
        '  { tor: "REPLY", rpc: "mv_domena_ramp", cadence: 30, klasa: "sterowanie", body: { p_token: TOKEN } },\n' +
        '  { tor: "LEADY_GLAUKO", rpc: "glauko_ted_tick", cadence: 60, klasa: "leady", body: {} },\n' +
        '  { tor: "LEADY_GLAUKO", rpc: "glauko_health_tick", cadence: 60, klasa: "zdrowie", body: { p_token: TOKEN } },\n' +
        '  { tor: "LEADY_ZIEMIA", rpc: "re_skaner_tick", cadence: 30, klasa: "leady", body: {} },\n' +
        '  { tor: "LEADY_LUX", rpc: "lux_cobroker_biuro_tick", cadence: 60, klasa: "leady", body: { p_cap: 50 } },\n' +
        '  { tor: "POSREDNICTWO", rpc: "posrednictwo_biuro_tick", cadence: 30, klasa: "leady", body: { p_limit: 50 } },\n' +
        '  { tor: "POSREDNICTWO", rpc: "posrednictwo_refill_kolejka", cadence: 60, klasa: "leady", body: { p_max: 200 } },\n' +
        '  { tor: "TRESCI_MV", rpc: "mv_publikator_generuj", cadence: 120, klasa: "tresci", body: { p_token: TOKEN, p_ile: 3 } },\n' +
        '  { tor: "TRESCI_AUREU", rpc: "aureu_content_tick", cadence: 120, klasa: "tresci", body: { p_token: TOKEN, p_ile: 3 } },\n' +
        '  { tor: "PRZYCHOD", rpc: "revenue_controller", cadence: 240, klasa: "zdrowie", body: { p_days: 7 } },\n' +
        '  { tor: "WYSYLKA_MV", rpc: "mv_wyslij_partie", cadence: 15, klasa: "wysylka", body: { p_token: TOKEN, p_limit: 50 } },\n' +
        '  { tor: "WYSYLKA_GLAUKO", rpc: "glauko_wyslij_partie", cadence: 20, klasa: "wysylka", body: { p_token: TOKEN, p_limit: 25 } },\n' +
        '  { tor: "WYSYLKA_GLAUKO", rpc: "glauko_followup_tick", cadence: 60, klasa: "wysylka", body: { p_token: TOKEN, p_limit: 25 } },\n' +
        '  { tor: "WYSYLKA_NEXION", rpc: "nexion_wyslij_partie", cadence: 60, klasa: "wysylka", body: { p_token: TOKEN, p_limit: 5 } },\n' +
        '  { tor: "WYSYLKA_ZIEMIA", rpc: "re_wyslij_partie", cadence: 60, klasa: "wysylka", body: { p_token: TOKEN, p_limit: 20 } },\n' +
        '  { tor: "WYSYLKA_POSREDNICTWO", rpc: "posrednictwo_drain_safe", cadence: 30, klasa: "wysylka", body: { p_batch: 25 } }\n' +
        '];\n' +
        '\n' +
        'const WAGA = { sterowanie: 1, zdrowie: 2, leady: 3, tresci: 4, publikacja: 5, wysylka: 6 };\n' +
        'const minutaEpoki = Math.floor(Date.now() / 60000);\n' +
        '\n' +
        'const doWykonania = TORY\n' +
        '  .filter(function (t) { return minutaEpoki % t.cadence < 5; })\n' +
        '  .filter(function (t) { return TRYB === "LIVE" ? true : t.klasa !== "wysylka"; })\n' +
        '  .sort(function (a, b) { return (WAGA[a.klasa] || 9) - (WAGA[b.klasa] || 9); });\n' +
        '\n' +
        'const WSPOLNE = {\n' +
        '  tryb: TRYB,\n' +
        '  naglowki: NAGLOWKI,\n' +
        '  token: TOKEN,\n' +
        '  url_log: BAZA + "orch_log_run",\n' +
        '  url_alarm: BAZA + "mv_orch_alarm"\n' +
        '};\n' +
        '\n' +
        'if (doWykonania.length === 0) {\n' +
        '  return [{ json: Object.assign({ pusty_cykl: true }, WSPOLNE) }];\n' +
        '}\n' +
        '\n' +
        'return doWykonania.map(function (t) {\n' +
        '  return {\n' +
        '    json: Object.assign({\n' +
        '      pusty_cykl: false,\n' +
        '      tor: t.tor,\n' +
        '      rpc: t.rpc,\n' +
        '      klasa: t.klasa,\n' +
        '      cadence: t.cadence,\n' +
        '      url: BAZA + t.rpc,\n' +
        '      body: t.body\n' +
        '    }, WSPOLNE)\n' +
        '  };\n' +
        '});\n'
    },
    position: [220, 0]
  },
  output: [{ pusty_cykl: false, tor: 'BIURO', rpc: 'mv_biuro_tick', klasa: 'sterowanie', cadence: 5, tryb: 'DRY', url: 'https://przyklad.supabase.co/rest/v1/rpc/mv_biuro_tick', url_log: 'https://przyklad.supabase.co/rest/v1/rpc/orch_log_run', url_alarm: 'https://przyklad.supabase.co/rest/v1/rpc/mv_orch_alarm', naglowki: { 'Content-Type': 'application/json' }, token: 'ukryty', body: { p_token: 'ukryty' } }]
});

const czyJestCoRobic = ifElse({
  version: 2.3,
  config: {
    name: 'Czy jest co robic',
    parameters: {
      conditions: {
        conditions: [
          {
            leftValue: expr('{{ $json.pusty_cykl }}'),
            operator: { type: 'boolean', operation: 'false' },
            rightValue: ''
          }
        ]
      },
      options: { looseTypeValidation: true }
    },
    position: [440, 0]
  }
});

const kolejkaTorow = splitInBatches({
  version: 3,
  config: { name: 'Kolejka torow', parameters: { batchSize: 1 }, position: [660, 0] }
});

const wywolajRpc = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Wywolaj RPC Supabase',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.url }}'),
      sendHeaders: true,
      specifyHeaders: 'json',
      jsonHeaders: expr('{{ JSON.stringify($json.naglowki) }}'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: {
        response: { response: { neverError: true, fullResponse: true } },
        timeout: 45000
      }
    },
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    position: [880, 120]
  },
  output: [{ statusCode: 200, body: { ok: true } }]
});

const ocenaWyniku = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Ocena wyniku',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 
        'const zadanie = $("Kolejka torow").first().json;\n' +
        'const odpowiedz = $input.first().json || {};\n' +
        'const kod = Number(odpowiedz.statusCode || 0);\n' +
        'const tresc = odpowiedz.body !== undefined ? odpowiedz.body : odpowiedz;\n' +
        'const sukces = kod >= 200 && kod < 300;\n' +
        'const blad = sukces ? null : ("HTTP " + kod + " :: " + JSON.stringify(tresc).slice(0, 500));\n' +
        '\n' +
        'return [{\n' +
        '  json: {\n' +
        '    tor: zadanie.tor,\n' +
        '    rpc: zadanie.rpc,\n' +
        '    klasa: zadanie.klasa,\n' +
        '    tryb: zadanie.tryb,\n' +
        '    kod: kod,\n' +
        '    sukces: sukces,\n' +
        '    blad: blad,\n' +
        '    wynik: (tresc === undefined || tresc === null) ? {} : tresc,\n' +
        '    token: zadanie.token,\n' +
        '    naglowki: zadanie.naglowki,\n' +
        '    url_log: zadanie.url_log,\n' +
        '    url_alarm: zadanie.url_alarm\n' +
        '  }\n' +
        '}];\n'
    },
    position: [1100, 120]
  },
  output: [{ tor: 'BIURO', rpc: 'mv_biuro_tick', klasa: 'sterowanie', tryb: 'DRY', kod: 200, sukces: true, blad: null, wynik: { ok: true }, token: 'ukryty', naglowki: { 'Content-Type': 'application/json' }, url_log: 'https://przyklad.supabase.co/rest/v1/rpc/orch_log_run', url_alarm: 'https://przyklad.supabase.co/rest/v1/rpc/mv_orch_alarm' }]
});

const zapiszLog = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Zapisz przebieg w orch_runs',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.url_log }}'),
      sendHeaders: true,
      specifyHeaders: 'json',
      jsonHeaders: expr('{{ JSON.stringify($json.naglowki) }}'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ p_token: $json.token, p_tor: $json.tor, p_workflow_id: $workflow.id, p_execution_id: $execution.id, p_faza: $json.rpc, p_wynik: $json.wynik, p_blad: $json.blad }) }}'),
      options: {
        response: { response: { neverError: true } },
        timeout: 20000
      }
    },
    onError: 'continueRegularOutput',
    position: [1320, 120]
  },
  output: [{ ok: true }]
});

const podsumowanie = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Podsumowanie cyklu',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 
        'let oceny = [];\n' +
        'try { oceny = $("Ocena wyniku").all().map(function (i) { return i.json; }); } catch (e) { oceny = []; }\n' +
        '\n' +
        'const bledy = oceny.filter(function (o) { return !o.sukces; });\n' +
        'const kontekst = oceny.length > 0 ? oceny[0] : $("Plan cyklu i konfiguracja").first().json;\n' +
        '\n' +
        'const opis = bledy.map(function (b) { return b.tor + "/" + b.rpc + " -> " + b.blad; }).toString();\n' +
        '\n' +
        'return [{\n' +
        '  json: {\n' +
        '    wykonano: oceny.length,\n' +
        '    bledow: bledy.length,\n' +
        '    tryb: kontekst.tryb,\n' +
        '    tekst_alarmu: "MV ORKIESTRATOR: " + bledy.length + " z " + oceny.length + " torow z bledem. " + opis.slice(0, 900),\n' +
        '    token: kontekst.token,\n' +
        '    naglowki: kontekst.naglowki,\n' +
        '    url_log: kontekst.url_log,\n' +
        '    url_alarm: kontekst.url_alarm,\n' +
        '    wynik_zbiorczy: {\n' +
        '      wykonano: oceny.length,\n' +
        '      bledow: bledy.length,\n' +
        '      tory: oceny.map(function (o) { return { tor: o.tor, rpc: o.rpc, kod: o.kod, sukces: o.sukces }; })\n' +
        '    }\n' +
        '  }\n' +
        '}];\n'
    },
    position: [880, -140]
  },
  output: [{ wykonano: 6, bledow: 0, tryb: 'DRY', tekst_alarmu: '0 z 6 torow z bledem.', token: 'ukryty', naglowki: { 'Content-Type': 'application/json' }, url_log: 'https://przyklad.supabase.co/rest/v1/rpc/orch_log_run', url_alarm: 'https://przyklad.supabase.co/rest/v1/rpc/mv_orch_alarm', wynik_zbiorczy: { wykonano: 6, bledow: 0, tory: [] } }]
});

const zapiszPodsumowanie = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Zapisz podsumowanie cyklu',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.url_log }}'),
      sendHeaders: true,
      specifyHeaders: 'json',
      jsonHeaders: expr('{{ JSON.stringify($json.naglowki) }}'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ p_token: $json.token, p_tor: "ORKIESTRATOR", p_workflow_id: $workflow.id, p_execution_id: $execution.id, p_faza: "cykl", p_wynik: $json.wynik_zbiorczy, p_blad: $json.bledow > 0 ? $json.tekst_alarmu : null }) }}'),
      options: {
        response: { response: { neverError: true } },
        timeout: 20000
      }
    },
    onError: 'continueRegularOutput',
    position: [1100, -140]
  },
  output: [{ ok: true }]
});

const czySaBledy = ifElse({
  version: 2.3,
  config: {
    name: 'Czy sa bledy',
    parameters: {
      conditions: {
        conditions: [
          {
            leftValue: expr('{{ $("Podsumowanie cyklu").first().json.bledow }}'),
            operator: { type: 'number', operation: 'gt' },
            rightValue: 0
          }
        ]
      },
      options: { looseTypeValidation: true }
    },
    position: [1320, -140]
  }
});

const alarmWlasciciel = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Alarm do wlasciciela',
    parameters: {
      method: 'POST',
      url: expr('{{ $("Podsumowanie cyklu").first().json.url_alarm }}'),
      sendHeaders: true,
      specifyHeaders: 'json',
      jsonHeaders: expr('{{ JSON.stringify($("Podsumowanie cyklu").first().json.naglowki) }}'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ p_text: $("Podsumowanie cyklu").first().json.tekst_alarmu }) }}'),
      options: {
        response: { response: { neverError: true } },
        timeout: 20000
      }
    },
    onError: 'continueRegularOutput',
    position: [1540, -240]
  },
  output: [{ ok: true }]
});

const notatkaGlowna = sticky(
  '## MV ORKIESTRATOR MASTER - jeden zegar dla calego systemu\n\n' +
  'Zastepuje rozproszone workflow ORCH w n8n oraz krotkookresowe zadania pg_cron.\n' +
  'Jeden trigger co 5 minut, jeden router torow, wykonanie SEKWENCYJNE (batch = 1),\n' +
  'dzieki czemu baza nie dostaje kilkudziesieciu rownoleglych wywolan na minute.\n\n' +
  'ZMIENNE SRODOWISKOWE n8n (wymagane - bez nich workflow celowo przerywa):\n' +
  'MV_SUPABASE_URL (opcjonalna), MV_SUPABASE_ANON, MV_ORCH_TOKEN,\n' +
  'MV_ORCH_TRYB (DRY albo LIVE).\n\n' +
  'UPRAWNIENIA: router zawiera WYLACZNIE funkcje wywolywalne przez role anon.\n' +
  'Funkcje bez grantu dla anon (mv_heartbeat, mv_guard_tick, mv_stuck_watchdog,\n' +
  'mv_aureu_publish_tick, kp_oferta_tick, kp_send_due) zostaja przy pg_cron -\n' +
  'dodanie ich tutaj dawaloby 404 na kazdym cyklu.\n\n' +
  'ALARM: idzie przez mv_orch_alarm (waska bramka SECURITY DEFINER z grantem\n' +
  'dla anon), a nie przez alert_telegram, ktora dla anon jest zamknieta.\n\n' +
  'TRYB DRY: tylko sterowanie, zdrowie, leady i tresci - zero wysylek.\n' +
  'TRYB LIVE: dodatkowo tory wysylkowe MV, GLAUKO, NEXION, ZIEMIA, POSREDNICTWO, PURPUROWY KOD.\n' +
  'Bramki bezpieczenstwa wysylki pozostaja po stronie RPC (hard_stop, capy, freeze).\n\n' +
  'ROLLBACK: dezaktywuj ten workflow. Poprzedni harmonogram pg_cron jest zbackupowany\n' +
  'w tabeli backup_cron_job_20260903.',
  [zegar, planCyklu, czyJestCoRobic],
  { color: 4 }
);

const notatkaPetla = sticky(
  '## Petla torow z pelnym logiem\n\n' +
  'Kazdy tor: wywolanie RPC (3 proby, 45 s timeout, blad nie zabija cyklu)\n' +
  'nastepnie ocena kodu HTTP i zapis do orch_runs przez orch_log_run.\n' +
  'Po petli: podsumowanie zbiorcze i alarm, gdy cokolwiek padlo.\n\n' +
  'Tor ZDROWIE zawiera mv_straznik_glowny - straznika czterech filarow\n' +
  '(pg_cron, agenci, wysylka, integracje) z wlasnym alarmem na Telegram.',
  [kolejkaTorow, wywolajRpc, ocenaWyniku, zapiszLog],
  { color: 3 }
);

export default workflow('mv-orkiestrator-master', 'MV ORKIESTRATOR MASTER - jeden system')
  .add(zegar)
  .to(planCyklu)
  .to(czyJestCoRobic
    .onTrue(kolejkaTorow
      .onEachBatch(wywolajRpc.to(ocenaWyniku.to(zapiszLog.to(nextBatch(kolejkaTorow)))))
      .onDone(podsumowanie.to(zapiszPodsumowanie.to(czySaBledy.onTrue(alarmWlasciciel))))
    )
  )
  .add(notatkaGlowna)
  .add(notatkaPetla);
