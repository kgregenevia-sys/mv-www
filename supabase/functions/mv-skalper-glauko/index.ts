// mv-skalper-glauko — zasila baze GLAUKO wlascicielami i kupujacymi grunty, nie konkurencja.
// PKD: 41 deweloperzy, 42/43 infrastruktura i przygotowanie terenu, 68 obrot nieruchomosciami,
// 64 fundusze i holdingi inwestycyjne, 01 rolnictwo (remineralizacja gleby).
// Adres przechodzi ten sam lancuch co reszta: KRS dzial 1, domena adresu = domena strony firmowej,
// zywy MX, klasa COMPANY_GENERIC, dedup. Nic nie wysyla — tylko buduje baze.
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { "Content-Type": "application/json" } });

const SEGMENT: Record<string, string> = {
  "41": "DEWELOPERZY", "42": "INFRASTRUKTURA", "43": "INFRASTRUKTURA",
  "68": "NIERUCHOMOSCI", "64": "INWESTORZY", "01": "ROLNICTWO",
};
const FREEMAIL = new Set(["gmail.com","wp.pl","o2.pl","interia.pl","onet.pl","op.pl","vp.pl","tlen.pl","outlook.com","hotmail.com","yahoo.com","icloud.com","protonmail.com","proton.me","gazeta.pl","go2.pl"]);

async function rpc(fn: string, body: unknown): Promise<any> {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${fn}:${r.status}`);
  try { return JSON.parse(t); } catch { return t; }
}
async function sbGet(p: string): Promise<any> { const r = await fetch(`${SB}/rest/v1/${p}`, { headers: H }); return await r.json(); }
async function cfg(k: string, d: string): Promise<string> { const j = await sbGet(`app_config?key=eq.${k}&select=value`); return (j?.[0]?.value || d).trim(); }
async function setCfg(k: string, v: string) {
  await fetch(`${SB}/rest/v1/app_config?on_conflict=key`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: k, value: v, updated_at: new Date().toISOString() }) });
}
function domenaZe(u: string): string { return String(u||"").toLowerCase().trim().replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].trim(); }
async function maMx(d: string): Promise<boolean> {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(d)}&type=MX`, { headers: { accept: "application/json" } });
    if (!r.ok) return false;
    const j = await r.json();
    const mx = (j?.Answer||[]).filter((a:any)=>a?.type===15).map((a:any)=>String(a.data));
    if (!mx.length) return false;
    if (mx.every((m:string)=>m.trim().split(/\s+/)[1]===".")) return false;
    return true;
  } catch { return false; }
}
async function krs(nr: string): Promise<any|null> {
  try { const r = await fetch(`https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${nr}?rejestr=P&format=json`); if (!r.ok) return null; return await r.json(); } catch { return null; }
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  // ZMIANA 2026-09-09 (polecenie wlasciciela "bierzemy nowe adresy"): gorny limit 600 -> 2000.
  // Przy 500 numerach przebieg trwal 5-11 s przy budzecie 110 s, wiec limit 600 marnowal
  // ok. 90% dostepnego czasu. Pozyskiwanie (~150 adresow/dobe) bylo waskim gardlem wobec
  // dziennego capa wysylki 300. Zadne kryterium kwalifikacji nie jest poluzowane -
  // kazdy rekord nadal przechodzi PKD, adres z KRS dzial 1, zgodnosc domeny, brak freemaila,
  // klase COMPANY_GENERIC, dedup wobec bazy, supresji i historii wysylek oraz zywy MX.
  const ile = Math.min(Math.max(Number(u.searchParams.get("ile")||200), 20), 2000);
  const dry = u.searchParams.get("dry") === "1";
  const start = Date.now();

  let kursor = Number(await cfg("skalper_glauko_kursor", "1148000"));
  const dol = Number(await cfg("skalper_glauko_dol", "850000"));
  if (!Number.isFinite(kursor) || kursor <= dol) kursor = 1148000;

  const znal: Record<string, unknown>[] = [];
  const powody: Record<string, number> = {};
  const licz = (p: string) => { powody[p] = (powody[p]||0)+1; };
  let sprawdzone = 0;
  const P = 20;

  for (let i = 0; i < ile; i += P) {
    if (Date.now() - start > 110000) { licz("PRZERWANE_CZAS"); break; }
    const num: string[] = [];
    for (let k = 0; k < P && kursor - k > dol; k++) num.push(String(kursor - k).padStart(10, "0"));
    kursor -= num.length;
    if (!num.length) break;

    const odp = await Promise.all(num.map((n) => krs(n)));
    for (let x = 0; x < odp.length; x++) {
      sprawdzone++;
      const dane = odp[x]?.odpis?.dane;
      if (!dane) { licz("BRAK_WPISU"); continue; }
      const pkd = dane?.dzial3?.przedmiotDzialalnosci?.przedmiotPrzewazajacejDzialalnosci?.[0];
      const dzial = String(pkd?.kodDzial || "");
      const seg = SEGMENT[dzial];
      if (!seg) { licz("PKD_POZA_ZAKRESEM"); continue; }

      const sia = dane?.dzial1?.siedzibaIAdres || {};
      const email = String(sia?.adresPocztyElektronicznej || "").toLowerCase().trim();
      const www = String(sia?.adresStronyInternetowej || "").trim();
      if (!email) { licz("BRAK_EMAIL_W_KRS"); continue; }
      if (!www) { licz("BRAK_WWW_W_KRS"); continue; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { licz("ZLA_SKLADNIA"); continue; }
      const dom = email.split("@")[1];
      if (FREEMAIL.has(dom)) { licz("FREEMAIL"); continue; }
      if (domenaZe(www) !== dom) { licz("DOMENA_NIEZGODNA"); continue; }

      const klasa = await rpc("klasa_odbiorcy", { p_email: email });
      if (String(klasa) !== "COMPANY_GENERIC") { licz("KLASA_" + String(klasa)); continue; }

      const [juz, supp, kont] = await Promise.all([
        sbGet(`glauko_firmy_prywatne?email=eq.${encodeURIComponent(email)}&select=email&limit=1`),
        sbGet(`mv_suppression?email=eq.${encodeURIComponent(email)}&select=email&limit=1`),
        sbGet(`email_events?recipient_email=eq.${encodeURIComponent(email)}&event_type=eq.sent&select=id&limit=1`),
      ]);
      if (juz?.length) { licz("JUZ_W_BAZIE"); continue; }
      if (supp?.length) { licz("W_SUPRESJI"); continue; }
      if (kont?.length) { licz("JUZ_KONTAKTOWANY"); continue; }
      if (!(await maMx(dom))) { licz("BRAK_MX"); continue; }

      const nazwa = String(dane?.dzial1?.danePodmiotu?.nazwa || "").trim();
      const miasto = String(sia?.adres?.miejscowosc || "").trim();
      znal.push({ email, nazwa, segment: seg, pkd: dzial, miasto });
      if (dry) continue;

      await fetch(`${SB}/rest/v1/glauko_firmy_prywatne`, { method: "POST", headers: { ...H, Prefer: "return=minimal" },
        body: JSON.stringify({ email, nazwa, zrodlo_url: www, segment: seg, dodano_at: new Date().toISOString() }) });
      await fetch(`${SB}/rest/v1/domain_mx?on_conflict=domain`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ domain: dom, has_mx: true, deliverable: true, mx_checked_at: new Date().toISOString() }) });
      await rpc("zweryfikuj_adres", { p_email: email, p_www: www, p_mx: true, p_zrodlo: "KRS" });
    }
  }

  if (!dry) await setCfg("skalper_glauko_kursor", String(kursor));
  await fetch(`${SB}/rest/v1/ops_events`, { method: "POST", headers: { ...H, Prefer: "return=minimal" },
    body: JSON.stringify({ event_type: "SKALPER_GLAUKO", entity_type: "glauko_firmy_prywatne", source: "mv-skalper-glauko", business_unit: "GLAUKO", status: "ok",
      metadata: { sprawdzone, dodane: znal.length, kursor, dry, powody, sekundy: Math.round((Date.now()-start)/1000) } }) });

  return J({ ok: true, dry, sprawdzone, dodane: znal.length, kursor, powody, firmy: znal });
});
