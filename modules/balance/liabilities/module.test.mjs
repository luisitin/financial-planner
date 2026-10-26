import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { nper, pmt } from "../../../core/math/finance.js";

const TODAY = "2026-09-15";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("empty plan and a plan with only assets: no debts", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).count, 0);
  const p = emptyPlan(); p.accounts.push({ id: "a", name: "Checking", type: "checking", balance: 100 });
  assert.equal(compute(p, { today: TODAY }).count, 0);
});
test("a card without detail is listed as needing details; totals still count what is owed", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Visa", type: "credit", balance: 4000 });
  const d = compute(p, { today: TODAY });
  assert.equal(d.count, 1); assert.equal(d.withDetail, 0); assert.equal(d.owed, 4000);
  assert.equal(d.rows[0].rate, null); assert.equal(d.rows[0].months, null); assert.equal(d.avgRate, null);
});
test("payoff months match nper; payoff date; expensive flag; weighted average rate; DTI", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Visa", type: "credit", balance: 4000 }, { id: "m", name: "Mortgage", type: "mortgage", balance: 200000 });
  const mortgagePayment = pmt(0.06 / 12, 360, 200000);   // 1199.10...
  p.debts.push({ id: "d1", accountId: "c", rate: 0.229, minPayment: 100, extra: 100 }, { id: "d2", accountId: "m", rate: 0.06, minPayment: mortgagePayment, extra: 0, termMonths: 360 });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 6000, period: "monthly" });
  const d = compute(p, { today: TODAY });
  const visa = d.rows.find((r) => r.name === "Visa"), mort = d.rows.find((r) => r.name === "Mortgage");
  assert.equal(d.rows[0].name, "Visa", "highest rate first");
  assert.equal(visa.months, Math.ceil(nper(0.229 / 12, 200, 4000) - 1e-9));
  assert.equal(visa.payoffDate.slice(0, 4), String(2026 + Math.floor((8 + visa.months) / 12)));
  assert.equal(visa.expensive, true);
  near(visa.interestMonthly, 4000 * 0.229 / 12);
  assert.ok(visa.totalInterest > 0 && visa.totalInterest < 4000);
  assert.equal(mort.expensive, false);
  assert.equal(mort.months, 360, "the 30-year payment pays off in exactly 360 months");
  near(d.avgRate, (0.229 * 4000 + 0.06 * 200000) / 204000);
  near(d.payments, 200 + mortgagePayment);
  near(d.dti, (200 + mortgagePayment) / 6000);
  assert.ok(d.warnings.some((w) => w.includes("Visa costs")));
});
test("a payment below the interest never pays off; zero balance is paid off", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Card", type: "credit", balance: 10000 }, { id: "z", name: "Old loan", type: "loan", balance: 0 });
  p.debts.push({ id: "d", accountId: "c", rate: 0.24, minPayment: 100 }, { id: "d2", accountId: "z", rate: 0.05, minPayment: 50 });
  const d = compute(p, { today: TODAY });
  assert.equal(d.rows.find((r) => r.name === "Card").neverPaysOff, true);
  assert.equal(d.rows.find((r) => r.name === "Old loan").months, 0);
  assert.ok(d.warnings.some((w) => w.includes("never pays off")));
});
