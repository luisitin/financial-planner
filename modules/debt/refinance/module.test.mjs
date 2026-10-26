// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("refinance: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15", rate: 0.05, termYears: 30, closingCosts: 6000, yearsStaying: 7 });
  assert.equal(d.hasData, true); assert.ok(d.monthlySaving > 0);
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});
