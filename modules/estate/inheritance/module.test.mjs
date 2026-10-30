import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, netOf, KINDS, LATER_YEARS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const withItems = (items) => { const p = familyPlan(TODAY); p.estate.inheritance = { items }; return p; };

test("what arrives: cash and Roth whole, an IRA less income tax, a house less selling costs", () => {
  assert.equal(netOf({ amount: 100000, kind: "cash" }, 0.15), 100000);
  assert.equal(netOf({ amount: 100000, kind: "roth" }, 0.15), 100000);
  assert.equal(netOf({ amount: 100000, kind: "ira" }, 0.15), 85000);
  assert.ok(Math.abs(netOf({ amount: 100000, kind: "home" }, 0.15) - 94000) < 1e-9);
  assert.equal(netOf({ amount: 100000, kind: "nonsense" }, 0.15), 100000);
  assert.equal(Object.keys(KINDS).length, 4);
});

test("nothing expected: the plan alone", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.withIt, null); assert.equal(d.extraMonthly, 0);
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("an inheritance: more left at the end, more to spend; half as much and later in between", () => {
  const d = compute(withItems([{ id: "a", from: "Parents", amount: 120000, year: 2044, kind: "ira" }, { id: "b", from: "Parents", amount: 260000, year: 2048, kind: "home" }]), { today: TODAY });
  assert.equal(d.total, 380000); assert.ok(Math.abs(d.net - (120000 * (1 - d.taxRate) + 260000 * 0.94)) < 1e-6);
  assert.ok(d.withIt.endReal > d.base.endReal); assert.ok(d.extraMonthly > 0);
  assert.ok(d.half.affordableMonthly > d.base.affordableMonthly && d.half.affordableMonthly < d.withIt.affordableMonthly);
  assert.ok(d.later.affordableMonthly < d.withIt.affordableMonthly);
  assert.equal(LATER_YEARS, 10);
});

test("a year in the past or missing counts from this year; the plan itself is untouched", () => {
  const p = withItems([{ id: "a", amount: 50000, year: 1999, kind: "cash" }, { id: "b", amount: 1, kind: "cash" }]);
  const d = compute(p, { today: TODAY });
  assert.equal(d.items[0].year, 2026); assert.equal(d.items[1].year, 2026);
  assert.deepEqual(p.estate.inheritance.items[0].year, 1999);
});
