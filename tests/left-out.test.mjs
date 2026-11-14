// tests/left-out.test.mjs -- gap design #32 (2026-11-14): a purchase paid back later, a line left out of reports, a flag
// and a refund link (`transactions[].reimb`, `exclude`, `flag`, `refundOf`; modules/transactions/splits.js leftOut / linesOf,
// ledger allLines). Over the 14 households of qa/households and four fixture plans, each given six months of invented bank
// lines (qa/fixtures/bank-lines.mjs):
//   1. invariance: with none of the marks set, the lines a page reads are plan.transactions itself, linesOf gives what it
//      gave before, and every module that reads transactions gives byte-identical output with the fields absent or empty;
//   2. a line left out is in no total on any page that totals transactions, by exactly its amount, and a paid-back pair
//      is out of both money in and money out: nothing is counted twice and nothing else moves;
//   3. a flag and a refund link change no figure anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { samplePlan } from "../qa/fixtures/sample-plan.mjs";
import { renterDebtPlan } from "../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../qa/fixtures/retired-couple-plan.mjs";
import { withBankLines, splitSome } from "../qa/fixtures/bank-lines.mjs";
import { compute as ledger, allLines, everyLine, linesOf, partsOf, leftOut, splitsOf } from "../modules/transactions/ledger/compute.js";
import { compute as spending } from "../modules/cashflow/spending/compute.js";
import { compute as budget } from "../modules/cashflow/budget/compute.js";
import { compute as incomeStatement } from "../modules/cashflow/income-statement/compute.js";
import { compute as categories, categoriesOf } from "../modules/transactions/categories/compute.js";
import { compute as categorize } from "../modules/transactions/categorize/compute.js";
import { bankSpend } from "../modules/overview/guesses/estimators/spend.js";
import { DATASETS } from "../modules/reports/export/compute.js";
import { compute as monthlyReview } from "../modules/overview/monthly-review/compute.js";
import { compute as recurring } from "../modules/cashflow/recurring/compute.js";
import { compute as calendar } from "../modules/household/calendar/compute.js";
import { emptyPlan } from "../core/schema/migrate.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-13";
const PLANS = [
  ...ARCHETYPES.map((a, i) => ({ name: a.id, plan: withBankLines(a.build(), i + 1) })),
  { name: "family", plan: withBankLines(familyPlan(T), 40) }, { name: "sample", plan: samplePlan() }, { name: "sample + lines", plan: withBankLines(samplePlan(), 41) },
  { name: "renter with debts", plan: withBankLines(renterDebtPlan(T), 42) }, { name: "retired couple", plan: withBankLines(retiredCouplePlan(T), 43) },
];
/** Every module whose compute.js names transactions (it reads them, or a page that does). */
async function readers() {
  const mods = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js");
      if (m.isDirectory() && fs.existsSync(f) && /transactions/.test(fs.readFileSync(f, "utf8"))) mods.push([`${g.name}/${m.name}`, (await import(pathToFileURL(f).href)).compute]);
    }
  }
  return mods.filter(([, fn]) => typeof fn === "function");
}
const READERS = await readers();
// System > Diagnostics, Settings and Backups measure the saved plan's size: any field added changes it, by design
const SIZE_ONLY = new Set(["system/diagnostics", "system/settings", "system/backups"]);
const out = (fn, plan, params = { today: T }) => { try { return JSON.stringify(fn(structuredClone(plan), params)); } catch (e) { return `throws ${e.message}`; } };
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} != ${b}`);
const monthsOf = (plan) => [...new Set((plan.transactions ?? []).map((t) => String(t.date).slice(0, 7)))].sort();
const sum = (list, f) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const ym = (t) => String(t.date).slice(0, 7);
/** linesOf as it was before the marks (gap #24): the transaction, or one line per part of a usable split. */
const linesBefore = (t) => { const s = splitsOf(t); if (!s) return [t]; const { splits, ...whole } = t; return s.map((p, i) => ({ ...whole, category: p.category ?? "", amount: Math.round(Number(p.amount) * 100) / 100, splitOf: t.id, splitIndex: i })); };

/**
 * markSome(plan) -> { plan: a copy with marks, gone: [the lines left out], pairs }: of the filed purchases, every fifth is
 * left out of reports, every fifth (the next one) waits to be paid back, and every eleventh is paid back by a money-in line
 * of the same month made for the test's sake (an income line: the pair is linked both ways, as the form writes it); one
 * money-in line is left out too. Never a tax or debt line (the Income statement's bank-against-plan leaves those out).
 */
function markSome(plan) {
  const p = structuredClone(plan);
  const kinds = new Map(categoriesOf(p, { all: true }).map((c) => [c.id, c.kind]));
  const purchase = (t) => Number(t.amount) < -0.05 && !!t.category && !t.transferId && kinds.get(t.category) === "expense" && t.category !== "taxes" && t.category !== "debt";
  const income = p.transactions.filter((t) => Number(t.amount) > 0 && !t.transferId && kinds.get(t.category) === "income");
  const gone = [];
  let i = 0, pairs = 0;
  for (const t of p.transactions) {
    if (!purchase(t)) continue;
    i++;
    if (i % 5 === 0) { t.exclude = true; gone.push(t); }
    else if (i % 5 === 1) { t.reimb = true; gone.push(t); }
    else if (i % 11 === 2) { const back = income.find((x) => !x.reimb && !x.exclude && ym(x) === ym(t)); if (back) { t.reimb = back.id; back.reimb = t.id; gone.push(t, back); pairs++; } }
  }
  const one = income.find((x) => !x.reimb && !x.exclude);
  if (one) { one.exclude = true; gone.push(one); }
  return { plan: p, gone, pairs };
}

test(`the households have bank lines to test on: ${PLANS.length} plans, ${READERS.length} modules that read transactions; none carries a mark`, () => {
  assert.ok(PLANS.length >= 19); assert.ok(READERS.length >= 30, `${READERS.length}`);
  for (const { name, plan } of PLANS) {
    assert.ok(plan.transactions.length >= 10, `${name}: ${plan.transactions.length} lines`);
    assert.ok(plan.transactions.every((t) => !("reimb" in t) && !("exclude" in t) && !("flag" in t) && !("refundOf" in t)), name);
  }
});

test("invariance: with no mark anywhere the lines read are plan.transactions itself, linesOf gives what it gave, and every reader gives the same output with the fields absent or empty", () => {
  let ran = 0;
  for (const { name, plan } of PLANS) {
    assert.equal(allLines(plan), plan.transactions, `${name}: the very same array`); assert.equal(everyLine(plan), plan.transactions);
    for (const t of plan.transactions) { assert.equal(leftOut(t), false); assert.equal(linesOf(t)[0], t); assert.equal(linesOf(t).length, 1); }
    // split purchases, no mark: the lines are what they were, part for part
    const s = splitSome(plan, "other");
    for (const t of s.transactions) { assert.deepEqual(linesOf(t), linesBefore(t), `${name} ${t.id}`); assert.deepEqual(partsOf(t), linesBefore(t)); }
    assert.deepEqual(allLines(s), s.transactions.flatMap(linesBefore), `${name}: split lines`); assert.deepEqual(everyLine(s), allLines(s));
    // the fields there but holding nothing
    const empty = structuredClone(plan);
    for (const t of empty.transactions) { t.reimb = false; t.exclude = false; t.flag = false; t.refundOf = ""; }
    const strip = (x) => x.replace(/,"reimb":false,"exclude":false,"flag":false,"refundOf":""/g, "");
    for (const [id, compute] of READERS) {
      if (SIZE_ONLY.has(id)) continue;
      const base = out(compute, plan);
      assert.ok(!base.startsWith("throws"), `${name} ${id}: ${base}`);
      assert.equal(strip(out(compute, empty)), base, `${name} ${id}: empty fields`);
      ran++;
    }
    for (const ds of DATASETS) assert.equal(out((p) => ds.build(p, T), empty), out((p) => ds.build(p, T), plan), `${name} export ${ds.id}`);
    assert.equal(JSON.stringify(bankSpend(structuredClone(empty), T)), JSON.stringify(bankSpend(structuredClone(plan), T)), `${name} spending guess`);
  }
  assert.ok(ran >= 500, `${ran} runs`);
});

test("a line left out is in no total on any page that totals transactions, by exactly its amount; a paid-back pair is out of both money in and money out", () => {
  let marked = 0, paired = 0;
  for (const { name, plan } of PLANS) {
    const { plan: m, gone, pairs } = markSome(plan);
    if (!gone.length) continue;
    marked += gone.length; paired += pairs;
    const goneOut = (f = () => true) => -sum(gone.filter((t) => Number(t.amount) < 0 && f(t)), (t) => t.amount), goneIn = (f = () => true) => sum(gone.filter((t) => Number(t.amount) > 0 && f(t)), (t) => t.amount);
    // the lines a page totals: every line but the ones left out, each once
    assert.equal(allLines(m).length, plan.transactions.length - gone.length, `${name} lines`);
    near(sum(allLines(m), (l) => l.amount), sum(plan.transactions, (t) => t.amount) - sum(gone, (t) => t.amount), `${name} lines add up`);
    assert.equal(everyLine(m), m.transactions, `${name}: the copy of the data keeps every line`);

    // Ledger: everything, month by month, money out only, a search
    for (const params of [{ today: T }, ...monthsOf(plan).map((month) => ({ today: T, month })), { today: T, dir: "out" }, { today: T, q: "maple" }]) {
      const a = ledger(plan, params), b = ledger(m, params), w = `${name} ledger ${JSON.stringify(params)}`;
      const inIt = (t) => (!params.month || ym(t) === params.month) && (params.dir !== "out" || Number(t.amount) < 0) && (!params.q || String(t.payee).toLowerCase().includes(params.q));
      near(b.out, a.out - goneOut(inIt), `${w} out`); near(b.in, a.in - goneIn(inIt), `${w} in`); near(b.cardsOut, a.cardsOut, `${w} cards`);
      for (const k of ["matched", "matchedIn", "matchedOut", "total", "shown"]) assert.equal(b[k], a[k], `${w} ${k}: the line stays in the list`);
      assert.equal(b.leftOut ?? 0, gone.filter(inIt).length, `${w} how many are left out`);
    }
    // a category's own total loses its lines left out and nothing else
    for (const c of [...new Set(gone.map((t) => t.category))]) {
      const a = ledger(plan, { today: T, category: c }), b = ledger(m, { today: T, category: c });
      near(b.out, a.out - goneOut((t) => t.category === c), `${name} ledger ${c} out`); near(b.in, a.in - goneIn((t) => t.category === c), `${name} ledger ${c} in`);
    }

    // Where the money goes: each month's total and count
    for (const month of monthsOf(plan)) {
      const a = spending(plan, { today: T, month }), b = spending(m, { today: T, month }), w = `${name} spending ${month}`;
      if (a.month !== month || b.month !== month) continue;   // a month with no spending falls back to another
      near(b.total, a.total - goneOut((t) => ym(t) === month), `${w} total`);
      assert.equal(b.count, a.count - gone.filter((t) => Number(t.amount) < 0 && ym(t) === month).length, `${w} count`);
      assert.equal(b.biggest.some((x) => gone.some((t) => t.id === x.id)), false, `${w}: not among the biggest lines`);
    }

    // Budget: each category's spending this month, in an envelope or outside one (the list outside leaves out a category
    // whose refunds outweigh it, so the check goes category by category)
    for (const month of monthsOf(plan)) {
      const a = budget(plan, { today: T, month }), b = budget(m, { today: T, month });
      const by = (d) => new Map([...d.envelopes, ...d.unbudgeted.filter((u) => !u.card)].map((e) => [e.category, e.spent]));
      const was = by(a), now = by(b);
      for (const [c, spent] of now) if (was.has(c)) near(spent, was.get(c) - goneOut((t) => ym(t) === month && t.category === c), `${name} budget ${month} ${c}`);
      near(sum(b.unbudgeted.filter((u) => u.card), (u) => u.spent), sum(a.unbudgeted.filter((u) => u.card), (u) => u.spent), `${name} budget ${month} cards`);
    }

    // Income statement: every month's money in and money out, and the totals
    { const a = incomeStatement(plan, { today: T }), b = incomeStatement(m, { today: T });
      assert.deepEqual(b.rows.map((r) => r.ym), a.rows.map((r) => r.ym), `${name} income statement months`);
      a.rows.forEach((r, i) => { near(b.rows[i].out, r.out - goneOut((t) => ym(t) === r.ym), `${name} ${r.ym} out`); near(b.rows[i].in, r.in - goneIn((t) => ym(t) === r.ym), `${name} ${r.ym} in`); });
      const shown = new Set(a.rows.map((r) => r.ym));
      near(b.totals.out, a.totals.out - goneOut((t) => shown.has(ym(t))), `${name} out`); near(b.totals.in, a.totals.in - goneIn((t) => shown.has(ym(t))), `${name} in`); }

    // Categories: where a category is used does not change (a line left out still carries its category)
    assert.equal(out(categories, m), out(categories, plan), `${name} categories`);

    // Export: every line is in the copy, and the ones left out say so
    { const tx = DATASETS.find((d) => d.id === "transactions"), a = tx.build(plan, T), b = tx.build(m, T);
      assert.equal(b.rows.length, a.rows.length); near(sum(b.rows, (r) => r[3]), sum(a.rows, (r) => r[3]), `${name} export`);
      assert.equal(b.headers.at(-1), "counts"); assert.equal(a.headers.includes("counts"), false);
      assert.equal(b.rows.filter((r) => String(r.at(-1)).startsWith("no: ")).length, gone.length); }

    // the spending guesses read the lines that count: the same answer as a plan whose left-out lines are money moved
    // between your own accounts (which no page counts either)
    { const twin = structuredClone(m); for (const t of twin.transactions) if (leftOut(t)) { delete t.exclude; delete t.reimb; t.transferId = `twin-${t.id}`; t.category = "transfer"; }
      assert.equal(JSON.stringify(bankSpend(structuredClone(m), T)), JSON.stringify(bankSpend(twin, T)), `${name} spending guess`); }

    // Categorize: a line left out waits for no category; the others are as they were
    { const a = categorize(plan), b = categorize(m);
      assert.equal(b.uncategorised, a.uncategorised - gone.filter((t) => !t.category).length, `${name} to file`); assert.equal(b.total, a.total); }
  }
  assert.ok(marked >= 300, `${marked} lines left out`); assert.ok(paired >= 15, `${paired} pairs`);
});

test("a left-out purchase that is also split is left out whole: none of its parts reaches a total", () => {
  for (const { name, plan } of PLANS) {
    const s = splitSome(plan, "other");
    const split = s.transactions.filter((t) => t.splits);
    if (!split.length) continue;
    const base = ledger(s, { today: T });
    for (const t of split) t.exclude = true;
    const d = ledger(s, { today: T });
    near(d.out, base.out + sum(split, (t) => t.amount), `${name} out`);
    assert.equal(allLines(s).some((l) => l.splitOf !== undefined), false, name);
    assert.equal(everyLine(s).filter((l) => l.splitOf !== undefined).length, 2 * split.length, `${name}: the copy keeps the parts`);
  }
});

test("a flag and a refund link change no figure: every reader gives the same output but for the marks themselves", () => {
  for (const { name, plan } of PLANS) {
    const f = structuredClone(plan);
    const buys = f.transactions.filter((t) => Number(t.amount) < 0 && !t.transferId);
    f.transactions.forEach((t, i) => { if (i % 4 === 0) t.flag = true; if (Number(t.amount) > 0 && !t.transferId && buys.length && i % 3 === 0) t.refundOf = buys[i % buys.length].id; });
    assert.equal(allLines(f), f.transactions, `${name}: the very same array`);
    const strip = (x) => x.replace(/,"flag":true/g, "").replace(/,"refundOf":"[^"]*"/g, "").replace(/,"refundLabel":"[^"]*"/g, "");
    for (const [id, compute] of READERS) {
      if (SIZE_ONLY.has(id)) continue;
      // Categorize lists the flagged lines: the rest of its answer is as it was
      if (id === "transactions/categorize") { const { flagged, ...rest } = compute(structuredClone(f), { today: T }); assert.equal(JSON.stringify(rest), out(compute, plan), `${name} ${id}`); assert.equal(flagged.length, f.transactions.filter((t) => t.flag).length); continue; }
      assert.equal(strip(out(compute, f)), out(compute, plan), `${name} ${id}`);
    }
    for (const ds of DATASETS) assert.equal(out((p) => ds.build(p, T), f), out((p) => ds.build(p, T), plan), `${name} export ${ds.id}`);
    assert.equal(JSON.stringify(bankSpend(structuredClone(f), T)), JSON.stringify(bankSpend(structuredClone(plan), T)));
  }
});

// ---- what two critics found (2026-11-14): pages that read plan.transactions themselves agree with the Transactions page
const line = (id, date, amount, payee, category = "", extra = {}) => ({ id, date, amount, payee, rawPayee: payee.toUpperCase(), accountId: "chk", category, tags: [], note: "", ...extra });
const small = (lines) => { const p = emptyPlan(); p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 1000 }]; p.transactions = lines; return p; };

test("critic M2: the monthly check-in counts the same lines with no category as Categorize: a line left out waits for none", () => {
  const lines = (mark = {}) => [line("pay", "2026-10-01", 3000, "Employer", "income-salary"), line("gro", "2026-10-05", -80, "Kroger", "groceries"), line("odd", "2026-10-09", -45, "Corner shop", "", mark)];
  const step = (plan) => monthlyReview(plan, { today: "2026-11-13", month: "2026-10" }).steps.find((s) => s.id === "file");
  const before = step(small(lines()));
  assert.match(before.detail, /^1 of October 2026's transactions has no category yet/); assert.equal(categorize(small(lines())).uncategorised, 1);
  for (const mark of [{ exclude: true }, { reimb: true }]) {
    const p = small(lines(mark));
    assert.equal(categorize(p).uncategorised, 0);
    assert.doesNotMatch(step(p).detail, /no category yet/, JSON.stringify(mark)); assert.notEqual(step(p).status, "todo");
  }
  // junk in the field leaves nothing out, here as on the Transactions page (critic M3)
  assert.match(step(small(lines({ exclude: "no" }))).detail, /^1 of October 2026's transactions has no category yet/);
});

test("critic M4: a bill that is left out of the totals is not a bill to expect, and a month whose only spending is left out is not offered", () => {
  const gym = (mark = {}) => ["2026-07-03", "2026-08-03", "2026-09-03", "2026-10-03"].map((d, i) => line(`gym${i}`, d, -40, "City Gym", "health", mark));
  const base = small([line("pay", "2026-10-01", 3000, "Employer", "income-salary"), ...gym()]);
  assert.ok(recurring(base, { today: T }).detected.some((r) => /gym/i.test(r.payee)), "the fixture's bill is found");
  const left = small([line("pay", "2026-10-01", 3000, "Employer", "income-salary"), ...gym({ reimb: true })]);
  assert.equal(recurring(left, { today: T }).detected.some((r) => /gym/i.test(r.payee)), false);
  assert.equal(JSON.stringify(calendar(left, { today: T })).includes("City Gym"), false, "nor on the calendar");
  assert.equal(JSON.stringify(calendar(base, { today: T })).includes("City Gym"), true);
  // the spending page's months
  const two = (mark = {}) => small([line("a", "2026-09-10", -30, "Cafe", "dining", mark), line("b", "2026-10-10", -50, "Kroger", "groceries")]);
  assert.deepEqual(spending(two(), { today: T }).months.map((m) => m.ym ?? m), ["2026-10", "2026-09"]);
  assert.deepEqual(spending(two({ exclude: true }), { today: T }).months.map((m) => m.ym ?? m), ["2026-10"]);
});
