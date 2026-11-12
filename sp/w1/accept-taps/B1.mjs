// B1. A double tap does one thing. Save, Add, Continue, "Use this one", a menu row, "Use these as my budget", tapped twice
// on the same spot 150 / 400 / 750 ms apart, and a thumb that keeps tapping (4 taps 350 and 450 ms apart): the end state
// is the one a single tap gives (same page, same plan, same open forms, the same last confirmation).
// usage: node B1.mjs <base> <root>
import { H, BASE, open, sleep, settle, state, tapText, fillBox, say, done, under, bringTo, planOf } from "./_lib.mjs";
const btn = (p, text) => p.locator("#content button:visible, #content a:visible").filter({ hasText: text }).first();
const CASES = [
  { id: "debts-save", who: "family", route: "balance/liabilities", at: 600, prep: async (p) => { const row = p.locator("#content li").filter({ hasText: "Visa" }).first(); await row.scrollIntoViewIfNeeded(); await row.tap(); await sleep(700); return p.locator("#content form:visible button[type=submit]").first(); } },
  { id: "income-add", who: "family", route: "cashflow/income", at: 600, prep: async (p) => { await tapText(p, "+ Add another income", { scope: "#content" }); await sleep(300); await fillBox(p, "What is it", "Tips"); await fillBox(p, "Amount", "250"); return p.locator("#content form:visible button[type=submit]").first(); } },
  { id: "contrib-add", who: "family", route: "retirement/contributions", at: 738, prep: async (p) => { await tapText(p, "+ Add another contribution", { scope: "#content" }); await sleep(300); await fillBox(p, "Your own money", "250"); return p.locator("#content button", { hasText: "Add contribution" }).first(); } },
  { id: "plan-continue", who: "family", route: "overview/plan", at: null, prep: async (p) => btn(p, /^Continue/) },
  { id: "menu-row", who: "family", route: "cashflow/income", at: null, prep: async (p) => { const b = await p.locator("#nav-toggle").boundingBox(); await p.touchscreen.tap(b.x + 22, b.y + 22); await sleep(500); return p.locator("#sidebar .nav-link.ready-link:visible").filter({ hasText: "Dashboard" }).first(); } },
  { id: "budget-use", who: "family", route: "cashflow/budget", at: null, prep: async (p) => btn(p, "Use these as my budget") },
  { id: "use-this-one", who: "ruth", route: "retirement/withdrawal-strategy?guide=plan&step=take-out", at: null, prep: async (p) => { const b = p.getByRole("button", { name: "Use this one" }).first(); await b.scrollIntoViewIfNeeded(); return b; } },
  { id: "networth-add", who: "blank", route: "balance/net-worth", at: 700, prep: async (p) => { await fillBox(p, "Name", "Checking").catch(() => {}); await fillBox(p, "Balance", "1,200").catch(() => {}); return p.locator("#content button", { hasText: "Add account" }).first(); } },
];
const scrub = (k, v) => (/(At|updated|modified|stamp|savedOn|asOf)$/i.test(k) || k === "meta" || k === "id" || k === "netWorthHistory" ? undefined : typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) ? "ID" : v);
const digest = (plan) => { const j = JSON.stringify(plan, scrub) ?? ""; return j.length + ":" + j.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); };
async function trial(c, times) {
  const s = await open({ base: BASE, plan: H[c.who](), route: c.route }); const p = s.page; p.setDefaultTimeout(6000);
  try {
    await sleep(500); await settle(p);
    const loc = await c.prep(p);
    if (c.at !== null) await bringTo(p, loc, c.at); else await loc.scrollIntoViewIfNeeded();
    await sleep(900);   // a person reads before tapping
    const b = await loc.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const hits = [];
    for (const [i, t] of times.entries()) { if (i) { await sleep(t - times[i - 1]); hits.push(await under(p, x, y)); } await p.touchscreen.tap(x, y); }
    await sleep(1500); await settle(p);
    const a = await state(p); const plan = await planOf(p);
    const notices = a.notices.filter((n) => n.kind === "ok").map((n) => n.text.slice(0, 40));
    const fp = [a.hash, a.title, await p.locator("#content form:visible").count(), digest(plan), a.drawerOpen, notices[notices.length - 1] ?? "-"].join(" | ");
    return { fp, hits, end: a.hash, errors: [...s.pageErrors] };
  } catch (e) { return { error: String(e.message).split("\n")[0] }; }
  finally { await s.close(); }
}
const PLANS = [];
for (const c of CASES) {
  PLANS.push([c, [0]]);
  for (const g of [150, 400, 750]) PLANS.push([c, [0, g]]);
  if (["income-add", "contrib-add"].includes(c.id)) { PLANS.push([c, [0, 350, 700, 1050]]); PLANS.push([c, [0, 450, 900, 1350]]); }
}
const res = new Map();
let i = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (i < PLANS.length) { const [c, t] = PLANS[i++]; res.set(`${c.id}@${t.join("/")}`, await trial(c, t)); } }));
for (const c of CASES) {
  const one = res.get(`${c.id}@0`);
  if (one.error) { say(`${c.id} one tap`, false, `ERR ${one.error}`); continue; }
  for (const [k, r] of res) {
    if (!k.startsWith(`${c.id}@0/`)) continue;
    const taps = k.split("@")[1];
    if (r.error) { say(`${c.id} ${taps}`, false, `ERR ${r.error}`); continue; }
    const same = r.fp === one.fp && !r.errors.length;
    say(`${c.id} ${taps} ms`, same, same ? `ends as one tap does (${one.end})` : `one tap -> [${one.fp}] but taps ${taps} -> [${r.fp}]; under the thumb before the later taps: ${JSON.stringify(r.hits)} ${r.errors.join(";")}`);
  }
}
done("B1 a double tap does one thing");
