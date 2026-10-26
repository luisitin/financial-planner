import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, plannedDates } from "./compute.js";
import { recurringPlan } from "../recurring/module.test.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);

test("plannedDates: monthly bills on the 1st, pay on the 15th, start dates respected", () => {
  assert.deepEqual(plannedDates({ kind: "expense", period: "monthly" }, "2026-09-15", "2026-12-14"), ["2026-10-01", "2026-11-01", "2026-12-01"]);
  assert.deepEqual(plannedDates({ kind: "income", period: "monthly" }, "2026-09-15", "2026-11-20"), ["2026-09-15", "2026-10-15", "2026-11-15"]);
  assert.deepEqual(plannedDates({ kind: "expense", period: "monthly", startDate: "2026-09-20" }, "2026-09-15", "2026-11-25"), ["2026-09-20", "2026-10-20", "2026-11-20"]);
  assert.deepEqual(plannedDates({ kind: "expense", period: "monthly", startDate: "2026-08-20", endDate: "2026-10-01" }, "2026-09-15", "2026-11-25"), ["2026-09-20"]);
  assert.deepEqual(plannedDates({ kind: "expense", period: "once" }, "2026-09-15", "2026-11-25"), []);
  assert.deepEqual(plannedDates({ kind: "expense", period: "annual", startDate: "2027-09-01" }, "2026-09-15", "2026-12-14"), []);
});
test("no everyday account or no today: no data", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).hasData, false);
  assert.equal(compute(recurringPlan()).hasData, false);
});
test("90 days from the sample: found payments and typed bills, the lowest day, totals", () => {
  const p = recurringPlan();
  const d = compute(p, { today: TODAY, days: 90 });
  assert.equal(d.hasData, true); assert.equal(d.start, 4000); assert.equal(d.days.length, 91);
  assert.equal(d.days[0].date, TODAY); assert.equal(d.days[90].date, "2026-12-14");
  assert.equal(d.sources.found, 4, "Netflix, payroll, insurance, gym (missed) are on the checking account");
  assert.equal(d.sources.skipped, 1, "the typed 'Pay' (1950 every two weeks) is the found payroll; Rent is not covered");
  const rent = d.days.find((x) => x.date === "2026-10-01");
  assert.ok(rent.events.some((e) => e.name === "Rent" && e.amount === -1500), "typed rent lands on the 1st");
  const pay = d.days.find((x) => x.date === "2026-09-25");
  assert.ok(pay.events.some((e) => e.name === "Acme Corp Payroll" && e.amount === 1950), "found payroll every two weeks from the last one");
  const gym = d.days.find((x) => x.events.some((e) => e.name === "Gym Membership"));
  assert.ok(gym && gym.date >= TODAY, "a missed payment is expected again from its next date");
  near(d.income, 1950 * d.days.flatMap((x) => x.events).filter((e) => e.name === "Acme Corp Payroll").length);
  assert.ok(d.lowest.balance <= d.start);
  assert.equal(d.shortfallDate, null);
  near(d.end, d.start + d.income - d.spending);
});
test("a shortfall is dated", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 500 });
  p.expenses.push({ id: "r", name: "Rent", category: "housing", amount: 1500, period: "monthly" });
  const d = compute(p, { today: TODAY, days: 30 });
  assert.equal(d.shortfallDate, "2026-10-01"); assert.equal(d.lowest.balance, -1000);
});
