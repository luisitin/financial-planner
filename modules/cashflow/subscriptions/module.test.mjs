import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { recurringPlan } from "../recurring/module.test.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);

test("empty plan", () => { assert.equal(compute(emptyPlan(), { today: TODAY }).hasData, false); });
test("found subscriptions (by category or by name), typed ones, no double counting, biggest first", () => {
  const p = recurringPlan();   // Netflix (category subscriptions) and Gym Membership (category fun, name says gym) recur monthly
  p.expenses.push({ id: "s1", name: "Spotify", category: "subscriptions", amount: 10.99, period: "monthly" }, { id: "s2", name: "Netflix plan", category: "subscriptions", amount: 15.49, period: "monthly" });
  const d = compute(p, { today: TODAY });
  const names = d.items.map((i) => i.name);
  assert.deepEqual(names, ["Gym Membership", "Netflix", "Spotify"], "the typed Netflix duplicates the found one and is dropped; 49 > 15.49 > 10.99");
  near(d.items[0].yearly, 588); near(d.yearly, 588 + 15.49 * 12 + 10.99 * 12); near(d.monthly, d.yearly / 12);
  assert.equal(d.items.find((i) => i.name === "Spotify").source, "typed");
  assert.equal(d.count, 3);
});
