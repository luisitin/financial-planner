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

test("review: one earner typed, only the year so far typed, other payments: never an earner at $0, and paid counts", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { withholdingEstimate, taxAnswer, paychecksLeft } = await import("./compute.js");
  const T = "2026-11-02";
  const base = taxAnswer(familyPlan(T), { today: T });
  // Ana's stub typed at about the estimate, Bo blank: Bo stays estimated from pay
  const p = familyPlan(T);
  const anaEst = withholdingEstimate(p, { today: T }).people.find((x) => x.name === "Ana");
  p.taxes.withholding = { self: { perPaycheck: Math.round(anaEst.perPaycheck), period: "biweekly" } };
  const mixed = withholdingEstimate(p, { today: T });
  assert.equal(mixed.from, "mixed");
  assert.deepEqual(mixed.people.map((x) => [x.name, x.estimated]), [["Ana", false], ["Bo", true]]);
  assert.ok(Math.abs(taxAnswer(p, { today: T }).balance - base.balance) < 50, "about the same April bill, not $8,728");
  // only the year so far typed: the paychecks left still count, estimated from pay
  const q = familyPlan(T);
  q.taxes.thisYear = { ...(q.taxes.thisYear ?? {}), withheld: 8000, withheldTyped: true };
  const so = withholdingEstimate(q, { today: T });
  assert.equal(so.from, "mixed");
  const rest = so.people.reduce((t, x) => t + x.perPaycheck * paychecksLeft(x.period, T, 2026), 0);
  assert.ok(rest > 0); assert.ok(Math.abs(so.projected - (8000 + rest)) < 0.01);
  // other payments typed on the Federal estimate count as paid
  const r = familyPlan(T);
  r.taxes.thisYear = { ...(r.taxes.thisYear ?? {}), paid: 3000 };
  const a = taxAnswer(r, { today: T });
  assert.ok(Math.abs(a.balance - (base.balance - 3000)) < 0.01); assert.equal(a.paid, 3000);
  // the W-4 change on the estimate is per paycheck, on the main earner's paychecks left
  const s = compute(familyPlan(T), { today: T }).estimate.suggestion;
  assert.equal(s.kind, "add"); assert.ok(s.paychecks > 0); assert.equal(s.perPaycheck, Math.ceil(base.balance / s.paychecks));
});

test("review: the year's tax counts self-employment tax on business income, as the Self-employment page works it out", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: fedOf } = await import("../federal/compute.js");
  const { compute: seOf } = await import("../self-employment/compute.js");
  const { taxAnswer } = await import("./compute.js");
  const { compute: estOf } = await import("../estimated/compute.js");
  const T = { today: "2026-11-02" };
  const p = familyPlan("2026-11-02");   // Bo's weekend photography: $600 a month of business income
  const d = compute(p, T), fed = fedOf(p, T).result.totalTax, se = seOf(p, T);
  assert.ok(se.ready && se.seTotal > 0);
  assert.equal(d.incomeTax, fed); assert.equal(d.totalTax, se.taxWith);
  assert.ok(d.seTax > 0 && d.seTax < se.seTotal, "the 15.3% tax less what its two deductions save");
  assert.equal(taxAnswer(p, T).seTax, d.seTax);
  assert.equal(estOf(p, T).totalTax, d.totalTax, "Estimated payments uses the same year's tax");
  p.income = p.income.filter((x) => x.type !== "business");
  const n = compute(p, T);
  assert.equal(n.seTax, 0); assert.equal(n.totalTax, fedOf(p, T).result.totalTax, "no business: the Federal estimate's total");
});

// ---- the walk ends at the whole tax (round 4, 2026-11-02)
import { fullSteps, taxAnswer } from "./compute.js";
import { compute as fedOf } from "../federal/compute.js";
import { familyPlan as famOf } from "../../../qa/fixtures/family-plan.mjs";
test("fullSteps: the business rows go in before Federal tax, which ends at yearTax's total; no business, no change", () => {
  const p = famOf("2026-11-02"), fed = fedOf(p, { today: "2026-11-02" });
  const f = fullSteps(p, fed, { today: "2026-11-02" });
  const labels = f.steps.map((x) => x.label);
  assert.deepEqual(labels.slice(-3), ["Tax saved by business deductions", "Self-employment tax", "Federal tax"]);
  const ft = f.steps[f.steps.length - 1];
  assert.equal(ft.amount, taxAnswer(p, { today: "2026-11-02" }).totalTax); assert.equal(f.total, ft.amount);
  // the rows add up: the engine's income tax, plus the business change, plus the self-employment tax
  const biz = f.steps[f.steps.length - 3].amount, se = f.steps[f.steps.length - 2].amount;
  assert.ok(Math.abs(fed.result.totalTax + biz + se - f.total) < 0.01);
  assert.equal(fed.steps.find((x) => x.label === "Federal tax").amount, fed.result.totalTax, "the engine's own walk is untouched");
  p.income = p.income.filter((x) => x.type !== "business");
  const g = fullSteps(p, fedOf(p, { today: "2026-11-02" }), { today: "2026-11-02" });
  assert.equal(g.se, null); assert.ok(!g.steps.some((x) => x.label === "Self-employment tax"));
});
