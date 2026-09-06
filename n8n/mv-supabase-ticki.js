// SUPABASE TICKI - harmonogram przeniesiony z pg_cron do n8n (workflow D3tvXbjxvMDXdLRx)
//
// DLACZEGO BEZ CREDENTIALA
// Poprzednia wersja uzywala authentication: predefinedCredentialType + supabaseApi,
// ale bez podpietego credentiala. n8n API nie potrafi podpiac ISTNIEJACEGO credentiala
// do wezla (newCredential tworzy tylko placeholder), wiec workflow nie dalo sie
// uruchomic i kazde wywolanie zwrocilo by 401. To byla zapisana blokada migracji.
// Ta wersja buduje naglowki w wezle Code - zero credentiali do recznego podpinania.
//
// KLUCZ ANON W KODZIE - SWIADOMIE
// MV_SUPABASE_ANON NIE jest ustawiona w tym n8n (potwierdzone: execution 123291
// przerwalo sie na tej bramce). Uzyty klucz to legacy anon JWT, ktory z definicji
// jest publikowalny - Supabase wysyla go do kazdej przegladarki. Nie jest sekretem
// i dlatego moze stac w publicznym repozytorium.
// W kodzie NIE MA orch_token: wrappery n8n_tick_* same czytaja go z app_config.
// Jesli kiedys MV_SUPABASE_ANON zostanie ustawiona w n8n, ma pierwszenstwo.
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
    position: [0, 200]
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
    position: [280, 200]
  },
  output: [{ rpc: 'n8n_tick_10min', kadencja: 'Co 10 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_10min', naglowki: {} }]
});

const wyzwalacz2 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co 15 minut',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0-59/15 * * * *' }] } },
    position: [0, 400]
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
    position: [280, 400]
  },
  output: [{ rpc: 'n8n_tick_15min', kadencja: 'Co 15 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_15min', naglowki: {} }]
});

const wyzwalacz3 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co 30 minut',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '6-59/30 * * * *' }] } },
    position: [0, 600]
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
    position: [280, 600]
  },
  output: [{ rpc: 'n8n_tick_30min', kadencja: 'Co 30 minut', url: 'https://baza/rest/v1/rpc/n8n_tick_30min', naglowki: {} }]
});

const wyzwalacz4 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Co godzine minuta 49',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '49 * * * *' }] } },
    position: [0, 800]
  },
  output: [{}]
});

const przygotuj4 = node({
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
    position: [280, 800]
  },
  output: [{ rpc: 'n8n_tick_godzinowy', kadencja: 'Co godzine minuta 49', url: 'https://baza/rest/v1/rpc/n8n_tick_godzinowy', naglowki: {} }]
});

const wyzwalacz5 = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Oksana 7-21 minuta 46',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '46 7-21 * * *' }] } },
    position: [0, 1000]
  },
  output: [{}]
});

const przygotuj5 = node({
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
    position: [280, 1000]
  },
  output: [{ rpc: 'n8n_tick_oksana_publikuj', kadencja: 'Oksana 7-21 minuta 46', url: 'https://baza/rest/v1/rpc/n8n_tick_oksana_publikuj', naglowki: {} }]
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
      options: { response: { response: { neverError: true, fullResponse: true } }, timeout: 110000 }
    },
    position: [560, 480],
    retryOnFail: true,
    onError: 'continueRegularOutput'
  },
  output: [{ statusCode: 200, body: { ok: true, kadencja: '5min' } }]
});

const notatka = sticky(
  '## SUPABASE TICKI - harmonogram przeniesiony z pg_cron\n\n'
  + 'AUTORYZACJA BEZ CREDENTIALA. Poprzednia wersja uzywala predefinedCredentialType\n'
  + '(supabaseApi) bez podpietego credentiala. n8n API nie potrafi podpiac istniejacego,\n'
  + 'wiec workflow nie dalo sie aktywowac, a kazde wywolanie zwrociloby 401.\n'
  + 'Ta wersja buduje naglowki apikey + Bearer w wezle Code ze zmiennych srodowiskowych\n'
  + 'n8n (MV_SUPABASE_ANON, MV_SUPABASE_URL, MV_ORCH_TOKEN), dokladnie tak jak dziala\n'
  + 'MV ORKIESTRATOR MASTER. Zero credentiali do recznego podpinania.\n\n'
  + 'ARCHITEKTURA BEZ ZMIAN: n8n odpowiada wylacznie za czas. Kazda kadencja wola jeden\n'
  + 'wrapper RPC po stronie Supabase, ktory czyta orch_token z app_config i odpala wlasciwe\n'
  + 'ticki. Kazdy krok wrappera w osobnym bloku exception.\n\n'
  + 'UWAGA - DUBLOWANIE: te same zadania chodza rowniez w pg_cron. Po potwierdzeniu, ze\n'
  + 'ticki ida z n8n, trzeba wygasic odpowiadajace im crontaby, inaczej wszystko leci dwa razy.\n\n'
  + 'LOG: kazdy wrapper sam zapisuje przebieg do orch_runs (tor TICKI) przez n8n_tick_log,\n'
  + 'wiec slad zostaje nawet gdy n8n zgubi odpowiedz. Zero wezlow logujacych w n8n.\n\n'
  + 'ROLLBACK: dezaktywuj ten workflow; crony w pg_cron dzialaja niezaleznie.',
  [], { color: 4, width: 760, height: 260 }
);

export default workflow('mv-supabase-ticki', 'SUPABASE TICKI - harmonogram z cron.job')
  .add(wyzwalacz0).to(przygotuj0.to(wywolanie))
  .add(wyzwalacz1).to(przygotuj1.to(wywolanie))
  .add(wyzwalacz2).to(przygotuj2.to(wywolanie))
  .add(wyzwalacz3).to(przygotuj3.to(wywolanie))
  .add(wyzwalacz4).to(przygotuj4.to(wywolanie))
  .add(wyzwalacz5).to(przygotuj5.to(wywolanie))
  .add(notatka);
