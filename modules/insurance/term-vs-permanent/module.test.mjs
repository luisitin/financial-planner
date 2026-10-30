import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, scenarioOf, planReturn, TAX_DRAG, DEFAULT_TERM_YEARS } from "./compute.js";
import { fv } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const QUOTE = { deathBenefit: 500000, wholePremium: 6200, termPremium: 420, termYears: 20, cashValue: 150000, cashValueGuaranteed: 112000, taxed: true, returnRate: null };
const planWith = (compare, policies = []) => { const p = familyPlan("2026-10-30"); p.insurance = { policies, compare }; return p; };

test("nothing entered: what is missing", () => {
  const d = compute(emptyPlan());
  assert.equal(d.ready, false); assert.equal(d.missing.length, 4); assert.equal(d.scenario.termYears, DEFAULT_TERM_YEARS);
});

test("the default return: the plan's mix now, less the tax drag in an ordinary account", () => {
  const p = planWith(QUOTE);
  const mix = 0.7 * p.assumptions.returnStocks + 0.3 * p.assumptions.returnBonds;
  near(planReturn(p), (p.retirement.stocksNow ?? 0.7) * p.assumptions.returnStocks + (1 - (p.retirement.stocksNow ?? 0.7)) * p.assumptions.returnBonds);
  near(scenarioOf(p).returnRate, planReturn(p) - TAX_DRAG);
  near(scenarioOf(planWith({ ...QUOTE, taxed: false })).returnRate, planReturn(p));
  near(scenarioOf(planWith({ ...QUOTE, returnRate: 0.04 })).returnRate, 0.04);
  assert.ok(mix > 0);
});

test("a whole-life policy on file fills in the death benefit and the premium", () => {
  const s = scenarioOf(planWith({}, [{ id: "w", kind: "whole", benefit: 100000, premium: 100, period: "monthly" }]));
  assert.equal(s.deathBenefit, 100000); assert.equal(s.wholePremium, 1200); assert.equal(s.fromPolicy, true);
});

test("term and invest against the illustration: the side fund, the breakeven return, whole life's own return", () => {
  const d = compute(planWith({ ...QUOTE, returnRate: 0.056 }));
  assert.equal(d.ready, true); assert.equal(d.difference, 5780);
  near(d.atEnd.sideFund, fv(0.056, 20, 5780, 0, true));
  near(fv(d.breakeven, 20, 5780, 0, true), 150000, 1e-4);
  near(fv(d.breakevenGuaranteed, 20, 5780, 0, true), 112000, 1e-4);
  assert.ok(d.breakevenGuaranteed < 0, "the guaranteed values lose money on the difference");
  near(fv(d.wholeReturn, 20, 6200, 0, true), 150000, 1e-4);
  assert.equal(d.verdict, "term");
  assert.equal(d.rows.length, 20); near(d.rows[0].deathTerm, 500000 + 5780 * 1.056); assert.equal(d.rows[19].deathWhole, 500000);
});

test("the verdict follows the return against the breakeven", () => {
  const be = compute(planWith(QUOTE)).breakeven;
  assert.equal(compute(planWith({ ...QUOTE, returnRate: be - 0.01 })).verdict, "whole");
  assert.equal(compute(planWith({ ...QUOTE, returnRate: be + 0.001 })).verdict, "close");
});

test("a term premium at or above the whole-life premium is not a comparison", () => {
  const d = compute(planWith({ ...QUOTE, termPremium: 7000 }));
  assert.equal(d.ready, false); assert.match(d.missing[0], /term premium below/);
});
