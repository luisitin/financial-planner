// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("capital-gains: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("capital-gains: the loss carried forward follows the carryover worksheet, so it is all of it when taxable income is below zero (IRC 1212(b)(2); Pub. 550 Worksheet 4-1)", () => {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult A", role: "self", birthDate: "1980-01-01" }];
  p.taxes.year = 2026; p.taxes.thisYear.otherOrdinary = 5000;
  p.taxes.gains = [{ id: "g1", name: "Fund", proceeds: 0, basis: 10000, held: "long" }];
  const d = compute(p, { today: "2026-10-31" });
  assert.equal(d.gains.lossAllowed, -3000);
  // taxable income 5,000 - 3,000 - 16,100 = -14,100: line 3 is 0, so none of the allowed 3,000 is used up and all 10,000 carries
  assert.equal(d.gains.carryForward, -10000); assert.deepEqual(d.gains.carryover, { short: 0, long: 10000, total: 10000 });
  // with $60,000 of other income the 3,000 is used: 7,000 carries
  p.taxes.thisYear.otherOrdinary = 60000;
  assert.equal(compute(p, { today: "2026-10-31" }).gains.carryForward, -7000);
});
