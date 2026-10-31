// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("estimated: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("estimated: a due date on a weekend or holiday moves to the next business day (IRC 7503)", async () => {
  const { QUARTERS } = await import("./compute.js");
  // 2026: Wednesday April 15, Monday June 15, Tuesday September 15, Friday January 15, 2027: none move
  assert.deepEqual(QUARTERS(2026).map((q) => q.due), ["2026-04-15", "2026-06-15", "2026-09-15", "2027-01-15"]);
  // 2027's last payment: Saturday January 15, 2028, then Martin Luther King Jr. Day on the 17th: Tuesday the 18th
  assert.equal(QUARTERS(2027)[3].due, "2028-01-18");
  // 2028: April 15 is a Saturday and Emancipation Day (Sunday the 16th) is kept on Monday the 17th: Tuesday the 18th;
  // September 15, 2029 is a Saturday: Monday the 17th
  assert.equal(QUARTERS(2028)[0].due, "2028-04-18"); assert.equal(QUARTERS(2029)[2].due, "2029-09-17");
  // the page passes the plan's state, and its tax year's dates reach the quarters it shows
  const p = taxPlan(); p.taxes = { ...(p.taxes ?? {}), year: 2027 };
  assert.equal(compute(p, { today: "2027-03-01" }).quarters[3].due, "2028-01-18");
});

test("estimated: with no withholding typed, the Paycheck page's estimate; what is behind, then the next payment", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: paycheck } = await import("../../cashflow/paycheck/compute.js");
  const p = familyPlan("2026-10-31");
  const pc = paycheck(p, { today: "2026-10-31" });
  const d = compute(p, { today: "2026-10-31" });
  assert.equal(d.withholdingFrom, "paycheck");
  assert.ok(Math.abs(d.withholding - pc.people.reduce((s, x) => s + x.yearly.federal, 0)) < 1e-6);
  assert.ok(d.notes.some((n) => /Paycheck page/.test(n)));
  // on October 31 three quarters are past: three shares are behind, the fourth is due January 15
  assert.equal(d.needsEstimates, true);
  assert.ok(Math.abs(d.behind - 3 * d.perQuarter) < 0.01); assert.equal(d.overdue.due, "2026-04-15");
  assert.equal(d.nextDue.due, "2027-01-15"); assert.ok(Math.abs(d.nextDue.amount - d.perQuarter) < 0.01);
  // the first two paid: only the third is behind
  p.taxes = { ...(p.taxes ?? {}), estimated: { paid: [d.perQuarter, d.perQuarter, 0, 0] } };
  const e = compute(p, { today: "2026-10-31" });
  assert.ok(Math.abs(e.behind - e.perQuarter) < 0.01); assert.equal(e.overdue.due, "2026-09-15");
  // before the first due date nothing is behind
  const f = compute(familyPlan("2026-03-01"), { today: "2026-03-01" });
  assert.equal(f.behind, 0); assert.equal(f.overdue, null); assert.equal(f.nextDue.due, "2026-04-15");
  // withholding typed on the Withholding check page wins
  p.taxes.withholding = { self: { perPaycheck: 400, period: "biweekly" } };
  assert.equal(compute(p, { today: "2026-10-31" }).withholdingFrom, "typed");
});

import { QUARTERS } from "./compute.js";

test("estimated: Patriots' Day does not move an estimated payment (Rev. Rul. 2015-13); D.C.'s holidays do", () => {
  assert.equal(QUARTERS(2024, "MA")[0].due, "2024-04-15");   // the return moved to April 17 in MA and ME; the payment did not
  assert.equal(QUARTERS(2027)[3].due, "2028-01-18");         // Saturday the 15th, Martin Luther King Jr. Day on the 17th
});

test("estimated: a quarter's status counts everything paid; a payment made late still flags the penalty for its quarter", () => {
  // single, 30,000 of interest: tax 1,420; safe amount 90% = 1,278, a quarter 319.50 (no withholding)
  const plan = (paid) => { const p = emptyPlan(); p.household.filingStatus = "single"; p.taxes.thisYear.otherOrdinary = 30000; p.taxes.estimated.paid = paid; return p; };
  // July 20: nothing in the first box, 700 typed in the second: both past quarters are covered by the total
  const d = compute(plan([0, 700, 0, 0]), { today: "2026-07-20" });
  assert.deepEqual(d.quarters.map((q) => q.status), ["paid", "paid", "upcoming", "upcoming"]);
  assert.equal(d.behind, 0); assert.equal(d.overdue, null);
  assert.equal(d.nextDue.due, "2026-09-15"); assert.ok(Math.abs(d.nextDue.amount - (958.5 - 700)) < 1e-9);   // never a $0 next payment
  // the first quarter's own box was empty on April 15: late, so the penalty note shows, though nothing is behind now
  assert.equal(d.quarters[0].late, true); assert.equal(d.lateQuarter.n, 1); assert.equal(d.penaltyRisk, true);
  // the whole year paid: nothing left to warn about
  assert.equal(compute(plan([0, 1278, 0, 0]), { today: "2026-07-20" }).penaltyRisk, false);
});
