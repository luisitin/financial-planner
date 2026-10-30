import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, DEFAULTS, RULE } from "./compute.js";
import { pmt, pmtToReach, fv } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("no car goal and nothing entered: the example figures", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.inputs.price, DEFAULTS.price); near(d.net, 30000 * 1.06); assert.equal(d.goal, null);
});

test("Bo's car from its goal: cash a month, saved by the date, the loan for the rest", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.goal.id, "g-car"); assert.equal(d.inputs.date, "2029-03-01"); assert.equal(d.monthsToDate, 28);
  near(d.net, d.inputs.price * 1.06);
  const r = 0.02 / 12;
  near(d.cash.neededMonthly, pmtToReach(r, 28, d.net, 3500), 1e-6);
  near(d.savedByDate, fv(r, 28, 300, 3500), 1e-6);
  near(d.finance.loan, d.net - d.savedByDate, 1e-6);
  near(d.finance.payment, pmt(0.07 / 12, 60, d.finance.loan), 1e-6);
  near(d.finance.totalInterest, d.finance.payment * 60 - d.finance.loan, 1e-6);
  assert.equal(d.verdict, "finance");
});

test("the 20/4/10 checks", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.rule.downOk, d.rule.downShare >= RULE.down); assert.equal(d.rule.termOk, false, "60 months is over 48");
  near(d.rule.share, d.rule.carCostsMonthly / 14250);
  const p = familyPlan(TODAY); p.whatIfs = { vehicle: { price: 20000, saved: 30000, termMonths: 36 } };
  const cash = compute(p, { today: TODAY });
  assert.equal(cash.finance.loan, 0); assert.equal(cash.verdict, "cash"); assert.equal(cash.rule.termOk, true);
  p.whatIfs.vehicle = { price: 60000, saved: 0, monthly: 0, termMonths: 84 };
  assert.match(compute(p, { today: TODAY }).warnings[0], /six years/);
});
