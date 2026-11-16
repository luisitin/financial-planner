// tests/one-figure-totals.test.mjs -- "One figure or item by item" (gap list, next 60, item 11) counts the same total either way,
// on every invented household. For each plan (every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built
// ones, the round 8 households, the four Get started personas and the empty plan), a twin is made where each account and each
// income line that could go into one figure is split in two halves (the halves alike in everything but name and amount). Then
// every kind that can be put together is (Net worth's asOne and Income's asOne), and after that listed item by item again:
//   - Net worth's figures (what you own, owe, net worth, cash, easy to sell, invested, by kind, by tax group, our guesses),
//   - Income's (a month, a year, next year, taxed, untaxed, one-time, held back, by kind, by person),
//   - Paycheck's take-home and each earner's paycheck, the Federal estimate's result,
//   - the retirement plan's starting savings by tax group, contributions by group and person, income by kind, person and
//     ages, the income it leaves out after work by kind, person and why (review 2026-11-16 F1: a put-together support line
//     named for a dependent was read as child support and dropped from that list), and its answer (the verdict, what it can pay for, how much is covered, the savings each year)
// are the plan's own, to the cent, at every step; and Undo (core/ui/undo.js, what ui.undoable uses) gives back the split plan
// exactly.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import * as round8 from "../qa/fixtures/round8-households.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";
import { changesOf, takeBack } from "../core/ui/undo.js";
import { compute as netWorth } from "../modules/balance/net-worth/compute.js";
import * as NW from "../modules/balance/net-worth/one-figure.js";
import { compute as income } from "../modules/cashflow/income/compute.js";
import * as INC from "../modules/cashflow/income/one-figure.js";
import { compute as paycheck, takeHome } from "../modules/cashflow/paycheck/compute.js";
import { compute as federal } from "../modules/taxes/federal/compute.js";
import { buildInputs, compute as projection } from "../modules/retirement/projection/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
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
const cents = (n) => Math.round(n * 100) / 100;
/** The twin: every account and income line free to go into one figure (one that is alone in sectionsOf({ all })) split in halves. */
function split(plan) {
  const p = structuredClone(plan);
  const freeAcc = new Set(NW.sectionsOf(p, { all: true }).flatMap((s) => (s.keep ? [s.keep, ...s.join] : [])));
  for (const a of [...p.accounts]) {
    if (!freeAcc.has(a.id) || !(Math.abs(Number(a.balance)) > 0.02)) continue;
    const half = cents(Number(a.balance) / 2);
    p.accounts.push({ ...structuredClone(a), id: `${a.id}-half`, name: `${a.name} (2)`, balance: cents(Number(a.balance) - half), history: [] });
    a.balance = half;
  }
  const freeInc = new Set(INC.sectionsOf(p, { all: true }).flatMap((s) => (s.keep ? [s.keep, ...s.join] : [])));
  for (const x of [...p.income]) {
    if (!freeInc.has(x.id) || !(Number(x.amount) > 0.02)) continue;
    const half = cents(Number(x.amount) / 2);
    p.income.push({ ...structuredClone(x), id: `${x.id}-half`, name: `${x.name} (2)`, amount: cents(Number(x.amount) - half) });
    x.amount = half;
  }
  return p;
}
const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
/** Every total the change could reach, by what it is (never a row's id or name, which a put-together changes on purpose). */
function totals(plan) {
  const p = () => structuredClone(plan);
  const nw = run(() => { const { count, history, ...x } = netWorth(p(), { today: T }); void count; void history; return x; });
  const inc = run(() => { const { items, active, count, warnings, byPerson, ...x } = income(p(), { today: T }); void items; void active; void count; void warnings;
    return { ...x, byPerson: byPerson.map(({ personId, yearly, monthly }) => ({ personId, yearly, monthly })) }; });
  const th = run(() => { const { ratio, ...x } = takeHome(p(), { today: T }); void ratio; return x; });
  const pc = run(() => (paycheck(p(), { today: T }).people ?? []).map((x) => ({ id: x.id, gross: x.gross, net: x.net, yearly: x.yearly, paychecks: x.paychecks, period: x.period })));
  const fed = run(() => federal(p(), { today: T }).result ?? null);
  const retire = run(() => {
    const b = buildInputs(p(), { today: T });
    if (!b?.inputs) return { missing: b?.missing ?? null };
    const add = (m, k, v) => { m[k] = (m[k] ?? 0) + (Number(v) || 0); };
    const contributions = {}, incomes = {}, left = {};
    for (const c of b.inputs.contributions ?? []) add(contributions, `${c.bucket}|${c.personIndex}|${c.untilYear ?? ""}`, c.yearly);
    for (const x of b.inputs.incomes ?? []) add(incomes, `${x.kind ?? x.type ?? ""}|${x.personIndex}|${x.startAge ?? ""}|${x.endAge ?? ""}|${x.taxable}`, x.yearly);
    for (const x of b.otherLeft ?? []) add(left, `${x.type}|${x.personId}|${x.why}`, x.yearly);
    const r = projection(p(), { today: T });
    return { balances: b.inputs.balances, contributions, incomes, left,
      answer: { ready: r.ready, verdict: r.verdict ?? null, affordable: r.affordable ?? null, coverage: r.coverage ?? null, atRetirement: r.atRetirement ?? null, atEnd: r.atEnd ?? null, rows: (r.rows ?? []).map((x) => x.total) } };
  });
  return { nw, inc, th, pc, fed, retire };
}
function close(a, b, where) {
  if (typeof a === "number" && typeof b === "number") { assert.ok(Math.abs(a - b) <= Math.max(0.005, 1e-9 * Math.abs(a)), `${where}: ${a} != ${b}`); return; }
  if (a && b && typeof a === "object") {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), where);
    for (const k of Object.keys(a)) close(a[k], b[k], `${where}.${k}`);
    return;
  }
  assert.deepEqual(a, b, where);
}
const asOneAll = (plan) => {
  const p = structuredClone(plan);
  let n = 0;
  for (const s of NW.sectionsOf(p)) if (s.join.length && NW.asOne(p, s.key, T)) n++;
  for (const s of INC.sectionsOf(p)) if (s.join.length && INC.asOne(p, s.key)) n++;
  return { p, n };
};
const itemizeAll = (plan) => {
  const p = structuredClone(plan);
  for (const s of NW.sectionsOf(p, { all: true })) NW.itemize(p, s.key);
  for (const s of INC.sectionsOf(p, { all: true })) INC.itemize(p, s.key);
  return p;
};

test(`the twin with every free row split in two counts what the plan counts: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 45, `${ALL.length} plans`);
  let rows = 0;
  for (const { name, plan } of ALL) {
    const s = split(plan);
    rows += s.accounts.length - plan.accounts.length + s.income.length - plan.income.length;
    close(totals(s), totals(plan), `${name} split`);
  }
  assert.ok(rows >= 120, `${rows} rows split`);
});

test("one figure: putting every kind together, then listing it item by item again, leaves every total the plan's own; Undo gives back the plan exactly", () => {
  let merged = 0;
  for (const { name, plan } of ALL) {
    const base = totals(plan);
    const twin = split(plan);
    const { p: one, n } = asOneAll(twin);
    merged += n;
    close(totals(one), base, `${name} one figure`);
    // each kind put together is one row now, and marked
    for (const s of NW.sectionsOf(one)) assert.ok(s.join.length === 0, `${name}: ${s.name} has nothing left to put together`);
    for (const s of INC.sectionsOf(one)) assert.ok(s.join.length === 0, `${name}: ${s.name} has nothing left to put together`);
    close(totals(itemizeAll(one)), base, `${name} item by item again`);
    // Undo: what ui.undoable keeps (changesOf) taken back (takeBack) is the twin, exactly
    const draft = structuredClone(one);
    const r = takeBack(draft, changesOf(twin, one));
    assert.equal(r.kept, 0, `${name}: nothing kept by Undo`);
    assert.deepEqual(draft, twin, `${name}: Undo gives back every row`);
  }
  assert.ok(merged >= 60, `${merged} kinds put together`);
});

test("one figure on the plans as they are: whatever can be put together changes no total", () => {
  for (const { name, plan } of ALL) {
    const { p } = asOneAll(plan);
    close(totals(p), totals(plan), `${name} as it is`);
  }
});
