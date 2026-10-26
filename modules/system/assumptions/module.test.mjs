import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, ASSUMPTIONS } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("defaults in emptyPlan match the documented defaults; nothing changed; not reviewed", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  for (const r of d.rows) assert.equal(r.value, r.def, r.key);
  assert.equal(d.changedCount, 0);
  assert.equal(d.reviewedAt, null);
  assert.equal(d.stale, true);
  assert.deepEqual(d.warnings, []);
  assert.equal(ASSUMPTIONS.length, 10);
});
test("real returns are (1+nominal)/(1+inflation)-1", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  near(d.realStocks, 1.07 / 1.03 - 1);
  near(d.realCash, 1.02 / 1.03 - 1);
});
test("changed values are counted; a missing key falls back to the default", () => {
  const p = emptyPlan();
  p.assumptions.returnStocks = 0.09;
  delete p.assumptions.emergencyMonths;
  const d = compute(p, { today: TODAY });
  assert.equal(d.changedCount, 1);
  assert.equal(d.rows.find((r) => r.key === "emergencyMonths").value, 6);
});
test("review stamp: fresh, stale after a year", () => {
  const p = emptyPlan();
  p.assumptions.reviewedAt = "2026-09-01";
  let d = compute(p, { today: TODAY });
  assert.equal(d.daysSinceReview, 14); assert.equal(d.stale, false);
  p.assumptions.reviewedAt = "2025-01-01";
  d = compute(p, { today: TODAY });
  assert.equal(d.stale, true);
});
test("warnings: stocks below bonds, optimistic stocks, retirement past plan end", () => {
  const p = emptyPlan();
  p.assumptions.returnStocks = 0.03; p.assumptions.returnBonds = 0.04;
  assert.ok(compute(p).warnings.some((w) => w.includes("less than bonds")));
  p.assumptions.returnStocks = 0.15; p.assumptions.inflation = 0.03;
  assert.ok(compute(p).warnings.some((w) => w.includes("optimistic")));
  p.assumptions.retirementAge = 95; p.assumptions.planEndAge = 95;
  assert.ok(compute(p).warnings.some((w) => w.includes("end age")));
});
