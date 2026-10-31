// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("withholding: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

import { paychecksLeft } from "./compute.js";

// a single filer with 30,000 of interest: 2026 tax = 10% x 12,400 + 12% x (13,900 - 12,400) = 1,420
const interestPlan = (fill) => {
  const p = emptyPlan(); p.household.filingStatus = "single";
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1980-01-01" });
  p.taxes.thisYear.otherOrdinary = 30000;
  fill(p); return p;
};

test("withholding: paychecks left are a full year before the year, none once it is over (IRC 31(a)(2))", () => {
  assert.equal(paychecksLeft("biweekly", "2025-12-01", 2026), 26);
  assert.equal(paychecksLeft("biweekly", "2027-01-10", 2026), 0);   // January's paychecks count for 2027
  assert.equal(paychecksLeft("monthly", "2026-10-01", 2026), 2);    // floor(91 / 365.25 x 12)
  const p = interestPlan((q) => { q.taxes.year = 2026; q.taxes.withholding = { self: { perPaycheck: 100, period: "monthly" } }; q.taxes.thisYear.withheld = 900; });
  assert.equal(compute(p, { today: "2027-01-10" }).withholding.projected, 900);   // what was withheld in 2026, nothing more
});

test("withholding: a typed 0 so far is a figure (the Federal estimate page sets withheldTyped), a blank runs the whole year", () => {
  const blank = interestPlan((q) => { q.taxes.withholding = { self: { perPaycheck: 100, period: "monthly" } }; });
  assert.equal(compute(blank, { today: "2026-10-01" }).withholding.projected, 1200);
  const zero = interestPlan((q) => { q.taxes.withholding = { self: { perPaycheck: 100, period: "monthly" } }; q.taxes.thisYear.withheld = 0; q.taxes.thisYear.withheldTyped = true; });
  assert.equal(compute(zero, { today: "2026-10-01" }).withholding.projected, 200);   // 0 so far + 2 paychecks left
});

test("withholding: the $1,000 test counts withholding only, not estimated payments (IRC 6654(e)(1))", () => {
  // tax 1,420 + 4,500 more interest at 12%: 30,000 -> 34,500 interest gives 1,420 + 540 = 1,960; withheld 900 -> 1,060 short of the tax
  const p = interestPlan((q) => { q.taxes.thisYear.otherOrdinary = 34500; q.taxes.thisYear.withheld = 900; q.taxes.estimated.paid = [200, 0, 0, 0]; });
  const d = compute(p, { today: "2026-12-31" });
  assert.equal(Math.round(d.totalTax), 1960);
  assert.ok(d.balance < 1000);                       // 1,960 - 900 - 200 = 860 after the estimate
  assert.equal(d.penaltyRisk, true);                 // but tax less withholding is 1,060 and 1,100 paid misses 90% (1,764)
});
