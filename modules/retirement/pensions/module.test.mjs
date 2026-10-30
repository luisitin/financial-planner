import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, realPayment, expectedValue, impliedRate, TO_AGE } from "./compute.js";
import { survival } from "../longevity/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withPensions = (pensions) => { const p = familyPlan(TODAY); p.retirement.pensions = pensions; return p; };
const COUNTY = { id: "pn", name: "County pension", personId: "p-bo", monthly: 1800, startAge: 62, cola: false, lumpSum: 310000, jointMonthly: 1620, survivorShare: 1 };

test("payments in today's dollars: level with a raise, worth less each year without", () => {
  assert.equal(realPayment(1000, true, 0.03, 10), 12000);
  near(realPayment(1000, false, 0.03, 10), 12000 / Math.pow(1.03, 10));
});

test("expected value and the rate that matches a lump sum", () => {
  near(expectedValue({ payments: [100, 100, 100], alive: [1, 1, 1], rate: 0 }), 300);
  near(expectedValue({ payments: [100, 100], alive: [1, 0.5], rate: 0.1 }), 100 + 50 / 1.1);
  const pay = Array(30).fill(12000), alive = pay.map((_, t) => Math.pow(0.97, t));
  const lump = expectedValue({ payments: pay, alive, rate: 0.045 });
  near(impliedRate(lump, pay, alive), 0.045, 1e-8);
  assert.equal(impliedRate(100, pay, alive), Infinity, "a tiny lump sum: the payments win at any rate");
  near(impliedRate(100 + 100 / 1.05, [100, 100], [1, 1]), 0.05, 1e-8); assert.equal(impliedRate(1e6, [100, 100], [1, 1]), -Infinity);
});

test("no pensions: nothing to show; Income's pensions listed", () => {
  const p = familyPlan(TODAY); p.income.push({ id: "ip", name: "Old job pension", type: "pension", personId: "p-ana", amount: 500, period: "monthly" });
  const d = compute(p, { today: TODAY });
  assert.equal(d.items.length, 0); assert.deepEqual(d.fromIncome, [{ name: "Old job pension", monthly: 500 }]);
  assert.equal(compute(emptyPlan(), { today: TODAY }).items.length, 0);
});

test("Bo's county pension: inflation, lifetime value, the lump sum, the survivor option", () => {
  const d = compute(withPensions([COUNTY]), { today: TODAY });
  const x = d.items[0];
  assert.equal(x.ageNow, 37); assert.equal(x.startYear, 2051);
  near(x.atEightyFive, 1800 / Math.pow(1.03, 85 - 37));
  // the expected value at 62, by hand
  let v = 0; for (let t = 0; t <= TO_AGE - 62; t++) v += realPayment(1800, false, 0.03, 62 + t - 37) * survival(62, 62 + t) / Math.pow(1 + d.realRate, t);
  near(x.lifetime, v, 1e-6);
  assert.ok(x.lump.rate > 0 && x.lump.rate < 0.1); assert.equal(x.lump.breakevenAge, 62 + Math.ceil(310000 / 21600));
  assert.ok(["monthly", "lump", "close"].includes(x.lump.verdict));
  assert.equal(x.survivor.partnerName, "Ana"); assert.equal(x.survivor.survivorMonthly, 1620);
  near(x.survivor.single, x.lifetime);
  assert.ok(x.survivor.joint > 0);
});

test("a raise with prices keeps its value; a stop age ends it; a partner's option needs both figures", () => {
  const d = compute(withPensions([{ id: "a", name: "A", personId: "p-ana", monthly: 900, startAge: 65, cola: true, endAge: 70 }, { id: "b", name: "B", personId: "p-bo", monthly: 1000, startAge: 62, jointMonthly: 900 }]), { today: TODAY });
  assert.equal(d.items[0].atEightyFive, 900);
  let v = 0; for (let t = 0; t <= 5; t++) v += 10800 * survival(65, 65 + t) / Math.pow(1 + d.realRate, t);
  near(d.items[0].lifetime, v);
  assert.equal(d.items[1].survivor, null);
  assert.equal(d.totalMonthly, 1900);
});
