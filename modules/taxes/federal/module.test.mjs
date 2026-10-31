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

test("federal: filing separately, Social Security is taxed from the first dollar unless the spouses lived apart all year (IRC 86(c))", () => {
  const p = emptyPlan();
  p.household.filingStatus = "married_separate";
  p.taxes.thisYear.socialSecurity = 30000; p.taxes.thisYear.otherOrdinary = 5000;
  const together = compute(p, { today: "2026-10-30" });
  assert.equal(together.result.income.taxableSocialSecurity, 0.85 * (5000 + 15000));   // 17,000
  assert.ok(together.notes.some((n) => /lived apart all year/.test(n)));
  p.taxes.livedApart = true;
  const apart = compute(p, { today: "2026-10-30" });
  assert.equal(apart.livedApart, true);
  assert.equal(apart.result.income.taxableSocialSecurity, 0);   // provisional 20,000 under the single base of 25,000
  p.household.filingStatus = "married_joint";
  assert.equal(compute(p, { today: "2026-10-30" }).livedApart, false);   // the tick counts only on a separate return
});

test("federal: a year past the tables takes SSA's published wage base (2027: $192,300), later years inflate", () => {
  const p = emptyPlan();
  p.taxes.year = 2027;
  assert.equal(compute(p, { today: "2026-10-30" }).params.ssWageBase, 192300);
  p.taxes.year = 2026;
  assert.equal(compute(p, { today: "2026-10-30" }).params.ssWageBase, 184500);
  p.taxes.year = 2029;
  assert.ok(compute(p, { today: "2026-10-30" }).params.ssWageBase > 184500);
});
