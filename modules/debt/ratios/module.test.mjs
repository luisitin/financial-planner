// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("ratios: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15" });
  assert.ok(d.dti > 0 && d.dti < 1); assert.equal(d.rows.length, 4);
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

test("card use: Credit cards' answer to how much less gets under 30%, and the required part of what is paid", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const today = "2026-11-02";
  const d = compute(familyPlan(today), { today });
  assert.equal(Math.round(d.under.less30), 1900); assert.equal(d.under.date30, "2027-06-02");
  assert.ok(d.minimums < d.payments, "the family pays more than the required amounts");
});
