import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan: no data, planned figures still offered when entered", () => {
  let d = compute(emptyPlan(), { today: "2026-09-15" });
  assert.equal(d.hasData, false); assert.equal(d.planned, null);
  const p = emptyPlan();
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 4000, period: "monthly" });
  d = compute(p, { today: "2026-09-15" });
  assert.equal(d.planned.in, 4000); assert.equal(d.planned.out, 0);
});
test("months from transactions: transfers out, income by category kind, uncategorised money in counts as income", () => {
  const p = samplePlan();
  const d = compute(p, { today: "2026-09-15" });
  assert.deepEqual(d.rows.map((r) => r.ym), ["2026-09", "2026-08"]);
  const sep = d.rows[0], aug = d.rows[1];
  near(sep.in, 1950 + 1950 + 640.22, "payroll twice plus the card payment received (uncategorised money in)");
  near(sep.out, 1500 + 86.40 + 54.12 + 15.49 + 640.22 + 42.17 + 42.17);
  assert.equal(sep.complete, false, "September is the current month"); assert.equal(aug.complete, true);
  assert.equal(sep.uncategorised, 4);
  near(aug.in, 1950); near(aug.out, 1608); near(aug.net, 342); near(aug.rate, 342 / 1950);
  near(d.totals.in, sep.in + aug.in);
  assert.equal(d.average.months, 1); near(d.average.net, 342);
  assert.equal(d.byCategory.out[0].category, "housing"); near(d.byCategory.out[0].total, 3000);
  assert.equal(d.byCategory.in[0].category, "income-salary"); near(d.byCategory.in[0].total, 5850);
  assert.equal(compute(p, { months: 1 }).rows.length, 1);
});
