import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, monthlyCost, priceFor, solveMonths, DEFAULTS, FRONT, BACK } from "./compute.js";
import { pmt, pmtToReach } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withHouse = (h, goals) => { const p = familyPlan(TODAY); p.whatIfs = { house: h }; if (goals) p.goals = goals; return p; };

test("the monthly cost and the price a budget buys are inverses", () => {
  const x = { ...DEFAULTS };
  near(monthlyCost(400000, x), pmt(0.065 / 12, 360, 320000) + 400000 * (0.011 + 0.0035) / 12);
  near(monthlyCost(priceFor(3000, x), x), 3000, 1e-6);
  near(monthlyCost(priceFor(3000, { ...x, hoaMonthly: 200 }), { ...x, hoaMonthly: 200 }), 3000, 1e-6);
});

test("months to save: deposits plus growth, none needed when already there, never without saving", () => {
  assert.equal(solveMonths(0, 0, 100, 1000), 10); assert.equal(solveMonths(0.01, 5000, 0, 1000), 0); assert.equal(solveMonths(0, 0, 0, 1000), Infinity);
});

test("the family: the lenders' limits on their income and other debts, the cash needed, the monthly to buy by a date", () => {
  const d = compute(withHouse({ price: 450000, targetDate: "2029-06-01" }), { today: TODAY });
  assert.equal(d.grossMonthly, 14250); near(d.maxFront, 14250 * FRONT);
  assert.equal(d.otherDebtMonthly, 400 + 410, "the card and the car, not the mortgage");
  near(d.maxBack, 14250 * BACK - 810); assert.equal(d.rule, "front");
  near(monthlyCost(d.maxPrice, d.inputs), d.maxFront, 1e-6);
  near(d.cash.down, 90000); near(d.cash.closing, 13500); near(d.cash.reserves, d.monthly * 2);
  near(d.neededMonthly, pmtToReach(0.02 / 12, 31, d.cash.total, 0), 1e-6);
  assert.equal(d.monthsToGo, null);
});

test("a house goal on Goals supplies what is set aside and saved; entered figures win; warnings", () => {
  const goals = [{ id: "g", name: "New home fund", target: 100000, targetDate: "2030-01-01", saved: 20000, monthly: 2000, priority: 2, fundedBy: [] }];
  const d = compute(withHouse({ price: 400000 }, goals), { today: TODAY });
  assert.equal(d.goal.id, "g"); assert.equal(d.saved, 20000); assert.equal(d.monthlySaving, 2000); assert.equal(d.target, "2030-01-01");
  assert.equal(d.monthsToGo, solveMonths(0.02 / 12, 20000, 2000, d.cash.total));
  assert.ok(/^\d{4}-\d{2}$/.test(d.readyDate));
  const e = compute(withHouse({ price: 400000, saved: 200000 }, goals), { today: TODAY });
  assert.equal(e.monthsToGo, 0);
  const w = compute(withHouse({ price: 2000000, downShare: 0.1 }), { today: TODAY });
  assert.equal(w.warnings.length, 2);
  assert.equal(compute(emptyPlan(), { today: TODAY }).maxPrice, null);
});
