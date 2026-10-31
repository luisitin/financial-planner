// tests/payoff.test.mjs -- core/math/payoff.js against hand-checked numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { payoffPlan, minimumOnly } from "../core/math/payoff.js";
import { nper } from "../core/math/finance.js";

const near = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const DEBTS = [
  { id: "visa", name: "Visa", balance: 4000, rate: 0.229, minPayment: 100 },
  { id: "car", name: "Car loan", balance: 14200, rate: 0.049, minPayment: 410 },
  { id: "store", name: "Store card", balance: 900, rate: 0.269, minPayment: 30 },
];

test("one debt, no extra: months agree with nper and interest adds up", () => {
  const r = payoffPlan([DEBTS[0]], { extra: 0 });
  assert.equal(r.months, Math.ceil(nper(0.229 / 12, 100, 4000) - 1e-9));
  near(r.totalPaid, 4000 + r.totalInterest, 0.05);
  assert.equal(r.debts[0].paidOff, r.months);
  assert.equal(r.timeline.length, r.months);
  assert.equal(r.timeline[r.months - 1].total, 0);
});
test("avalanche targets the highest rate, snowball the smallest balance; avalanche costs less interest", () => {
  const av = payoffPlan(DEBTS, { extra: 200, order: "avalanche" });
  const sn = payoffPlan(DEBTS, { extra: 200, order: "snowball" });
  assert.deepEqual(av.debts.map((d) => d.id), ["store", "visa", "car"]);
  assert.deepEqual(sn.debts.map((d) => d.id), ["store", "visa", "car"], "here the smallest balance is also the highest rate");
  const av2 = payoffPlan(DEBTS, { extra: 200, order: "avalanche", customOrder: [] });
  assert.ok(av.totalInterest <= sn.totalInterest + 0.01);
  assert.ok(av2.months === av.months);
  const cu = payoffPlan(DEBTS, { extra: 200, order: "custom", customOrder: ["car", "visa", "store"] });
  assert.deepEqual(cu.debts.map((d) => d.id), ["car", "visa", "store"]);
  assert.ok(cu.totalInterest > av.totalInterest, "paying the cheap car loan first costs more");
});
test("freed payments roll into the next debt; more extra means fewer months", () => {
  const a = payoffPlan(DEBTS, { extra: 0 }), b = payoffPlan(DEBTS, { extra: 300 });
  assert.ok(b.months < a.months);
  assert.ok(b.totalInterest < a.totalInterest);
  assert.equal(a.budget, 540); assert.equal(b.budget, 840);
  const last = b.timeline[b.timeline.length - 1];
  assert.equal(last.total, 0);
});
test("a payment that does not cover the interest never pays off", () => {
  const r = payoffPlan([{ id: "x", name: "Trap", balance: 10000, rate: 0.24, minPayment: 100 }], { extra: 0, maxMonths: 120 });
  assert.equal(r.months, Infinity);
  assert.deepEqual(r.neverPaysOff, ["x"]);
  const m = minimumOnly(10000, 0.24, 100);
  assert.equal(m.months, Infinity);
  const ok = minimumOnly(4000, 0.229, 100);
  assert.equal(ok.months, Math.ceil(nper(0.229 / 12, 100, 4000) - 1e-9));
  const pct = minimumOnly(4000, 0.229, 0, { percentOfBalance: 0.02, floor: 25 });
  assert.ok(pct.months > ok.months && Number.isFinite(pct.months), "2% of balance with a $25 floor takes far longer");
});
test("zero balances are skipped; empty input", () => {
  const r = payoffPlan([{ id: "z", name: "Done", balance: 0, rate: 0.1, minPayment: 50 }], { extra: 100 });
  assert.equal(r.months, 0); assert.deepEqual(r.debts, []); assert.equal(payoffPlan([]).months, 0);
});
test("minimum-only: 2% of the month's opening balance (Regulation Z appendix M2), never only when it cannot amortize", () => {
  const pct = { percentOfBalance: 0.02, floor: 25 };
  // $3,000 at 18%: month 1 pays 2% of $3,000 = $60 (not 2% of $3,045), month 2 2% of $3,030 = $60.60, ...
  const one = minimumOnly(3000, 0.18, 0, { ...pct, maxMonths: 1 });
  assert.equal(one.interest, 45);
  const a = minimumOnly(3000, 0.18, 0, pct);
  assert.deepEqual([a.months, a.interest], [268, 6327.77]);   // tools/golden_debt cc-edge-001 (RULES.md example 2)
  // 2% of the balance at 30% (2.5% a month) never catches the interest: never, from the first month
  assert.equal(minimumOnly(2000, 0.30, 0, pct).months, Infinity);
  // 23.99% (1.999% a month): 2% barely beats the interest; paid off in month 1,350, not "never" at 100 years
  const slow = minimumOnly(1260, 0.2399, 0, pct);
  assert.deepEqual([slow.months, slow.interest], [1350, 32570.08]);   // cc-edge-009
});
