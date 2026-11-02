import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { compute as federal } from "../../taxes/federal/compute.js";
import { taxAnswer } from "../../taxes/withholding/compute.js";

const TODAY = "2026-10-30";

test("no income: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("this year's figures are the Federal estimate's; the ladder covers every bracket and marks the current one", () => {
  const d = compute(familyPlan(), { today: TODAY });
  const f = federal(familyPlan(), { today: TODAY });
  // the whole year's tax (self-employment tax included), as Withholding check and the Federal estimate's headline say;
  // the walk gains the business rows and ends at it (round 4, 2026-11-02)
  const a = taxAnswer(familyPlan(), { today: TODAY });
  assert.equal(d.thisYear.totalTax, a.totalTax); assert.equal(d.thisYear.incomeTax, f.result.totalTax);
  assert.equal(d.thisYear.steps.length, f.steps.length + 2);
  assert.equal(d.thisYear.steps.find((x) => x.label === "Federal tax").amount, a.totalTax);
  assert.ok(d.thisYear.seTax > 1000 && d.thisYear.seTax < 1100, "the family's 7,200 of photography: about 1,017");
  assert.equal(d.ladder.length, 7); assert.equal(d.ladder.filter((l) => l.current).length, 1);
  assert.equal(d.ladder.find((l) => l.current).rate, d.thisYear.bracketRate);
  assert.equal(d.paying.verdict, a.verdict, "estimated from pay, the same answer as Withholding check"); assert.equal(Math.round(d.paying.balance), Math.round(a.balance));
  assert.equal(d.hsa, null); assert.equal(d.gains.hasSales, false);
  assert.ok(d.retirement.ready && d.retirement.years > 0);
});

test("the tax fixture: withholding about right, sales, an HSA", () => {
  const d = compute(taxPlan(), { today: TODAY });
  assert.equal(d.paying.verdict, taxAnswer(taxPlan(), { today: TODAY }).verdict, "the same answer as Withholding check");
  assert.equal(d.gains.hasSales, true); assert.ok(d.gains.taxOnGains > 0);
  assert.ok(d.hsa && d.hsa.taxSaved > 0);
});
