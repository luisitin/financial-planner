import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

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
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "paid", "the mortgage on the 1st");
  p.budgets.find((b) => b.id === "b3").amount = 2000;   // 1,500 of 2,000 is 75%: still fast on the 2nd
  d = compute(p, { today: "2026-09-02" });
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "ahead");
  p.budgets.find((b) => b.id === "b3").amount = 1500;
  p.transactions.push(tx("12", "2026-09-02", -100, "housing"));   // two payments, 1,600 of 1,500: over
  d = compute(p, { today: "2026-09-02" });
  assert.equal(d.envelopes.find((e) => e.category === "housing").pace, "over");
});
