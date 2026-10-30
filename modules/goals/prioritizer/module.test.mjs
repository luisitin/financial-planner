import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { compute as computeGoals } from "../goals/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withAvailable = (n) => { const p = familyPlan(TODAY); p.whatIfs = { prioritizer: { available: n } }; return p; };

test("no goals: nothing to share", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).count, 0);
});

test("the family: must-haves first, then by date; everyone on time with money to spare", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.deepEqual(d.rows.map((r) => r.name), ["Emergency fund", "Replace Bo's car", "Cy's college", "Japan trip"]);
  const needs = Object.fromEntries(computeGoals(familyPlan(TODAY), { today: TODAY }).goals.map((g) => [g.id, g.neededMonthly]));
  for (const r of d.rows) { near(r.needed, needs[r.id]); near(r.allocated, r.needed); assert.equal(r.onTime, true); assert.equal(r.slipMonths, 0); }
  near(d.leftover, d.available - d.neededTotal); assert.equal(d.short, 0); assert.equal(d.override, null);
});

test("too little: the order decides who waits, and how long", () => {
  const d = compute(withAvailable(1500), { today: TODAY });
  const [ef, car, col, trip] = d.rows;
  near(ef.allocated, ef.needed); assert.equal(ef.onTime, true);
  near(car.allocated, 1500 - ef.needed); assert.equal(car.onTime, false); assert.ok(car.slipMonths > 0);
  assert.equal(col.allocated, 0); assert.equal(trip.allocated, 0);
  near(d.short, d.neededTotal - 1500); assert.equal(d.override, 1500); assert.equal(d.leftover, 0);
});

test("an undated goal gets what is left, up to a year's worth", () => {
  const p = withAvailable(10000); p.goals.push({ id: "g-x", name: "New sofa", target: 2400, targetDate: "", priority: 3, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false });
  const d = compute(p, { today: TODAY });
  const sofa = d.rows.find((r) => r.id === "g-x");
  assert.equal(sofa.noDate, true); near(sofa.allocated, 200); assert.equal(sofa.onTime, null);
});
