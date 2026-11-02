// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("withdrawal-strategy: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("firstYear: how much comes out of savings in the first year of retirement, from where, and what it pays for", async () => {
  const { firstYear } = await import("./compute.js");
  const { compute: projection } = await import("../projection/compute.js");
  const today = "2026-11-02";
  const plan = retirementPlan();
  const fy = firstYear(plan, { today });
  const p = projection(plan, { today });
  const r = p.rows.find((x) => x.retired);
  assert.equal(fy.year, r.year); assert.equal(fy.thisYear, false);
  const real = (n) => n / r.priceLevel;
  const out = Object.values(r.withdrawn).reduce((t, x) => t + x, 0);
  assert.ok(Math.abs(fy.fromSavings - real(out)) < 0.01, "everything taken out that year");
  assert.ok(Math.abs(fy.need - Math.max(0, r.spendingReal + real(r.eventOut) + real(r.taxes) - r.incomeReal)) < 0.01, "spending + one-offs + tax - guaranteed income");
  assert.ok(Math.abs(fy.extra - Math.max(0, fy.fromSavings - fy.need)) < 0.01);
  // in the engine's order: cash first, then the plan's withdrawal order; each with its accounts' names
  const order = ["cash", "taxable", "deferred", "free"];
  assert.deepEqual(fy.buckets.map((b) => b.bucket), order.filter((b) => r.withdrawn[b] > 0.5));
  if (fy.buckets[0]?.bucket === "cash") assert.deepEqual(fy.buckets[0].accounts, ["Checking", "Savings"]);
  assert.ok(Math.abs(fy.affordable - p.affordable) < 0.01);
  // a retired couple whose income covers the spending: only the required withdrawal comes out, and it is all extra
  const old = retirementPlan();
  old.household.people[0].birthDate = "1950-03-10"; old.household.people[0].retirementAge = 62;
  old.household.people[1].birthDate = "1951-06-20"; old.household.people[1].retirementAge = 62;
  old.income = [{ id: "ss", name: "Sam's Social Security", type: "social", personId: "sam", amount: 6000, period: "monthly" }, { id: "pen", name: "Lee's pension", type: "pension", personId: "lee", amount: 2000, period: "monthly" }];
  old.retirement.contributions = []; old.retirement.pensions = []; old.retirement.socialSecurity = {};
  old.retirement.spendingMonthly = 4000;
  const o = firstYear(old, { today });
  assert.equal(o.year, 2026); assert.equal(o.thisYear, true);
  assert.ok(o.need < 0.5, "income covers the spending");
  assert.ok(o.required > 1000 && Math.abs(o.fromSavings - o.required) < 0.01, "the required withdrawal is all that comes out");
  assert.deepEqual(o.sources, ["Social Security", "pension"]);
  // not ready: null
  assert.equal(firstYear(emptyPlan(), { today }), null);
});
