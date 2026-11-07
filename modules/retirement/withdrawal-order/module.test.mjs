// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("withdrawal-order: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// round 8, Batch 5b (2026-11-06): the ways that set a withdrawal spend tax savings rather than keep them, so orders are compared
// on the plan's own spending, the same every year: a plan on another way ranks its orders exactly as on the same spending
test("5b: a plan on a share of what is left compares its orders at the same spending every year", async () => {
  const { bridgeCouple } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const today = "2026-11-06";
  // health cover is priced on the plan's own income, which moves with the way: left out here, so only the way differs
  const couple = () => { const p = migrate(bridgeCouple()); p.retirement.healthIncluded = true; return p; };
  const steady = compute(couple(), { today });
  for (const way of ["percent", "guardrails", "vpw"]) {
    const p = couple(); p.retirement.strategy = way;
    const d = compute(p, { today });
    assert.deepEqual(d.options.map((o) => [o.key, o.endAfterTaxReal, o.taxesReal]), steady.options.map((o) => [o.key, o.endAfterTaxReal, o.taxesReal]), way);
    assert.equal(d.best, steady.best);
  }
});
