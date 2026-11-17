// tests/worked-balance-invariance.test.mjs -- an account in another currency, a part share of an account and a trust as its
// owner (gap list, next 60, items 18 and 19; modules/balance/net-worth/worked.js) change nothing for a plan where nobody uses
// them. Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones, the round 8 households,
// the four Get started personas and the empty plan (none holds `currency`, `share`, `fullBalance`, `trust` or `currencyRates`):
//   - every module whose manifest reads `accounts` gives, byte for byte, the compute() output it gave before;
//   - Net worth, Update my balances, Account detail and Import draw the very words they drew before, and Net worth's add form
//     too once its new boxes ("Its currency", the rate, "How much of it is yours", "Owned by a trust") are taken out;
//   - the writers (Update's saveAll and slipsIn, Account detail's saveBalance, Import's balanceOffer, setBalanceFromFile and
//     undoBalance) write the very plan they wrote before;
// checked by a digest per plan written down from the code before the change (commit e223a42).
//
// To write the digests down again after a deliberate change: PRINT=1 node --test tests/worked-balance-invariance.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import * as round8 from "../qa/fixtures/round8-households.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";
import { renderPage } from "../qa/fixtures/fake-dom.mjs";
import registry from "../modules/registry.js";
import { compute as netWorth } from "../modules/balance/net-worth/compute.js";
import { compute as update, saveAll, slipsIn } from "../modules/balance/update/compute.js";
import { saveBalance } from "../modules/balance/accounts/compute.js";
import { balanceOffer, setBalanceFromFile, undoBalance } from "../modules/transactions/import/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
const FILE = new URL("./worked-balance-invariance.json", import.meta.url);
async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn(T) });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `round8 ${name}`, plan: fn() });
  for (const n of ["sam", "jordan", "patLee", "ruth"]) out.push({ name: `persona ${n}`, plan: personas.finishSetup(n, personas[n](T), T) });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = (await plans()).map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v, (k, x) => (x instanceof Map ? [...x] : x instanceof Set ? [...x] : x)) ?? "undefined").digest("base64url").slice(0, 22);
const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
const arun = async (fn) => { try { return await fn(); } catch (e) { return { threw: e.message }; } };

// every module whose manifest says it reads `accounts` (heavy ones too: their compute is the same pure function)
const READERS = [];
for (const r of registry) {
  const m = (await r.load()).default;
  if (Array.isArray(m.needs) && m.needs.includes("accounts") && typeof m.compute === "function") READERS.push([`${r.group}/${r.id}`, m.compute]);
}
// the boxes Net worth's add form gains (worked.js): taken out before its words are compared
const NEW_BOXES = ["currency", "rate", "rateOn", "shareOf", "sharePct", "trust"];
const withoutNew = (root) => { for (const name of NEW_BOXES) for (const el of root.all().filter((e) => e.getAttribute?.("name") === name)) (el.closest("label") ?? el).remove(); return root; };
const page = (rel) => new URL(`../modules/${rel}/view.js`, import.meta.url).href;
const CO = { "balance/net-worth": netWorth, "balance/update": update };

// a written plan, compared without its stamp (meta: createdAt and updatedAt are the clock's when a fixture is built)
const kept = (d) => ({ ...d, meta: { ...(d.meta ?? {}), createdAt: null, updatedAt: null } });
/** What the writers write for one plan (a fresh copy each). */
function writers(plan) {
  const accts = (plan.accounts ?? []).filter((a) => a && typeof a.id === "string");
  const first = accts[0] ?? null;
  const typed = Object.fromEntries(accts.map((a, i) => [a.id, i % 3 === 0 ? null : Math.abs(Number(a.balance) || 0) + 1 + i]));
  const out = {};
  out.saveAll = run(() => { const d = structuredClone(plan); const r = saveAll(d, typed, T); return { r, d: kept(d) }; });
  out.slips = run(() => slipsIn(plan, Object.fromEntries(accts.map((a) => [a.id, (Math.abs(Number(a.balance) || 0) * 10) || 1000]))));
  if (!first) return out;
  out.saveBalance = run(() => { const d = structuredClone(plan); const r = saveBalance(d, first.id, T, 1234.56); return { r, d: kept(d) }; });
  out.saveBalanceEarlier = run(() => { const d = structuredClone(plan); const r = saveBalance(d, first.id, "2020-01-31", 99); return { r, d: kept(d) }; });
  const kind = ["credit"].includes(first.type) ? "card" : first.type === "savings" ? "savings" : "checking";
  const fileAccount = { kind, balance: 4321.09, balanceDate: T, currency: null, rows: [] };
  out.offer = run(() => balanceOffer(plan, first.id, fileAccount, { today: T }));
  out.offerEuro = run(() => balanceOffer(plan, first.id, { ...fileAccount, currency: "EUR" }, { today: T }));
  out.setFromFile = run(() => {
    const d = structuredClone(plan);
    const offer = { accountId: first.id, amount: 4321.09, date: T, was: 0, wasAsOf: null, debt: false };
    const rec = setBalanceFromFile(d, offer);
    const after = kept(structuredClone(d));
    const undone = rec ? undoBalance(d, { accountId: first.id, balance: rec }) : null;
    return { rec, after, undone, d: kept(d) };
  });
  return out;
}

test(`no plan holds a currency, a share, a whole balance, a trust or a rate today: ${ALL.length} plans, ${READERS.length} pages that read accounts`, () => {
  assert.ok(ALL.length >= 45, `${ALL.length} plans`);
  assert.ok(READERS.length >= 100, `${READERS.length} readers`);
  for (const { name, plan } of ALL) {
    for (const a of plan.accounts ?? []) for (const k of ["currency", "share", "fullBalance", "trust"]) assert.ok(!(a && k in a), `${name}: ${a?.name} holds ${k}`);
    assert.ok(!("currencyRates" in plan) && !("rates" in (plan.meta ?? {})), `${name}: currencyRates`);
  }
});

test("with none of them, every reader of accounts, the four pages and the writers give what they gave before (digests from e223a42)", async () => {
  const now = {};
  for (const { name, plan } of ALL) {
    const row = {};
    for (const [key, fn] of READERS) row[key] = digest(run(() => fn(structuredClone(plan), { today: T })));
    row["page net-worth"] = digest(await arun(async () => (await renderPage(page("balance/net-worth"), plan, T, { computeOf: CO })).text()));
    row["page net-worth add"] = digest(await arun(async () => { const r = await renderPage(page("balance/net-worth"), plan, T, { computeOf: CO, route: { rest: [], query: { add: "checking" } } }); withoutNew(r.root); return r.text(); }));
    row["page update"] = digest(await arun(async () => (await renderPage(page("balance/update"), plan, T, { computeOf: CO })).text()));
    const firstId = (plan.accounts ?? [])[0]?.id;
    row["page accounts"] = digest(await arun(async () => (await renderPage(page("balance/accounts"), plan, T, { computeOf: CO, route: { rest: firstId ? [firstId] : [] } })).text()));
    row["page import"] = digest(await arun(async () => (await renderPage(page("transactions/import"), plan, T, { computeOf: CO })).text()));
    for (const [k, v] of Object.entries(writers(plan))) row[`write ${k}`] = digest(v);
    now[name] = row;
  }
  if (process.env.PRINT) {
    fs.writeFileSync(FILE, `${JSON.stringify({ note: "digests of every compute() that reads accounts, of Net worth, Update my balances, Account detail and Import as drawn, and of the balance writers, before an account could be in another currency, partly yours or a trust's (commit e223a42); tests/worked-balance-invariance.test.mjs says how to write them again", today: T, plans: now }, null, 1)}\n`);
    return;
  }
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), "the same plans");
  let compared = 0;
  for (const name of Object.keys(was)) {
    assert.deepEqual(Object.keys(now[name]).sort(), Object.keys(was[name]).sort(), `${name}: the same digests`);
    for (const k of Object.keys(was[name])) { assert.equal(now[name][k], was[name][k], `${name}: ${k}`); compared++; }
  }
  assert.ok(compared >= 45 * 110, `${compared} digests`);
});
