// re-skaner v4 — harvester kontaktow inwestorow i deweloperow pod oferty gruntowe.
// Odwiedza strone glowna i typowe podstrony kontaktowe, wyciaga adresy FUNKCYJNE (firmowe).
// NIE wysyla niczego. Zbiera wylacznie publiczne adresy funkcyjne w domenie firmy.
//
// v2: rozszerzona lista prefiksow funkcyjnych (leasing, general, sales, bd ... ) — wczesniej
// realne adresy dzialow byly bledne klasyfikowane jako imienne, co zanizalo podstawe RODO.
//
// v3 (2026-09-06): probowala naprawic 546 przez limit PAMIECI. Nie pomoglo —
// log edge runtime pokazal "CPU Time exceeded", nie brak pamieci. Limity pamieci
// zostawione (sa sensowne same w sobie), ale nie one byly przyczyna.
//
// v4 (2026-09-06): WLASCIWA NAPRAWA — koszt CPU.
// Dowod: booted 20:43:21.224 -> "CPU Time exceeded" 20:43:24.783, czyli budzet CPU
// wypalony w 3,5 s zegara. Winowajca: wyciagnijMaile() robilo html.match(globalny
// zlozony regex) po CALYM dokumencie. Przy 3 sciezkach na firme i 4 firmach to
// ~12 przebiegow regexa po setkach kB zminifikowanego HTML/JS, gdzie ten wzorzec
// intensywnie sie cofa (backtracking).
// Naprawa: zamiast skanowac regexem caly dokument, szukamy znaku '@' natywnym
// indexOf (skan liniowy, bardzo tani) i dopiero wokol kazdego trafienia czytamy
// po znaku w okienku +/- 64. Zlozony regex znika z goracej petli.
//
// Historia oryginalnej diagnozy (pamiec):
// Objaw: funkcja padala 4x na godzine (HTTP 546), przez co 51 inwestorow tkwilo
// w statusie 'nowy' i nie powstawal zaden nowy kontakt w re_investor_contacts.
// Przyczyna: pobierz() robilo `await r.text()` na CALEJ odpowiedzi i dopiero potem
// `.slice(0, 400000)`. Ciecie po fakcie nie chroni pamieci — caly plik byl juz wczytany.
// Przy 3 sciezkach na firme i do 10 firm na wywolanie wystarczyla jedna ciezka strona
// albo odpowiedz nie-HTML (PDF/wideo/archiwum po przekierowaniu), zeby worker padl.
// Naprawa: odrzucanie nie-HTML po naglowku, odrzucanie zadeklarowanych gigantow
// i strumieniowe czytanie z twardym limitem 300 kB — bufor nigdy nie rosnie ponad limit.
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SH = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
const UA = "RE-Skaner/1.0 (badanie rynku nieruchomosci; kontakt: kontakt@mvautoai.site)";
const MAX_BAJTOW = 300000;
const MAX_DEKLAROWANE = 5000000;
const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function db(path: string, method = "GET", body?: unknown) {
  const r = await fetch(SB + "/rest/v1/" + path, {
    method,
    headers: { ...SH, Prefer: method === "POST" ? "return=representation,resolution=ignore-duplicates" : "return=minimal" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t ? JSON.parse(t) : null };
}
async function cfg(k: string): Promise<string> {
  const r = await fetch(SB + `/rest/v1/app_config?key=eq.${k}&select=value`, { headers: SH });
  const j = await r.json().catch(() => []);
  return Array.isArray(j) && j.length ? String(j[0].value ?? "") : "";
}

const FUNKCYJNE = ["info","office","biuro","kontakt","contact","sekretariat","development","acquisitions","acquisition","land","investment","investments","invest","expansion","realestate","real.estate","property","nieruchomosci","inwestycje","rozwoj","grunty","press","pr","hq","mail","poczta","leasing","general","sales","sprzedaz","marketing","reception","recepcja","zarzad","admin","enquiries","enquiry","hello","team","poland","polska","company","corporate","headquarters","newbusiness","new.business","bd","business","asset","assets","fund","ir","secretariat"];
const SMIECIOWE = /(example|sentry|wixpress|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|\.css|\.js$|@2x|domain\.com|yourdomain|email\.com|localhost|godaddy|wordpress)/i;
const ROLA: Record<string,string> = {
  development:"development", acquisitions:"land acquisition", acquisition:"land acquisition",
  land:"land acquisition", grunty:"land acquisition", investment:"investment", investments:"investment",
  invest:"investment", inwestycje:"investment", expansion:"expansion", realestate:"real estate",
  property:"real estate", nieruchomosci:"real estate", rozwoj:"development", leasing:"leasing",
  newbusiness:"business development", bd:"business development", asset:"asset management",
  assets:"asset management", ir:"investor relations", fund:"fund management"
};

async function pobierz(url: string, ms = 12000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: ctrl.signal,
    });

    // 1. Nie-HTML odrzucamy bez czytania tresci.
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct && !/text\/html|application\/xhtml|text\/plain/.test(ct)) {
      await r.body?.cancel().catch(() => {});
      return { status: r.status, html: "" };
    }

    // 2. Zadeklarowany rozmiar ponad limit — odrzucamy bez czytania.
    const dl = Number(r.headers.get("content-length") || "0");
    if (dl > MAX_DEKLAROWANE) {
      await r.body?.cancel().catch(() => {});
      return { status: r.status, html: "" };
    }

    if (!r.body) return { status: r.status, html: "" };

    // 3. Czytamy kawalkami i przerywamy po MAX_BAJTOW. Serwer moze klamac
    //    w content-length albo go nie podac, wiec to jest wlasciwy bezpiecznik.
    const reader = r.body.getReader();
    const kawalki: Uint8Array[] = [];
    let pobrano = 0;
    while (pobrano < MAX_BAJTOW) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) {
        kawalki.push(value);
        pobrano += value.byteLength;
      }
    }
    await reader.cancel().catch(() => {});

    const dlugosc = Math.min(pobrano, MAX_BAJTOW);
    const buf = new Uint8Array(dlugosc);
    let off = 0;
    for (const k of kawalki) {
      if (off >= dlugosc) break;
      const ile = Math.min(k.byteLength, dlugosc - off);
      buf.set(k.subarray(0, ile), off);
      off += ile;
    }
    return { status: r.status, html: new TextDecoder("utf-8", { fatal: false }).decode(buf) };
  } catch (_) {
    return { status: 0, html: "" };
  } finally {
    clearTimeout(to);
  }
}

// Tanie sprawdzenia po kodzie znaku zamiast regexa w petli.
function jestLokal(c: number) {
  return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) ||
         c === 46 || c === 95 || c === 37 || c === 43 || c === 45; // . _ % + -
}
function jestHost(c: number) {
  return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) ||
         c === 46 || c === 45; // . -
}

const MAX_MALPEK = 400;          // ile znakow '@' rozpatrujemy na jednej stronie
const OKNO = 64;                 // ile znakow czytamy w lewo/prawo od '@'
const RE_LOKAL = /^[a-zA-Z0-9._%+\-]+$/;
const RE_HOST = /^[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function wyciagnijMaile(html: string, domena: string) {
  const znalezione = new Map<string, { typ: string; rola: string; pewnosc: number }>();
  const bazowa = domena.replace(/^www\./, "");
  let pos = 0;
  let malpek = 0;

  while (malpek < MAX_MALPEK) {
    const at = html.indexOf("@", pos);
    if (at < 0) break;
    pos = at + 1;
    malpek++;

    let i = at - 1;
    const minI = Math.max(0, at - OKNO);
    while (i >= minI && jestLokal(html.charCodeAt(i))) i--;
    const lokal = html.slice(i + 1, at).toLowerCase();
    if (!lokal || lokal.length > 64 || !RE_LOKAL.test(lokal)) continue;

    let j = at + 1;
    const maxJ = Math.min(html.length, at + 1 + OKNO);
    while (j < maxJ && jestHost(html.charCodeAt(j))) j++;
    const host = html.slice(at + 1, j).toLowerCase().replace(/[.\-]+$/, "");
    if (!host || !RE_HOST.test(host)) continue;

    // Tylko adresy w domenie firmy — to samo kryterium co wczesniej.
    if (!(host === bazowa || host.endsWith("." + bazowa))) continue;

    const e = lokal + "@" + host;
    if (e.length > 90 || znalezione.has(e)) continue;
    if (SMIECIOWE.test(e)) continue;

    const funkcyjny = FUNKCYJNE.some((f) => lokal === f || lokal.startsWith(f + ".") || lokal.startsWith(f + "-") || lokal.startsWith(f + "_"));
    znalezione.set(e, {
      typ: funkcyjny ? "funkcyjny" : "imienny",
      rola: ROLA[lokal.split(/[._\-]/)[0]] ?? "",
      pewnosc: funkcyjny ? 0.9 : 0.5,
    });
  }
  return [...znalezione.entries()].map(([email, v]) => ({ email, ...v }));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return J({ ok: false, powod: "METODA" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return J({ ok: false, powod: "ZLY_JSON" }, 400); }

  const t1 = await cfg("orch_token_service");
  const t2 = await cfg("orch_token");
  if (!b.p_token || (b.p_token !== t1 && b.p_token !== t2)) return J({ ok: false, powod: "ZLY_TOKEN" }, 403);

  const limit = Math.min(Math.max(Number(b.p_limit) || 5, 1), 10);
  const budzetMs = Math.min(Math.max(Number(b.p_budzet_s) || 90, 20), 150) * 1000;
  const t0 = Date.now();

  const kand = await db(`re_investors?status=eq.nowy&domena=neq.nie_wiem&select=id,nazwa,domena&order=icp_score.desc.nullslast&limit=${limit}`);
  const lista = Array.isArray(kand.body) ? kand.body : [];
  if (!lista.length) return J({ ok: true, powod: "BRAK_KANDYDATOW", przetworzonych: 0 });

  const wynik: unknown[] = [];
  let zKontaktem = 0, bezKontaktu = 0, bledow = 0;

  for (const inv of lista) {
    if (Date.now() - t0 > budzetMs) break;
    const dom = String(inv.domena || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!dom || dom === "nie_wiem") continue;

    let status = 0;
    const maile = new Map<string, { typ: string; rola: string; pewnosc: number; zrodlo: string }>();
    const sciezki = ["", "/kontakt", "/contact"];
    for (const s of sciezki) {
      if (Date.now() - t0 > budzetMs) break;
      const url = "https://" + dom + s;
      const r = await pobierz(url);
      if (s === "") status = r.status;
      if (!r.html) continue;
      for (const x of wyciagnijMaile(r.html, dom)) {
        if (!maile.has(x.email)) maile.set(x.email, { ...x, zrodlo: url });
      }
      if ([...maile.values()].some((x) => x.typ === "funkcyjny")) break;
    }

    if (status === 0) bledow++;
    const doZapisu = [...maile.values()].slice(0, 6);
    if (doZapisu.length) {
      await db("re_investor_contacts", "POST", doZapisu.map((x) => ({
        investor_id: inv.id, email: x.email, typ_adresu: x.typ,
        rola: x.rola || null, zrodlo_url: x.zrodlo, pewnosc: x.pewnosc,
      })));
      zKontaktem++;
    } else { bezKontaktu++; }

    await db(`re_investors?id=eq.${inv.id}`, "PATCH", {
      status: doZapisu.length ? "ma_kontakt" : "zeskanowany",
      www_status: status, www_sprawdzono_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });

    wynik.push({ firma: inv.nazwa, domena: dom, http: status, maili: doZapisu.length });
  }

  await fetch(SB + "/rest/v1/ops_events", { method: "POST", headers: SH, body: JSON.stringify({
    event_type: "RE_SKANER", entity_type: "re_investors", entity_id: null, source: "edge",
    metadata: { przetworzonych: wynik.length, z_kontaktem: zKontaktem, bez_kontaktu: bezKontaktu,
                bledow, ms: Date.now() - t0, outbound: false },
    business_unit: "nieruchomosci", actor_agent: "re-skaner", status: "ok" }) });

  return J({ ok: true, przetworzonych: wynik.length, z_kontaktem: zKontaktem,
             bez_kontaktu: bezKontaktu, bledow, ms: Date.now() - t0, szczegoly: wynik });
});
