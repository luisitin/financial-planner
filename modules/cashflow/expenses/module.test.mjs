import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, CATEGORIES } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.monthly, 0); assert.equal(d.income, null); assert.equal(d.leftOver, null); assert.deepEqual(d.byCategory, []);
});
test("monthly totals, must-pay split, category shares", () => {
  const p = emptyPlan();
  p.expenses.push(
    { id: "e1", name: "Rent", category: "housing", amount: 1800, period: "monthly" },
    { id: "e2", name: "Groceries", category: "groceries", amount: 150, period: "weekly" },
    { id: "e3", name: "Netflix", category: "subscriptions", amount: 15, period: "monthly", inflates: false },
    { id: "e4", name: "Car insurance", category: "insurance", amount: 600, period: "quarterly", essential: false },
  );
  const d = compute(p, { today: TODAY });
  near(d.monthly, 1800 + 650 + 15 + 200);
  near(d.essentialMonthly, 1800 + 650);                 // insurance was overridden to not essential
  near(d.optionalMonthly, 215);
  near(d.inflatingMonthly, 1800 + 650 + 200);           // Netflix does not inflate
  assert.equal(d.byCategory[0].category, "housing");
  near(d.byCategory[0].share, 1800 / 2665);
  assert.equal(d.items[3].essential, false);
  assert.equal(d.items[0].essential, CATEGORIES.housing.essential);
});
test("compared with income: left over and savings rate; a shortfall warns", () => {
  const p = emptyPlan();
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  let d = compute(p, { today: TODAY });
  assert.equal(d.leftOver, 3000); assert.equal(d.savingsRate, 0.6); assert.deepEqual(d.warnings, []);
  p.expenses.push({ id: "e2", name: "Everything else", category: "other", amount: 4000, period: "monthly" });
  d = compute(p, { today: TODAY });
  assert.equal(d.leftOver, -1000);
  assert.ok(d.warnings.some((w) => w.includes("more each month than comes in")));
});
test("dates: upcoming and ended expenses are listed but not counted; one-offs are separate", () => {
  const p = emptyPlan();
  p.expenses.push(
    { id: "a", name: "Now", category: "other", amount: 100, period: "monthly" },
    { id: "b", name: "Later", category: "other", amount: 100, period: "monthly", startDate: "2027-01-01" },
    { id: "c", name: "Before", category: "other", amount: 100, period: "monthly", endDate: "2026-01-01" },
    { id: "d", name: "Vacation", category: "travel", amount: 3000, period: "once" },
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.monthly, 100); assert.equal(d.count, 4); assert.equal(d.active.length, 2); assert.equal(d.oneTime, 3000);
  assert.equal(d.items[1].upcoming, true); assert.equal(d.items[2].ended, true);
});
