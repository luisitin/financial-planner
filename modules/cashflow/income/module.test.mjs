import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.monthly, 0); assert.equal(d.yearly, 0); assert.deepEqual(d.byPerson, []);
});
test("pay periods are normalised: 2,000 every two weeks is 52,000 a year, 4,333.33 a month", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self" });
  p.income.push({ id: "i1", name: "Ana's pay", type: "salary", personId: "a", amount: 2000, period: "biweekly", growth: 0.03, taxable: true });
  const d = compute(p, { today: TODAY });
  assert.equal(d.yearly, 52000);
  near(d.monthly, 4333.33);
  near(d.nextYear, 53560);
  assert.equal(d.items[0].personName, "Ana");
  assert.equal(d.byPerson[0].name, "Ana");
  assert.equal(d.taxableYearly, 52000);
  assert.equal(d.untaxedYearly, 0);
});
test("start and end dates decide what counts today; one-offs stay out of the monthly total", () => {
  const p = emptyPlan();
  p.income.push(
    { id: "i1", name: "Job", type: "salary", amount: 5000, period: "monthly" },
    { id: "i2", name: "New job", type: "salary", amount: 6000, period: "monthly", startDate: "2027-01-01" },
    { id: "i3", name: "Old gig", type: "business", amount: 1000, period: "monthly", endDate: "2026-06-30" },
    { id: "i4", name: "Tax refund", type: "other", amount: 1500, period: "once", taxable: false },
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.monthly, 5000);
  assert.equal(d.active.length, 2, "job and the one-off");
  assert.equal(d.items[1].upcoming, true);
  assert.equal(d.items[2].ended, true);
  assert.equal(d.oneTime, 1500);
  assert.equal(d.untaxedYearly, 0, "a one-off has no yearly amount");
  assert.equal(d.items[0].personName, "Household");
});
test("warnings: no amount, ends before it starts, growth typed as 300", () => {
  const p = emptyPlan();
  p.income.push({ id: "i1", name: "Nothing", type: "other", amount: 0, period: "monthly" }, { id: "i2", name: "Backwards", type: "other", amount: 1, period: "monthly", startDate: "2026-02-01", endDate: "2026-01-01" }, { id: "i3", name: "Rocket", type: "salary", amount: 1, period: "monthly", growth: 3 });
  const w = compute(p, { today: TODAY }).warnings;
  assert.ok(w.some((x) => x.includes("no amount")));
  assert.ok(w.some((x) => x.includes("ends before")));
  assert.ok(w.some((x) => x.includes("Raises are usually")));
});
test("byType sums yearly amounts per kind", () => {
  const p = emptyPlan();
  p.income.push({ id: "1", name: "a", type: "salary", amount: 100, period: "monthly" }, { id: "2", name: "b", type: "salary", amount: 100, period: "monthly" }, { id: "3", name: "c", type: "rental", amount: 1200, period: "annual" });
  assert.deepEqual(compute(p).byType, { salary: 2400, rental: 1200 });
});
