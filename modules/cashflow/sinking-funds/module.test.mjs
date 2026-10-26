import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { recurringPlan } from "../recurring/module.test.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);

test("empty plan", () => { assert.equal(compute(emptyPlan(), { today: TODAY }).hasData, false); });
test("typed quarterly, yearly and dated one-time costs plus a yearly payment found in transactions", () => {
  const p = recurringPlan();   // has Allstate 540 yearly in the transactions
  p.expenses.push(
    { id: "q", name: "Estimated taxes", category: "taxes", amount: 900, period: "quarterly", startDate: "2026-10-15" },
    { id: "y", name: "Car registration", category: "transport", amount: 240, period: "annual", startDate: "2027-03-01" },
    { id: "o", name: "Roof repair", category: "housing", amount: 8000, period: "once", startDate: "2027-01-15" },
    { id: "past", name: "Old thing", category: "other", amount: 100, period: "once", startDate: "2026-01-01" },
  );
  const d = compute(p, { today: TODAY });
  const by = (n) => d.funds.find((f) => f.name === n);
  near(by("Estimated taxes").monthly, 300); assert.equal(by("Estimated taxes").monthsToNext, 1);
  near(by("Car registration").monthly, 20);
  near(by("Roof repair").monthly, 2000, "8000 over the 4 months to January"); assert.equal(by("Roof repair").monthsToNext, 4);
  assert.equal(by("Old thing"), undefined, "a one-time cost in the past is gone");
  near(by("Allstate Insurance").monthly, 45); assert.equal(by("Allstate Insurance").source, "found"); assert.equal(by("Allstate Insurance").next, "2027-09-10");
  near(d.monthly, 300 + 20 + 2000 + 45);
  assert.deepEqual(d.dueNext.map((f) => f.name), ["Estimated taxes"]);
  assert.equal(d.funds[0].name, "Estimated taxes", "soonest first");
});
