import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, taxWith } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the standard-deduction household: a cash gift saves tax on up to $2,000 (joint) at the 22% rate", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.yearly, 3000, "the example");
  assert.equal(d.withGift.used, "standard");
  near(d.saved, 2000 * 0.22, 1e-6); near(d.netCost, 3000 - 440);
  assert.ok(d.bunch.saving < 0, "bunching only wastes the yearly $2,000 deduction");
  near(d.bunch.eachYear, d.withGift.tax * 3); near(d.bunch.bunched, taxWith(familyPlan(TODAY), { gift: 9000, today: TODAY }).tax + d.none.tax * 2);
});

test("an itemizing household: bunching three years of gifts saves tax", () => {
  const p = familyPlan(TODAY);
  p.taxes = { itemized: { mortgageInterest: 16000, propertyTax: 5200, stateTax: 6000 } };
  p.whatIfs = { charitable: { yearly: 6000, bunchYears: 3 } };
  const d = compute(p, { today: TODAY });
  assert.equal(d.bunch.bigUsed, "itemized"); assert.ok(d.bunch.saving > 0);
  assert.match(d.warnings[0], /bunching saves tax/);
});

test("shares that have grown: the capital gains tax giving them avoids; the plan's own gift is replaced, not added", () => {
  const p = familyPlan(TODAY); p.taxes = { itemized: { charitable: 4000 } };
  const d = compute(p, { today: TODAY });
  assert.equal(d.yearly, 4000); assert.equal(d.fromTaxes, 4000);
  near(d.stock.gain, 2000); near(d.stock.taxAvoided, 2000 * 0.15, 1e-6);
  near(d.none.tax, taxWith({ ...p, taxes: { itemized: { charitable: 0 } } }, { today: TODAY }).tax);
});

test("an IRA gift after 70 1/2", () => {
  const p = familyPlan(TODAY); p.household.people.find((q) => q.id === "p-ana").birthDate = "1950-01-01";
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.qcd.names, ["Ana"]); assert.equal(d.qcd.eligible, true);
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).qcd.eligible, false);
});
