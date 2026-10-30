import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, payDown, HIGH, DEFAULTS } from "./compute.js";
import { pmt } from "../../../core/math/finance.js";
import { payoffPlan } from "../../../core/math/payoff.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("payDown: a 0% stretch then the rate; never when the payment does not cover the interest", () => {
  assert.deepEqual(payDown(1200, 0.24, 100, { freeMonths: 12 }), { months: 12, interest: 0 });
  const p = payDown(1000, 0.12, 100);
  assert.equal(p.months, 11); assert.ok(p.interest > 50 && p.interest < 60);
  assert.equal(payDown(10000, 0.24, 100).months, Infinity);
});

test("no debts: nothing to roll together", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family: only the card is worth consolidating by default; each offer by hand", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.deepEqual(d.debts.map((x) => x.id), ["a-visa"], "the 5.9% car loan stays out");
  assert.equal(d.candidates.length, 2); assert.ok(HIGH === 0.10);
  const o = Object.fromEntries(d.options.map((x) => [x.id, x]));
  const now = payoffPlan([{ id: "a-visa", balance: 6400, rate: 0.239, minPayment: 400 }]);
  assert.equal(o.now.months, now.months); near(o.now.interest, now.totalInterest);
  const loan = 6400 / (1 - DEFAULTS.loanFee);
  near(o.loan.monthly, pmt(0.12 / 12, 36, loan)); near(o.loan.fees, loan - 6400); near(o.loan.interest, o.loan.monthly * 36 - loan);
  near(o.transfer.fees, 6400 * 0.04); assert.equal(o.transfer.interest, 0); assert.equal(o.transfer.risk, null);
  near(o.heloc.monthly, pmt(0.085 / 12, 60, 6400)); assert.ok(o.heloc.risk);
  assert.equal(d.best, "transfer");
});

test("chosen debts; a transfer that outlasts the free months is flagged", () => {
  const p = familyPlan(TODAY); p.whatIfs = { consolidation: { include: ["a-visa", "a-car"], btMonths: 6 } };
  const d = compute(p, { today: TODAY });
  assert.equal(d.debts.length, 2); assert.equal(d.owed, 20600);
  assert.match(d.options.find((x) => x.id === "transfer").risk, /not paid off in the 6 interest-free months/);
});
