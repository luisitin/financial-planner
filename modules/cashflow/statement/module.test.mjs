import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, yearOfPayments, matchPayments } from "./compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("yearOfPayments: interest and principal by hand; it stops once paid off", () => {
  const r = yearOfPayments(1000, 0.12, 100);
  let b = 1000, i = 0, paid = 0;
  for (let m = 0; m < 12 && b > 0.005; m++) { const x = b * 0.01, pay = Math.min(100, b + x); i += x; paid += pay; b = b + x - pay; }
  near(r.interest, i); near(r.paid, paid); near(r.principal, 1000);
  assert.ok(r.paid < 1200, "the last payment is short and then they stop");
  assert.deepEqual(yearOfPayments(500, 0.1, 0), { paid: 0, interest: 0, principal: 0 });
});

test("matchPayments: one expense per debt, by its monthly amount, within a dollar", () => {
  const ex = [{ id: "e1", monthly: 1980 }, { id: "e2", monthly: 410.4 }, { id: "e3", monthly: 410 }];
  const m = matchPayments(ex, [{ id: "d1", payment: 1980 }, { id: "d2", payment: 410, minPayment: 410 }, { id: "d3", payment: 999 }]);
  assert.equal(m.get("d1").id, "e1"); assert.equal(m.get("d2").id, "e2"); assert.ok(!m.has("d3"));
});

test("nothing entered: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family's year: living, investing and debts add up to the cash left", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const y = d.year, s = computeNext(p, { today: TODAY }).spare;
  const exp = computeExpenses(p, { today: TODAY });
  assert.deepEqual(y.matched, ["Mortgage payment", "Car payment"]);
  const living = y.operating.lines.find((l) => l.label === "Living costs").amount;
  near(living, -(exp.monthly * 12 - (1980 + 410) * 12));
  near(y.operating.lines.find((l) => l.label === "Federal income tax").amount, -s.federalTax * 12);
  near(y.operating.total, s.gross * 12 - s.federalTax * 12 - s.payrollTax * 12 + living);
  near(y.investing.total, -s.retirementSaving * 12); assert.equal(y.investing.match, 3050);
  // a year of payments on the mortgage, the car and the card
  const pay = [yearOfPayments(265000, 0.0625, 1980), yearOfPayments(14200, 0.059, 410), yearOfPayments(6400, 0.239, 400)];
  near(y.financing.total, -pay.reduce((t, x) => t + x.paid, 0));
  near(y.principal, pay.reduce((t, x) => t + x.principal, 0));
  near(y.net, y.operating.total + y.investing.total + y.financing.total);
  near(y.goals, s.goalSaving * 12);
  assert.equal(d.actual, null, "no bank files");
});

test("a state's income tax is a line of its own", () => {
  const p = familyPlan(TODAY); p.household.state = "PA";
  const line = compute(p, { today: TODAY }).year.operating.lines.find((l) => l.label === "Pennsylvania income tax");
  assert.ok(line && line.amount < 0);
});

test("a debt-category expense that matches no debt is an other loan payment, not living", () => {
  const p = familyPlan(TODAY);
  p.expenses.push({ id: "e-x", name: "Loan from Mom", category: "debt", amount: 150, period: "monthly" });
  const y = compute(p, { today: TODAY }).year;
  near(y.financing.lines.find((l) => l.label === "Other loan payments").amount, -1800);
  const base = compute(familyPlan(TODAY), { today: TODAY }).year;
  near(y.operating.lines.find((l) => l.label === "Living costs").amount, base.operating.lines.find((l) => l.label === "Living costs").amount);
});

test("the bank files: the last complete months, transfers out, debt payments apart", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 1000 }, { id: "sav", name: "Savings", type: "savings", balance: 500 });
  const t = (id, accountId, date, amount, category, extra = {}) => ({ id, accountId, date, amount, payee: id, category, ...extra });
  p.transactions.push(
    t("a", "chk", "2026-08-01", 3000, "income-salary"), t("b", "chk", "2026-08-03", -1200, "housing"), t("c", "chk", "2026-08-09", -300, "debt"),
    t("d", "chk", "2026-09-01", 3000, "income-salary"), t("e", "chk", "2026-09-04", -900, "groceries"),
    t("f", "chk", "2026-09-06", -500, "transfer", { transferId: "x" }), t("g", "sav", "2026-09-06", 500, "transfer", { transferId: "x" }),
    t("h", "chk", "2026-10-02", 3000, "income-salary"),   // this month: not complete, left out
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.year, null);
  const a = d.actual;
  assert.equal(a.months, 2); assert.equal(a.from, "2026-08"); assert.equal(a.to, "2026-09");
  assert.equal(a.operating.in, 6000); assert.equal(a.operating.out, -2100); assert.equal(a.financing.total, -300);
  assert.equal(a.net, 6000 - 2100 - 300);
});
