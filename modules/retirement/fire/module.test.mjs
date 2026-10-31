// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("fire: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("years from nothing to independence by saving rate: the page's own growth and withdrawal rate", async () => {
  const { yearsFromZero } = await import("./compute.js");
  // 5% after inflation and 4% drawn: the pot after y years is rate x (1.05^y - 1) / 0.05 and must reach (1 - rate) / 0.04,
  // so half of income needs 1.05^y >= 2.25 (16.6, so 17 years) and a tenth 1.05^y >= 12.25 (51.3, so 52 years)
  assert.equal(yearsFromZero(0.5, 0.05, 0.04), 17); assert.equal(yearsFromZero(0.1, 0.05, 0.04), 52);
  // nothing grows: half saved needs 25 x half of income, 25 years
  assert.equal(yearsFromZero(0.5, 0, 0.04), 25); assert.equal(yearsFromZero(0, 0.05, 0.04), null);
});
