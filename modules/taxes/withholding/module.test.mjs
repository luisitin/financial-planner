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
test("withholding: an amount so far with no paycheck figure says the figure is missing, not that nothing is withheld", () => {
  const p = interestPlan((q) => { q.taxes.thisYear.otherOrdinary = 34500; q.taxes.thisYear.withheld = 900; });
  const d = compute(p, { today: "2026-06-30" });
  assert.equal(d.verdict, "owe");
  assert.equal(d.suggestion.kind, "estimates");
  assert.match(d.suggestion.text, /^No paycheck figure is typed yet/);
  assert.match(d.suggestion.text, /What a paycheck withholds/);
});

test("one answer to refund or owe: typed figures, else withholding estimated from pay; every page reads the same balance", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: estimated } = await import("../estimated/compute.js");
  const { withholdingEstimate, taxAnswer } = await import("./compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  const e = withholdingEstimate(p, { today: T });
  assert.equal(e.from, "paycheck", "no pay stub figure typed: estimated from pay");
  assert.ok(e.projected > 0); assert.equal(e.people.length, 2);
  assert.ok(Math.abs(e.projected - e.people.reduce((t, x) => t + x.yearly, 0)) < 0.01);
  const d = compute(p, { today: T });
  assert.equal(d.verdict, "unknown", "the typed-only verdict is unchanged (the answer key checks it)");
  assert.equal(d.estimate.verdict, d.estimate.balance >= 500 ? "owe" : d.estimate.balance <= -500 ? "refund" : "about right");
  const a = taxAnswer(p, { today: T });
  const est = estimated(p, { today: T });
  assert.ok(Math.abs(a.balance - est.balanceAtFiling) < 0.01, "Estimated payments and the tax answer agree");
  assert.ok(Math.abs(a.balance - d.estimate.balance) < 0.01, "Withholding check and the tax answer agree");
  assert.equal(est.withholdingFrom, "paycheck");
  // a typed paycheck figure wins
  p.taxes.withholding = { self: { perPaycheck: 400, period: "biweekly" }, partner: { perPaycheck: 500, period: "monthly" } };
  const t = withholdingEstimate(p, { today: T });
  assert.equal(t.from, "typed"); assert.equal(t.projected, compute(p, { today: T }).withholding.projected);
  assert.equal(taxAnswer(p, { today: T }).from, "typed");
  // no income: no answer
  assert.equal(taxAnswer(emptyPlan(), { today: T }), null);
});
