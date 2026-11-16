// tests/month-agree-invariance.test.mjs -- two figures that disagreed between pages (gy1, 2026-11-16) change nothing else.
// (a) One rule for a line filed under "Taxes not withheld" on Expenses (cashflow/forecast `inMonthsTax`, `monthsTaxOf`): Next
// best action leaves an income-tax line out of spending, as much of it as the month's tax holds (the rest, and a state's tax
// where none is counted, stays spending: gy1 fix F3, F4), and Budget (50/30/20) counts a property tax as a need, as Next best
// action did. (b) The Dashboard's retirement line gives the answer Will the money last? gives while Social Security is the
// only thing missing and the money lasts even without it, naming whose it leaves out (overview/dashboard `retireRow`; the
// answer itself is overview/setup `lastsWithoutSs` in standing() since z1; gy1 fix F2, P2).
// Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones, the round 8 households, the
// four setup personas, the demo and the empty plan, with nothing new typed:
//   - the Forecast's, Expenses' and the Dashboard's compute give, byte for byte, what they gave at commit 398a01e;
//   - Next best action's compute and Get started's standing() too, except a plan with an income-tax line filed under
//     "Taxes not withheld": its money left each month is up by exactly what the month's tax holds of it (monthsTaxOf);
//   - Budget (50/30/20)'s compute too, except a plan with a line filed there that the month's tax does not hold (a property
//     tax, or the part of an estimated tax above the month's tax): its left over is down by exactly that;
//   - the Dashboard's retirement row is the one the 398a01e view built (its branches, frozen below), except a plan whose
//     only gap is Social Security and whose money lasts without it: "The money lasts, even without Sam's Social Security",
//     "On track".
//
// The digests in month-agree-invariance.json were written at commit 398a01e by this file's `figures` and `lefts` (unchanged
// since); a later deliberate change to these figures writes a new file and says so here.
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
import { demoHousehold } from "../qa/fixtures/demo-household.mjs";
import { compute as nextBest, monthOf } from "../modules/overview/next-best-action/compute.js";
import { compute as budget } from "../modules/cashflow/budget-percent/compute.js";
import { compute as forecast } from "../modules/cashflow/forecast/compute.js";
import { compute as expenses } from "../modules/cashflow/expenses/compute.js";
import { compute as dashboard, retireRow, rowWords } from "../modules/overview/dashboard/compute.js";
// (z1, 2026-11-16: the answer without the Social Security not in yet moved from the Dashboard into Get started's standing(), as
// overview/setup lastsWithoutSs and ssLeftOutWords, the one rule every overview page asks; tests/one-answer-invariance.test.mjs
// holds standing() of the three plans it lifts to e223a42 outside that answer)
import { standing, ssMissingFor, retireGuessAsk, lastsWithoutSs, ssLeftOutWords } from "../modules/overview/setup/compute.js";
import { compute as projection, savingsUnknown } from "../modules/retirement/projection/compute.js";
import { smallChangesHelp } from "../modules/overview/plan/words.js";
import { monthsTaxOf } from "../modules/cashflow/forecast/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
const FILE = new URL("./month-agree-invariance.json", import.meta.url);
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
  out.push({ name: "demo", plan: demoHousehold(T) });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out.map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
}
const ALL = await plans();
const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v) ?? "undefined").digest("base64url").slice(0, 22);
const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
const cents = (x) => (typeof x === "number" ? Math.round(x * 100) / 100 : null);
/** Every figure the change could reach, for one plan, by what it is (each on a fresh copy). */
function figures(plan) {
  const p = () => structuredClone(plan);
  return {
    nextBest: run(() => nextBest(p(), { today: T })),
    budget: run(() => budget(p(), { today: T })),
    forecast: run(() => forecast(p(), { today: T })),
    expenses: run(() => expenses(p(), { today: T })),
    dashboard: run(() => dashboard(p(), { today: T })),
    standing: run(() => standing(p(), { today: T })),
  };
}
/** The two left-over figures, to the cent (null where the page does not work one out). */
function lefts(plan) {
  const m = run(() => monthOf(structuredClone(plan), T));
  const b = run(() => budget(structuredClone(plan), { today: T }));
  return { nextBest: m?.spare ? cents(m.spare.monthly) : null, budget: b?.ready ? cents(b.saving.leftover - b.saving.short) : null };
}

test(`the invented households: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 45, `${ALL.length} plans`);
});

test("with nothing new typed, every figure is what it was at 398a01e, but for the lines the one rule now reads alike", () => {
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  assert.deepEqual(ALL.map((x) => x.name).sort(), Object.keys(was).sort(), "the same plans");
  let same = 0;
  const moved = [];
  for (const { name, plan } of ALL) {
    const now = Object.fromEntries(Object.entries(figures(plan)).map(([k, v]) => [k, digest(v)])), left = lefts(plan), w = was[name];
    // what the one rule reads differently from before: the part of an income-tax line the month's tax holds, which Next best
    // action counted on top; the rest of what is filed there (another tax, the part above the month's tax), which Budget left out
    const items = expenses(structuredClone(plan), { today: T }).items ?? [];
    const m = run(() => monthOf(structuredClone(plan), T)), sp = m?.spare;
    const incomeTax = sp ? Number(sp.taxesListed) || 0 : 0;
    if (sp) assert.ok(Math.abs(incomeTax - monthsTaxOf(items, { tax: sp.federalTax + sp.payrollTax + sp.stateTax, state: sp.stateKnown ? sp.stateTax : 0 }).listed) < 1e-9, name);
    const otherTax = items.filter((x) => x.active && x.monthly > 0 && x.category === "taxes").reduce((t, x) => t + x.monthly, 0) - incomeTax;
    for (const k of ["forecast", "expenses", "dashboard"]) { assert.equal(now[k], w[k], `${name}: ${k}`); same++; }
    for (const k of ["nextBest", "standing"]) {
      if (incomeTax > 0.005) { assert.notEqual(now[k], w[k], `${name}: ${k} moves`); continue; }
      // (z1: standing() carries the answer that stands without the Social Security not in yet; pinned in one-answer-invariance)
      if (k === "standing" && lastsWithoutSs(plan, { today: T })) continue;
      assert.equal(now[k], w[k], `${name}: ${k}`); same++;
    }
    if (otherTax > 0.005) assert.notEqual(now.budget, w.budget, `${name}: budget moves`);
    else { assert.equal(now.budget, w.budget, `${name}: budget`); same++; }
    // by exactly the line: Next best action up by the income tax it no longer takes twice, Budget down by the bill it left out
    if (incomeTax > 0.005) { assert.ok(Math.abs(left.nextBest - w.left.nextBest - incomeTax) <= 0.011, `${name}: ${left.nextBest} - ${w.left.nextBest} = ${incomeTax}`); moved.push(`${name}: next best action`); }
    else assert.equal(left.nextBest, w.left.nextBest, `${name}: next best action's left over`);
    if (otherTax > 0.005) { assert.ok(Math.abs(left.budget - w.left.budget + otherTax) <= 0.011, `${name}: ${left.budget} - ${w.left.budget} = -${otherTax}`); moved.push(`${name}: budget`); }
    else assert.equal(left.budget, w.left.budget, `${name}: budget's left over`);
  }
  assert.ok(same >= 45 * 5, `${same} digests the same`);
  // the five households of the reproduction, and no other (Nadia's on both: Next best action no longer takes the $1,138 of her
  // estimated tax the month already holds, Budget no longer leaves out the $262 above it)
  assert.deepEqual(moved.sort(), ["08-retired/base: budget", "11-self-employed/base: budget", "11-self-employed/base: next best action", "12-high-net-worth/base: budget", "14-unusual-structures/base: budget", "fixture retired-couple-plan.mjs:retiredCouplePlan: budget"]);
});

test("(a) Next best action's money left each month is Budget (50/30/20)'s left over, for every household both work one out", () => {
  let both = 0;
  const said = {};
  for (const { name, plan } of ALL) {
    const l = lefts(plan);
    said[name] = l.nextBest;
    if (l.nextBest === null || l.budget === null) continue;
    assert.ok(Math.abs(l.nextBest - l.budget) <= 0.011, `${name}: Next best action ${l.nextBest}, Budget ${l.budget}`);
    both++;
  }
  assert.ok(both >= 30, `${both} households with both`);
  // the five that disagreed, each now one figure on both pages (whole dollars, as the pages say them)
  const whole = (n) => Math.round(said[n]);
  assert.equal(whole("fixture retired-couple-plan.mjs:retiredCouplePlan"), 3003, "Ruth and Sam: their $400 property tax is spending on both");
  assert.equal(whole("08-retired/base"), 2328);
  assert.equal(whole("14-unusual-structures/base"), 1990);
  assert.equal(whole("12-high-net-worth/base"), -6474);
  assert.equal(whole("11-self-employed/base"), -800, "Nadia: of her $1,400 a month of quarterly estimated tax, the $1,138 the month's tax holds is no longer taken twice; the $262 above it is what she pays, so it counts");
});

test("(a) with a line of each hard kind added, both pages still say one figure (gy1 fix F3, F4, F5)", () => {
  const LINES = {
    "estimated tax above the month's tax": { name: "Estimated tax", category: "taxes", amount: 9000, period: "monthly", essential: true },
    "a state's income tax": { name: "State income tax", category: "taxes", amount: 300, period: "monthly", essential: true },
    "a refund typed below zero": { name: "Refund", category: "other", amount: -500, period: "monthly", essential: false },
    "a taxes line below zero": { name: "Estimated tax", category: "taxes", amount: -200, period: "monthly", essential: true },
  };
  let n = 0;
  for (const id of ["fixture retired-couple-plan.mjs:retiredCouplePlan", "11-self-employed/base", "01-single-adult/base", "08-retired/base", "12-high-net-worth/base"]) {
    const base = ALL.find((x) => x.name === id).plan;
    for (const [what, line] of Object.entries(LINES)) {
      for (const state of [undefined, "WA", "NY"]) {
        const p = structuredClone(base); p.expenses.push({ id: "x-added", ...line }); if (state) p.household.state = state;
        const l = lefts(p);
        if (l.nextBest === null || l.budget === null) continue;
        assert.ok(Math.abs(l.nextBest - l.budget) <= 0.011, `${id} + ${what}${state ? ` in ${state}` : ""}: Next best action ${l.nextBest}, Budget ${l.budget}`);
        n++;
      }
    }
  }
  assert.ok(n >= 50, `${n} cases`);
});

// ---------------------------------------------------------------- (b) the Dashboard's retirement line
/** The Dashboard's retirement row as the 398a01e view built it (overview/dashboard/view.js, its branches frozen here). */
function rowAt398a01e(st, plan, today) {
  const why = st.tileWhy ?? {};
  const back = (id) => `#/overview/setup/${id}?back=done`;
  if (!st.retire && why.retire) { const known = st.retirementKnown ?? !st.retirementMissing, s = rowWords(why.retire); return { dot: "", k: "Retirement", s, v: "Add ›", open: true, href: !known ? back("ages") : /a few more of your figures/.test(s) ? "#/retirement/projection" : back(st.tileAt?.retire ?? "spend") }; }
  if (!st.retire && !st.retirementMissing && !(plan.expenses ?? []).length) return { dot: "", k: "Retirement", s: "Needs what you spend each month", v: "Add ›", open: true, href: back("spend") };
  if (!st.retire && !st.retirementMissing) return { dot: "", k: "Retirement", s: "Needs a few more of your figures", v: "Add ›", open: true, href: "#/retirement/projection" };
  if (!st.retire) return { dot: "", k: "Retirement", s: `Needs ${st.retirementMissing}`, v: "Add ›", open: true, href: back("ages") };
  if (st.retireSavingsUnknown) return { dot: "", k: "Retirement", s: "Add your retirement savings to see", v: "Not known yet", open: true, href: back("have") };
  if (st.retireGuessed) return { dot: "", k: "Retirement", s: retireGuessAsk(st).dash, v: st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : "Needs a look", href: "#/retirement/projection" };
  let d = null; try { d = projection(plan, { today }); } catch (e) { d = { error: String(e) }; }
  const ok = st.retire.verdict === "on track", small = ok || smallChangesHelp(d);
  return { dot: ok ? "ok" : "warn", k: "Retirement", s: ok ? "The money lasts" : small ? "Small changes help" : "Check the numbers first", v: ok ? "On track" : st.retire.verdict === "tight" ? "Tight" : st.retire.shortAge ? `Short at ${st.retire.shortAge}` : "Needs a look", href: small ? "#/retirement/projection" : "#/retirement/projection?check=1" };
}
/** The answer Will the money last? gives, as its page heads it (projection view: "We don't know yet", "Runs out in YEAR", "The money lasts", "It lasts, just"). */
function pageAnswer(d) {
  if (!d?.ready) return { kind: "not ready" };
  if (savingsUnknown(d)) return { kind: "unknown" };
  return d.verdict === "short" ? { kind: "short", age: d.shortAge ?? null } : d.verdict === "on track" ? { kind: "lasts" } : { kind: "tight" };
}
const asksSs = (row) => !!row.open && /Social Security/.test(row.s);
const RUNS = ALL.map(({ name, plan }) => {
  const st = standing(structuredClone(plan), { today: T });
  const d = run(() => projection(structuredClone(plan), { today: T }));
  // (the 398a01e view was handed standing() as it was then: for a plan whose answer now stands without the Social Security not
  // in yet (z1), no answer and the tile's ask for it)
  const then = st.withoutSs ? { ...st, retire: null, tileWhy: { ...(st.tileWhy ?? {}), retire: `Needs ${st.retirementMissing}.` } } : st;
  return { name, plan, st, d, row: retireRow(st, { plan: structuredClone(plan), today: T }), was: rowAt398a01e(then, structuredClone(plan), T), page: pageAnswer(d) };
});

test("(b) the Dashboard's retirement line and the answer on Will the money last? agree, for every household", () => {
  const kinds = new Set();
  for (const { name, row, page, st } of RUNS) {
    kinds.add(page.kind);
    const at = `${name}: page ${JSON.stringify(page)}, row ${row.s} / ${row.v}`;
    assert.equal(row.k, "Retirement", at);
    if (page.kind === "not ready") { assert.ok(row.open && row.v === "Add ›", at); continue; }
    if (page.kind === "unknown") { assert.ok(row.v === "Not known yet" || row.open, at); continue; }
    if (page.kind === "lasts") { assert.equal(row.v, "On track", at); assert.ok(!row.open, at); continue; }
    // short or only just lasting: the same verdict, or (Social Security missing, which could change it) the page's own first ask
    if (asksSs(row)) { assert.equal(st.retirementKnown, false, at); continue; }
    if (page.kind === "tight") assert.equal(row.v, "Tight", at);
    else assert.ok(row.v === (page.age ? `Short at ${page.age}` : "Needs a look") || row.v === "Needs a look", at);
    assert.notEqual(row.v, "On track", at);
  }
  for (const k of ["lasts", "short", "tight", "not ready"]) assert.ok(kinds.has(k), `a household whose page says ${k}`);
});

test("(b) every other household's row is the one the 398a01e view built; Social Security alone missing and the money lasting: the page's answer", () => {
  const moved = [];
  for (const { name, row, was, st, plan } of RUNS) {
    if (JSON.stringify(row) === JSON.stringify(was)) continue;
    moved.push(name);
    // what moved: an ask for Social Security alone, where the page says the money lasts without it
    assert.ok(asksSs(was) && st.retirementKnown === false, `${name}: ${was.s}`);
    assert.equal(lastsWithoutSs(plan, { today: T })?.proj?.verdict, "on track", name);
    assert.deepEqual(row, { dot: "ok", k: "Retirement", s: `The money lasts, even without ${ssLeftOutWords(plan)}`, v: "On track", href: "#/retirement/projection" }, name);
  }
  assert.deepEqual(moved.sort(), ["08-retired/base", "14-unusual-structures/base", "fixture retired-couple-plan.mjs:retiredCouplePlan"]);
  // Ruth and Sam, by name: the row the sweep found ("Needs Social Security for Sam") and the one now
  const rc = RUNS.find((r) => r.name === "fixture retired-couple-plan.mjs:retiredCouplePlan");
  assert.deepEqual([rc.was.s, rc.was.v], ["Needs Social Security for Sam", "Add ›"]);
  assert.deepEqual([rc.row.s, rc.row.v, rc.row.dot], ["The money lasts, even without Sam's Social Security", "On track", "ok"]);
  // a single adult with no Social Security whose money runs short keeps the ask, as the page's own notice asks first
  const one = RUNS.find((r) => r.name === "01-single-adult/base");
  assert.equal(one.page.kind, "short");
  assert.deepEqual([one.row.s, one.row.v, one.row.href], ["Needs Social Security", "Add ›", "#/overview/setup/ages?back=done"]);
});

test("(b) counting the missing Social Security as none is what Will the money last? already does: its answer is the same", () => {
  let n = 0;
  for (const { name, plan, d } of RUNS) {
    const missing = ssMissingFor(plan);
    if (!missing.length || !d?.ready) continue;
    const p = structuredClone(plan); p.guide = p.guide ?? {}; p.guide.setup = p.guide.setup ?? {}; p.guide.setup.ss = { ...(p.guide.setup.ss ?? {}) };
    for (const m of missing) p.guide.setup.ss[m.id] = "none";
    const e = projection(p, { today: T });
    assert.deepEqual([e.verdict, e.shortAge ?? null, Math.round(e.affordable)], [d.verdict, d.shortAge ?? null, Math.round(d.affordable)], name);
    n++;
  }
  assert.ok(n >= 10, `${n} households with Social Security missing`);
  // nothing is written: the plan handed in is unchanged
  const rc = ALL.find((x) => x.name === "fixture retired-couple-plan.mjs:retiredCouplePlan").plan, before = JSON.stringify(rc);
  lastsWithoutSs(rc, { today: T }); standing(rc, { today: T });
  assert.equal(JSON.stringify(rc), before);
  // short without it, or a birth date missing too: no answer (the row keeps asking)
  assert.equal(lastsWithoutSs(ALL.find((x) => x.name === "01-single-adult/base").plan, { today: T }), null);
  const noDate = structuredClone(rc); noDate.household.people.find((q) => q.name === "Sam").birthDate = "";
  assert.equal(lastsWithoutSs(noDate, { today: T }), null);
  // Social Security already in for everyone: no answer needed (standing has it)
  const all = structuredClone(rc); all.guide = { ...(all.guide ?? {}), setup: { ...(all.guide?.setup ?? {}), ss: { "p-sam": "none" } } };
  assert.equal(lastsWithoutSs(all, { today: T }), null);
});
