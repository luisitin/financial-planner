// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("federal: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("federal: the 0.9% additional Medicare tax is worked on pay before pre-tax 401(k) saving", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30");
  p.income.find((x) => x.id === "i-ana").amount = 7600;   // 197,600 + Bo's 62,400 = 260,000 of pay; 12,220 to Ana's 401(k)
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.inputs.medicareWages, 260000);
  assert.equal(d.inputs.wages, 260000 - 12220);
  assert.ok(Math.abs(d.result.additionalMedicare - 0.009 * 10000) < 0.01);
  const typed = familyPlan("2026-10-30"); typed.taxes.thisYear.wages = 255000;
  assert.equal(compute(typed, { today: "2026-10-30" }).inputs.medicareWages, 255000, "typed wages are taken as they are");
});
