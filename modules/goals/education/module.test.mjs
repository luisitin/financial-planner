import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, COSTS, DEFAULT_GROWTH } from "./compute.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";
import { pmtToReach, fv } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the published prices", () => {
  assert.equal(COSTS.public.yearly, 25850); assert.equal(COSTS.private.yearly, 60920);
});

test("no children: nothing to plan", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).children.length, 0);
});

test("Cy: four public years from 2038, rising 4% a year; the college goal supplies what is set aside", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const c = d.children[0];
  assert.equal(c.startYear, 2038); assert.equal(c.years, 4); assert.equal(c.yearlyNow, 25850);
  for (const [i, x] of c.costs.entries()) near(x.cost, 25850 * Math.pow(1 + DEFAULT_GROWTH, 2038 + i - 2026));
  near(c.total, c.costs.reduce((s, x) => s + x.cost, 0));
  const r = planReturn(p);
  near(c.atStart, c.costs.reduce((s, x, i) => s + x.cost / Math.pow(1 + r, i), 0));
  assert.equal(c.goal.id, "g-col"); assert.equal(c.monthly, 250);
  near(c.neededMonthly, pmtToReach(r / 12, c.monthsLeft, c.atStart, c.saved), 1e-6);
  near(c.coveredShare, fv(r / 12, c.monthsLeft, 250, c.saved) / c.atStart, 1e-9);
});

test("per child: private, half covered, five years, a custom cost; 529 accounts when there is no goal", () => {
  const p = familyPlan(TODAY);
  p.goals = p.goals.filter((g) => g.id !== "g-col");
  p.accounts.push({ id: "c529", name: "Cy 529", type: "529", balance: 12000 });
  p.whatIfs = { college: { "p-cy": { type: "private", share: 0.5, years: 5 }, growth: 0.05 } };
  const c = compute(p, { today: TODAY }).children[0];
  assert.equal(c.type, "private"); assert.equal(c.costs.length, 5); assert.equal(c.share, 0.5); assert.equal(c.saved, 12000); assert.equal(c.goal, null);
  near(c.costs[0].cost, 60920 * Math.pow(1.05, 12));
  p.whatIfs.college["p-cy"] = { type: "custom", yearly: 10000 };
  assert.equal(compute(p, { today: TODAY }).children[0].yearlyNow, 10000);
});
