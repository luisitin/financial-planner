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

// --- round 8, batch 1 verify (2026-11-06) ------------------------------------------------------------------------------
test("round 8 verify: the 0% room, the tax the sales add and one more sale are worked on the Federal estimate's return", async () => {
  const { widowPlan, earlyRetireePlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { known } = await import("../federal/known.js");
  const { taxInputs } = await import("../federal/compute.js");
  const { federalTax } = await import("../../../core/math/tax.js");
  const T = "2026-11-06";
  const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
  // Ruth: 35,104.30 of taxable income with her required withdrawal (the Federal estimate's return); the 0% line is 49,450
  // (Rev. Proc. 2025-32 sec. 4.03). Each dollar of gain also makes 85 cents of her Social Security taxable until 85% of it is
  // (23,460, 3,084 more; IRC 86): 3,628 of gain pulls that in, then 7,634 more reaches the line: 11,262, not the 27,340 the
  // keys' return (no withdrawal, 5,360 taxable) leaves
  const d = compute(widowPlan(), { today: T });
  assert.equal(d.taxableIncome, known(widowPlan(), { today: T }).result.taxableIncome);
  near(d.zeroRoom, 11262, 1);
  // one more 10,000 long-term sale: Social Security taxed 23,460, AGI 72,338, taxable 48,188 (all of the gain under the
  // line), ordinary tax 1,240 + 12% x 25,788 = 4,334.56 against 3,964.52: it adds 370.04, the Social Security it pulls in
  near(compute(widowPlan(), { today: T, extra: { amount: 10000, held: "long" } }).extra.tax, 370.04, 0.01);
  // the same 10,000 on the list of sales: the tax the sales add is the same 370.04
  const p = widowPlan(); p.taxes = { ...(p.taxes ?? {}), gains: [{ id: "g1", name: "Fund", proceeds: 30000, basis: 20000, held: "long" }] };
  const s = compute(p, { today: T });
  near(s.taxOnGains, 370.04, 0.01);
  near(s.taxWith, known(p, { today: T }).result.totalTax, 1e-6);
  // the early retiree's draw for spending is income too: the room is what is left under 49,450 on that return
  const e = compute(earlyRetireePlan(), { today: T }), ke = known(earlyRetireePlan(), { today: T });
  assert.ok(ke.changed);
  near(e.zeroRoom, Math.max(0, 49450 - ke.result.taxableIncome), 1);
  // a household none of the plan's steps change keeps the answer keys' return exactly
  const q = taxPlan(), b = taxInputs(q, { today: "2026-09-16" });
  assert.equal(known(q, { today: "2026-09-16" }).changed, false);
  assert.equal(compute(q, { today: "2026-09-16" }).taxWith, federalTax(b.inputs, b.params).totalTax);
});

// round 8 batch 6 review (UX 9, item 26's next step): a sale named for a rental says the part of its gain from depreciation
test("batch 6 review: a sale named for a rental on Rental analysis carries its depreciation taken (about 44,291), the part taxed at up to 25%", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const p = condoOnNetWorthPlan();
  p.taxes = { ...(p.taxes ?? {}), gains: [{ id: "s1", name: "Condo sale", proceeds: 244400, basis: 165700, held: "long" }, { id: "s2", name: "100 shares", proceeds: 5000, basis: 4000, held: "long" }] };
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(d.rentalSales.length, 1);
  const s = d.rentalSales[0];
  assert.deepEqual([s.id, s.rental], ["s1", "Condo"]);
  assert.ok(Math.abs(s.depreciation - 44290.91) < 0.01, String(s.depreciation));
  // the gain is 78,700, more than the depreciation: all of it is the 25% part
  assert.ok(Math.abs(s.fromDepreciation - 44290.91) < 0.01);
  assert.deepEqual(compute(taxPlan(), { today: "2026-11-06" }).rentalSales ?? [], []);
});
