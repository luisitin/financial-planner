import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, suggestedMonths } from "./compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { solveMonths } from "../house/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the months to aim for: 3 with two earners, 6 with one, 3 more for pay that varies, at most 12", () => {
  assert.equal(suggestedMonths({ earners: 2, variable: false }).months, 3);
  assert.equal(suggestedMonths({ earners: 1, variable: false }).months, 6);
  assert.equal(suggestedMonths({ earners: 0, variable: false }).months, 6);
  assert.equal(suggestedMonths({ earners: 1, variable: true }).months, 9);
  assert.equal(suggestedMonths({ earners: 2, variable: true, dependants: true }).reasons.length, 2);
});

test("an empty plan: no must-pay bills, no target", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.essentialMonthly, 0); assert.equal(d.target, 0);
});

test("the family: the cushion against six months, the emergency goal's pace, and the warning about the goal", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  const liq = computeLiquidity(familyPlan(TODAY), { today: TODAY });
  near(d.now, liq.now); near(d.target, liq.target); assert.equal(d.months, 6);
  assert.equal(d.suggested.months, 6, "two salaries, and the weekend photography business");
  assert.equal(d.goal.id, "g-ef"); assert.equal(d.monthly, 400);
  assert.equal(d.monthsToGo, solveMonths(0.02 / 12, d.now, 400, d.target));
  assert.match(d.warnings[0], /kept apart/);
});

test("F-034: a goal ticked as the emergency fund counts as the cushion, here and on the Emergency fund page", () => {
  const p = familyPlan(TODAY); p.goals.find((g) => g.id === "g-ef").isEmergencyFund = true;
  const before = computeLiquidity(familyPlan(TODAY), { today: TODAY }), after = computeLiquidity(p, { today: TODAY });
  assert.ok(after.now > before.now); assert.equal(after.earmarked, 0); assert.equal(after.now, 4200 + 11500);
  const d = compute(p, { today: TODAY });
  assert.equal(d.goal.isEmergencyFund, true); assert.deepEqual(d.warnings, []);
});

test("cash in checking beyond a month of spending, and what it would earn in savings", () => {
  const p = familyPlan(TODAY); p.accounts.find((a) => a.id === "a-chk").balance = 12000;
  const d = compute(p, { today: TODAY });
  near(d.checking.spare, 12000 - d.checking.oneMonth); near(d.spareInterest, d.checking.spare * 0.02);
});
