// SUPABASE TICKI - caly harmonogram Supabase w n8n (workflow D3tvXbjxvMDXdLRx)
//
// BEZ CREDENTIALA: naglowki apikey + Bearer budowane w wezle Code. n8n API nie
// potrafi podpiac istniejacego credentiala do wezla - to byla pierwotna blokada.
// Klucz anon jest publikowalny (Supabase wysyla go do kazdej przegladarki),
// wiec moze stac w publicznym repozytorium. Zadnego orch_token tu nie ma -
// wrappery czytaja go z app_config.
//
// LIMIT CZASU: rola anon ma statement_timeout = 15 s. Kazdy wrapper n8n_tick_*
// ma wlasny SET statement_timeout (60-150 s), inaczej ciezsze kadencje koncza sie
// bledem 57014. Zmierzone: weryfikacja 57,1 s, router 18,6 s.
//
// LOG: kazdy wrapper zapisuje sie sam do orch_runs (tor TICKI) przez n8n_tick_log.

import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const wyzwalacz0 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co 5 minut',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '*/5 * * * *' }] } },
    position: [0, 0]
  },
  output: [{}]
});

const przygotuj0 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Co 5 minut',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_5min";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Co 5 minut",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 0]
  },
  output: [{ rpc: 'n8n_tick_5min', kadencja: 'Co 5 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_5min', naglowki: {} }]
});

const wyzwalacz1 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co 10 minut',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '4-59/10 * * * *' }] } },
    position: [0, 180]
  },
  output: [{}]
});

const przygotuj1 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Co 10 minut',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_10min";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Co 10 minut",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 180]
  },
  output: [{ rpc: 'n8n_tick_10min', kadencja: 'Co 10 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_10min', naglowki: {} }]
});

const wyzwalacz2 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co 15 minut',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0-59/15 * * * *' }] } },
    position: [0, 360]
  },
  output: [{}]
});

const przygotuj2 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Co 15 minut',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_15min";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Co 15 minut",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 360]
  },
  output: [{ rpc: 'n8n_tick_15min', kadencja: 'Co 15 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_15min', naglowki: {} }]
});

const wyzwalacz3 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co 30 minut',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '6-59/30 * * * *' }] } },
    position: [0, 540]
  },
  output: [{}]
});

const przygotuj3 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Co 30 minut',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_30min";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Co 30 minut",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 540]
  },
  output: [{ rpc: 'n8n_tick_30min', kadencja: 'Co 30 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_30min', naglowki: {} }]
});

const wyzwalacz4 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Router odpowiedzi co 15 minut',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '8-59/15 * * * *' }] } },
    position: [0, 720]
  },
  output: [{}]
});

const przygotuj4 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Router odpowiedzi co 15 minut',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_router";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Router odpowiedzi co 15 minut",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 720]
  },
  output: [{ rpc: 'n8n_tick_router', kadencja: 'Router odpowiedzi co 15 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_router', naglowki: {} }]
});

const wyzwalacz5 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Weryfikacja odpowiedzi co 30 minut',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '23-59/30 * * * *' }] } },
    position: [0, 900]
  },
  output: [{}]
});

const przygotuj5 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Weryfikacja odpowiedzi co 30 minut',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_weryfikacja";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Weryfikacja odpowiedzi co 30 minut",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 900]
  },
  output: [{ rpc: 'n8n_tick_weryfikacja', kadencja: 'Weryfikacja odpowiedzi co 30 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_weryfikacja', naglowki: {} }]
});

const wyzwalacz6 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co godzine minuta 49',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '49 * * * *' }] } },
    position: [0, 1080]
  },
  output: [{}]
});

const przygotuj6 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Co godzine minuta 49',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_godzinowy";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Co godzine minuta 49",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 1080]
  },
  output: [{ rpc: 'n8n_tick_godzinowy', kadencja: 'Co godzine minuta 49', url: 'https://baza/rest/v1/rpc/n8n_tick_godzinowy', naglowki: {} }]
});

const wyzwalacz7 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Oksana 7-21 minuta 46',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '46 7-21 * * *' }] } },
    position: [0, 1260]
  },
  output: [{}]
});

const przygotuj7 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Oksana 7-21 minuta 46',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_oksana_publikuj";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Oksana 7-21 minuta 46",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 1260]
  },
  output: [{ rpc: 'n8n_tick_oksana_publikuj', kadencja: 'Oksana 7-21 minuta 46', url: 'https://baza/rest/v1/rpc/n8n_tick_oksana_publikuj', naglowki: {} }]
});

const wyzwalacz8 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Dzienny 4:20',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '20 4 * * *' }] } },
    position: [0, 1440]
  },
  output: [{}]
});

const przygotuj8 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Przygotuj Dzienny 4:20',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'function zmienna(n, d) {\n'
        + '  try { return ($env && $env[n]) ? $env[n] : d; } catch (e) { return d; }\n'
        + '}\n'
        + 'const BAZA = zmienna("MV_SUPABASE_URL", "https://mdsvcobwuezriexyqqby.supabase.co") + "/rest/v1/rpc/";\n'
        + 'const APIKEY = zmienna("MV_SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kc3Zjb2J3dWV6cmlleHlxcWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMxMjMsImV4cCI6MjA5MzYzOTEyM30.o4CVcSf9drtDxlpVv11T_E3N4dd-BSTrQPRCZXfpusg");\n'
        + 'const RPC = "n8n_tick_dzienny";\n'
        + 'return [{ json: {\n'
        + '  rpc: RPC,\n'
        + '  kadencja: "Dzienny 4:20",\n'
        + '  url: BAZA + RPC,\n'
        + '  naglowki: { apikey: APIKEY, Authorization: "Bearer " + APIKEY, "Content-Type": "application/json" }\n'
        + '} }];\n'
    },
    position: [280, 1440]
  },
  output: [{ rpc: 'n8n_tick_dzienny', kadencja: 'Dzienny 4:20', url: 'https://baza/rest/v1/rpc/n8n_tick_dzienny', naglowki: {} }]
});

const wywolanie = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Wywolaj wrapper RPC',
    parameters: {
      method: 'POST',
      url: '={{ $json.url }}',
      sendHeaders: true,
      specifyHeaders: 'json',
      jsonHeaders: '={{ JSON.stringify($json.naglowki) }}',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={}',
      options: { response: { response: { neverError: true, fullResponse: true } }, timeout: 170000 }
    },
    position: [560, 700],
    retryOnFail: true,
    onError: 'continueRegularOutput'
  },
  output: [{ statusCode: 200, body: { ok: true } }]
});

const notatka = sticky(
  '## SUPABASE TICKI - caly harmonogram Supabase w n8n\n\n'
  + 'Nie ma juz podzialu na pg_cron i n8n. Dziewiec kadencji, kazda wola jeden\n'
  + 'wrapper RPC po stronie bazy, ktory odpala swoje ticki - kazdy w osobnym\n'
  + 'bloku exception, wiec awaria jednego nie zabija pozostalych.\n\n'
  + 'BEZ CREDENTIALA: naglowki budowane w wezle Code z klucza anon (publikowalny).\n'
  + 'Zadnego orch_token w n8n - wrappery czytaja go z app_config.\n\n'
  + 'LIMIT CZASU: rola anon ma statement_timeout 15 s, dlatego kazdy wrapper ma\n'
  + 'wlasny SET statement_timeout. Zmierzone: weryfikacja 57,1 s, router 18,6 s.\n'
  + 'Bez tego obie kadencje koncza sie bledem 57014.\n\n'
  + 'PODZIAL PRACY: ten workflow to harmonogram konserwacyjny i bezpieczniki.\n'
  + 'Logika biznesowa (23 tory: BIURO, ZDROWIE, REPLY, LEADY, TRESCI, PRZYCHOD)\n'
  + 'siedzi w MV ORKIESTRATOR MASTER - ol8UAkJNVzPTlnUN.\n\n'
  + 'LOG: orch_runs, tor TICKI.\n\n'
  + 'ROLLBACK: dezaktywuj workflow i wlacz crony z backup_cron_cutover_n8n_20260906\n'
  + 'oraz backup_wygaszenie_20260904.',
  [], { color: 4, width: 760, height: 300 }
);

export default workflow('mv-supabase-ticki', 'SUPABASE TICKI - harmonogram z cron.job')
  .add(wyzwalacz0).to(przygotuj0.to(wywolanie))
  .add(wyzwalacz1).to(przygotuj1.to(wywolanie))
  .add(wyzwalacz2).to(przygotuj2.to(wywolanie))
  .add(wyzwalacz3).to(przygotuj3.to(wywolanie))
  .add(wyzwalacz4).to(przygotuj4.to(wywolanie))
  .add(wyzwalacz5).to(przygotuj5.to(wywolanie))
  .add(wyzwalacz6).to(przygotuj6.to(wywolanie))
  .add(wyzwalacz7).to(przygotuj7.to(wywolanie))
  .add(wyzwalacz8).to(przygotuj8.to(wywolanie))
  .add(notatka);
