import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import * as fmt from "../../../core/format.js";

const tx = (id, date, amount, category, payee = "x") => ({ id, date, amount, payee, accountId: "chk", category });
function plan() {
  const p = emptyPlan();
  p.transactions.push(
    tx("1", "2026-09-02", -120, "groceries"), tx("2", "2026-09-09", -95, "groceries"), tx("3", "2026-09-05", -60, "dining"), tx("4", "2026-09-01", -1500, "housing"), tx("5", "2026-09-03", 1950, "income-salary"),
    tx("6", "2026-08-10", -380, "groceries"), tx("7", "2026-08-12", -140, "dining"), tx("8", "2026-07-10", -420, "groceries"), tx("9", "2026-06-10", -400, "groceries"), tx("10", "2026-08-01", -1500, "housing"),
  );
  p.budgets.push({ id: "b1", category: "groceries", amount: 450, period: "monthly", rollover: true }, { id: "b2", category: "dining", amount: 100, period: "monthly", rollover: false });
  return p;
}
test("no month: nothing; a month with envelopes: spent, left, pace, rollover", () => {
  assert.equal(compute(emptyPlan()).hasData, false);
  const d = compute(plan(), { today: "2026-09-15" });
  assert.equal(d.month, "2026-09"); assert.equal(d.label, "Sep 2026"); assert.equal(d.dayOfMonth, 15); assert.equal(d.daysInMonth, 30); assert.equal(d.daysLeft, 15);
  const g = d.envelopes.find((e) => e.category === "groceries"), n = d.envelopes.find((e) => e.category === "dining");
  assert.equal(g.spent, 215); assert.equal(g.carried, 70, "August: 450 - 380 unspent rolled over"); assert.equal(g.available, 520); assert.equal(g.left, 305); assert.equal(g.pace, "on");
  assert.equal(n.spent, 60); assert.equal(n.carried, 0, "no rollover"); assert.equal(n.pace, "ahead", "60 of 100 by mid-month is faster than half");
  assert.equal(d.totals.spent, 275); assert.equal(d.totals.available, 620); assert.equal(d.totals.left, 345);
  assert.deepEqual(d.unbudgeted.map((u) => u.category), ["housing"]);
  // the lines start on Jun 10, so June is not a whole month: July and August are averaged, and "2 months" is what it was divided by
  assert.deepEqual(d.suggestFrom, ["2026-08", "2026-07"]);
  assert.equal(d.suggestions.find((s) => s.category === "housing").average, 750, "1500 once over the two whole months");
  assert.equal(d.suggestions.find((s) => s.category === "housing").months, 2);
  assert.equal(d.suggestions.find((s) => s.category === "groceries"), undefined, "already budgeted");
});
test("over budget and a past month", () => {
  const p = plan();
  p.transactions.push(tx("11", "2026-09-12", -90, "dining"));
  let d = compute(p, { today: "2026-09-15" });
  assert.equal(d.envelopes.find((e) => e.category === "dining").pace, "over");
  d = compute(p, { today: "2026-09-15", month: "2026-08" });
  assert.equal(d.dayOfMonth, 31); assert.equal(d.daysLeft, 0);
  assert.equal(d.envelopes.find((e) => e.category === "groceries").carried, 30, "July: 450 - 420");
});
test("a file with no whole month suggests nothing; a file that stops days before today is stale", () => {
  const p = emptyPlan();
  // a file downloaded on Sep 2 covering Aug 12 to Sep 2: no whole month, so no averages of a part of a month
  p.transactions.push(tx("a", "2026-08-12", -70, "groceries"), tx("b", "2026-08-20", -640, "debt"), tx("c", "2026-09-02", -40, "groceries"));
  let d = compute(p, { today: "2026-09-02" });
  assert.deepEqual(d.suggestFrom, []); assert.deepEqual(d.suggestions, []);
  assert.equal(d.stale, false, "the file reaches today");
  d = compute(p, { today: "2026-09-20" });
  assert.equal(d.stale, true, "18 days of September are not in the file yet");
  assert.equal(compute(p, { today: "2026-09-04" }).stale, false, "two days behind is normal (the bank posts late)");
  assert.equal(compute(p, { today: "2026-10-03" }).stale, true, "a new month the files do not reach yet");
  assert.equal(compute(p, { today: "2026-10-03", month: "2026-09" }).stale, false, "only this month's spent-so-far is affected");
});

test("a bill paid once a month reads paid, not spending fast; two payments or less than 90% still pace as before", () => {
  const p = plan();
  p.budgets.push({ id: "b3", category: "housing", amount: 1500, period: "monthly", rollover: false });
  let d = compute(p, { today: "2026-09-02" });
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "paid", "the mortgage on the 1st, as in August");
  // one big grocery trip on the 2nd is not a bill: last month had several payments there
  p.transactions.push(tx("13", "2026-09-02", -400, "groceries"), tx("14", "2026-09-02", -50, "dining"));
  p.budgets.find((b) => b.id === "b1").amount = 200;
  const g = compute(p, { today: "2026-09-02" }).envelopes.find((e) => e.category === "groceries");
  assert.notEqual(g.pace, "paid");
  p.transactions = p.transactions.filter((t) => !["13", "14"].includes(t.id)); p.budgets.find((b) => b.id === "b1").amount = 450;
  p.budgets.find((b) => b.id === "b3").amount = 2000;   // 1,500 of 2,000 is 75%: still fast on the 2nd
  d = compute(p, { today: "2026-09-02" });
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "ahead");
  p.budgets.find((b) => b.id === "b3").amount = 1500;
  p.transactions.push(tx("12", "2026-09-02", -100, "housing"));   // two payments, 1,600 of 1,500: over
  d = compute(p, { today: "2026-09-02" });
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "over");
});

test("no envelopes and no whole bank month: start from Expenses' amounts, added in one go (round 4)", async () => {
  const { useExpenses } = await import("./compute.js");
  const { compute: expenses } = await import("../expenses/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  const p = familyPlan(T); p.transactions = []; p.budgets = [];
  const d = compute(p, { today: T });
  const ex = expenses(p, { today: T });
  assert.equal(d.fromExpenses.length, ex.byCategory.length);
  assert.deepEqual(d.fromExpenses[0], { category: "housing", label: "Rent or mortgage", icon: "🏠", amount: 1980 });
  assert.ok(d.fromExpenses.some((x) => x.category === "debt"), "debt payments count as spending to budget");
  assert.ok(Math.abs(d.fromExpensesTotal - ex.monthly) <= d.fromExpenses.length * 0.5, `${d.fromExpensesTotal} vs ${ex.monthly}`);
  // one tap: an envelope each, never twice
  let k = 0; const id = () => `b${++k}`;
  assert.equal(useExpenses(p, d.fromExpenses, id), d.fromExpenses.length);
  assert.equal(useExpenses(p, d.fromExpenses, id), 0);
  assert.equal(p.budgets.find((b) => b.category === "groceries").amount, d.fromExpenses.find((x) => x.category === "groceries").amount);
  // with envelopes, or with a whole bank month to average, it is not offered
  assert.deepEqual(compute(p, { today: T }).fromExpenses, []);
});

// The page drawn with a stand-in for the UI kit: every element keeps its children, so the words on screen can be read
// back as text without a browser (review 2026-11-02, round 5).
function drawText(render, plan, computeOf, today) {
  const node = (tag, kids = []) => {
    const n = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, remove() {}, scrollIntoView() {}, set innerHTML(v) { n.kids = []; void v; },
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    n.append(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]),
    row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), field: (l, c) => node("field", [l, c]), select: () => node("select"), uid: () => "u", confirm: () => false };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update() {} }, computeOf, route: { query: {} } });
  return root.textContent.replace(/\s+/g, " ");
}

test("Start from your expenses: short only in a lean month says so, with the full month to the nearest $10 (review 2026-11-02, round 5)", async () => {
  const { render } = await import("./view.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-02";
  // the family's $600 of photography counted at $0, no envelopes and no bank file; spending set so a full month leaves `left`
  const at = (left, countOn = 0) => {
    const p = familyPlan(D); p.budgets = []; p.transactions = [];
    const x = p.income.find((y) => y.id === "i-side"); if (countOn !== null) x.countOn = countOn;
    const s = next(p, { today: D }).spare;
    p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false });
    return p;
  };
  const text = (p) => drawText(render, p, (key, params) => (key === "overview/next-best-action" ? next(p, params) : null), D);
  const lean = at(297), s = next(lean, { today: D }).spare;
  assert.ok(s.monthly < 0 && s.held > 0.5);
  assert.match(text(lean), new RegExp(`In a lean month, these, tax and your saving come to about \\${fmt.money(-s.monthly)} more than comes in, counting uneven pay at what you can count on: the same gap as the Dashboard\\. A month that brings the Income page's amount leaves about \\$300\\.`));
  assert.match(text(at(-120)), /Even a month that brings the Income page's amount is about \$120 short\./);
  // nothing held back: the plain sentence
  const plain = at(-100, null);
  assert.match(text(plain), /These, tax and your saving come to about \$100 a month more than comes in: the same gap as the Dashboard\./);
  assert.doesNotMatch(text(plain), /lean month/);
});

test("Start from your expenses: a full month within $5 of $0 'only just about breaks even', never 'about $0' (review 2026-11-02, round 5)", async () => {
  const { render } = await import("./view.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-02";
  const at = (left) => {
    const p = familyPlan(D); p.budgets = []; p.transactions = [];
    p.income.find((y) => y.id === "i-side").countOn = 0;
    const s = next(p, { today: D }).spare;
    p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false });
    return p;
  };
  for (const left of [3, -2]) {
    const p = at(left);
    const text = drawText(render, p, (key, params) => (key === "overview/next-best-action" ? next(p, params) : null), D);
    assert.match(text, /Even a month that brings the Income page's amount only just about breaks even\./);
    assert.doesNotMatch(text, /about \$0\b/);
  }
});
