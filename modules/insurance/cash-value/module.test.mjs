import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, DEFAULT_LATER_YEARS, DEFAULT_TAX_RATE } from "./compute.js";
import { planReturn, TAX_DRAG } from "../term-vs-permanent/compute.js";
import { fv } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const WHOLE = { id: "w", name: "Bo's whole life", kind: "whole", personId: "p-bo", benefit: 100000, premium: 1150, period: "annual", cashValue: 7400, yearsPaid: 8, surrenderValue: 6900, laterYears: 10, cashValueLater: 24500, termQuote: 180 };
const planWith = (policies) => { const p = familyPlan("2026-10-30"); p.insurance = { policies }; return p; };

test("no permanent policy: nothing to model", () => {
  assert.equal(compute(emptyPlan()).count, 0);
  assert.equal(compute(planWith([{ ...WHOLE, kind: "term" }])).count, 0);
});

test("the return so far, cashing in at a loss (no tax), the return from here", () => {
  const d = compute(planWith([WHOLE]));
  const x = d.items[0];
  assert.equal(x.basis, 1150 * 8); assert.equal(x.gain, 6900 - 9200); assert.equal(x.tax, 0); assert.equal(x.netCash, 6900);
  near(fv(x.pastReturn, 8, 1150, 0, true), 6900, 1e-4); assert.ok(x.pastReturn < 0);
  near(fv(x.keepReturn, 10, 1150, 6900, true), 24500, 1e-4);
  near(d.returnRate, planReturn(planWith([])) - TAX_DRAG);
});

test("keep or cash in: term for the same cover, the rest invested, against the illustration", () => {
  const d = compute(planWith([WHOLE]));
  const x = d.items[0];
  near(x.altValue, fv(d.returnRate, 10, 1150 - 180, 6900, true));
  near(fv(x.breakeven, 10, 970, 6900, true), 24500, 1e-4);
  assert.equal(x.verdict, d.returnRate > x.breakeven + 0.0025 ? "cash-in" : d.returnRate < x.breakeven - 0.0025 ? "keep" : "close");
  assert.equal(compute(planWith([{ ...WHOLE, cashValueLater: 40000 }])).items[0].verdict, "keep");
});

test("a gain on cashing in is taxed at the plan's rate", () => {
  const p = planWith([{ ...WHOLE, surrenderValue: 12000, basis: 9000 }]);
  p.retirement.taxRate = 0.24;
  const x = compute(p).items[0];
  near(x.tax, 3000 * 0.24); near(x.netCash, 12000 - 720);
  delete p.retirement.taxRate;
  near(compute(p).items[0].tax, 3000 * DEFAULT_TAX_RATE);
});

test("missing figures: what to ask for; the defaults", () => {
  const x = compute(planWith([{ id: "w", name: "Old policy", kind: "whole", benefit: 50000, premium: 80, period: "monthly", cashValue: 3000 }])).items[0];
  assert.equal(x.laterYears, DEFAULT_LATER_YEARS); assert.equal(x.surrender, 3000); assert.equal(x.pastReturn, null); assert.equal(x.verdict, null);
  assert.equal(x.missing.length, 3);
});
