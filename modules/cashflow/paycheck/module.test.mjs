import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, withholdFederal, w4StatusFor, PAYROLL } from "./compute.js";
import { PCT_METHOD } from "./data/withholding.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const ana = (d) => d.people.find((p) => p.id === "p-ana");
const bo = (d) => d.people.find((p) => p.id === "p-bo");
const withPay = (fn) => { const p = familyPlan(TODAY); fn(p); return p; };

test("the 2026 tables as printed in Publication 15-T: each base is the last plus the rate over the bracket", () => {
  const T = PCT_METHOD[2026];
  assert.deepEqual(T.step1g, { married_joint: 12900, other: 8600 });
  for (const kind of ["standard", "checkbox"]) for (const [status, rows] of Object.entries(T[kind])) {
    rows.slice(1).forEach((r, i) => {
      const prev = rows[i];
      // the IRS rounded two half-dollar thresholds in the single Step 2 table, so allow cents
      near(r.base, prev.base + prev.rate * (r.from - prev.from), 0.2);
    });
    assert.equal(rows.length, 8, `${kind} ${status}`);
  }
});

test("Worksheet 1A by hand: $2,000 every two weeks, single, nothing else on the W-4", () => {
  // 2,000 x 26 = 52,000; less 8,600 = 43,400; 1,240 + 12% x (43,400 - 19,900) = 4,060 a year; / 26
  const w = withholdFederal(2000, 26, { status: "single" }, 2026);
  near(w.adjusted, 43400); near(w.tentative, 4060); near(w.perCheck, 4060 / 26); assert.equal(w.rate, 0.12);
});

test("Worksheet 1A: the Step 2 box, Step 3 credits, Step 4(a), 4(b) and 4(c)", () => {
  // ticked: no 1(g) amount and the checkbox table: 52,000 -> 2,900 + 22% x (52,000 - 33,250) = 7,025
  near(withholdFederal(2000, 26, { status: "single", step2: true }, 2026).tentative, 7025);
  // 4(a) 5,000 more income, 4(b) 3,000 of deductions: 52,000 + 5,000 - 3,000 - 8,600 = 45,400 -> 1,240 + 12% x 25,500 = 4,300
  near(withholdFederal(2000, 26, { status: "single", otherIncome: 5000, deductions: 3000 }, 2026).tentative, 4300);
  // Step 3 credits of 2,200 a year come off each paycheck, never below 0; 4(c) adds on top
  near(withholdFederal(2000, 26, { status: "single", credits: 2200 }, 2026).perCheck, (4060 - 2200) / 26);
  near(withholdFederal(2000, 26, { status: "single", credits: 9000, extra: 25 }, 2026).perCheck, 25);
  // married filing jointly: 12,900 off; head of household's own table
  near(withholdFederal(3430, 26, { status: "married_joint" }, 2026).perCheck, (2480 + 0.12 * (3430 * 26 - 12900 - 44100)) / 26);
  near(withholdFederal(4000, 12, { status: "head_of_household" }, 2026).tentative, 1770 + 0.12 * (48000 - 8600 - 33250));
  assert.equal(withholdFederal(200, 26, { status: "single" }, 2026).perCheck, 0, "under the first row: nothing");
});

test("the W-4 status follows the household's filing status", () => {
  assert.equal(w4StatusFor("married_joint"), "married_joint"); assert.equal(w4StatusFor("qualifying_surviving"), "married_joint");
  assert.equal(w4StatusFor("head_of_household"), "head_of_household"); assert.equal(w4StatusFor("married_separate"), "single"); assert.equal(w4StatusFor("single"), "single");
});

test("the family: Ana's 401(k) comes off before income tax but not before Social Security and Medicare", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.year, 2026);
  const a = ana(d);
  assert.equal(a.paychecks, 26); assert.equal(a.paychecksFrom, "period"); near(a.gross, 3900);
  const k = a.pretax.find((x) => x.key === "k401");
  near(a.wages.federal, 3900 - k.amount); near(a.wages.fica, 3900);
  near(a.ss, 0.062 * 3900); near(a.medicare, 0.0145 * 3900);
  assert.equal(a.federal.from, "estimate"); near(a.federal.amount, withholdFederal(a.wages.federal, 26, { status: "married_joint" }, 2026).perCheck);
  near(a.net, a.gross - a.pretaxTotal - a.federal.amount - a.ss - a.medicare - a.state.amount - a.aftertaxTotal);
  near(a.taxesTotal, a.federal.amount + a.ss + a.medicare + a.state.amount);
  near(a.shares.net + a.shares.taxes + a.shares.saved + a.shares.benefits, 100 * (a.net + a.taxesTotal + a.pretaxTotal + a.aftertaxTotal) / a.gross, 1e-9);
  near(bo(d).gross, 5200); assert.equal(bo(d).paychecks, 12);
  assert.ok(d.notes.some((n) => /both have "Married filing jointly"/.test(n)));
  assert.equal(a.state.from, "no-tax", "Texas has no income tax"); assert.equal(a.state.amount, 0);
});

test("health cover, the HSA, the FSAs and commuting come off before every tax; the Benefits page's elections fill the gaps", () => {
  const p = withPay((q) => { q.whatIfs = { paycheck: { "p-ana": { health: 120 } }, benefits: { "p-ana": { fsaElect: 2600, dcfsaElect: 5200, transitMonthly: 130, hsaElect: 0 } } }; });
  const a = ana(compute(p, { today: TODAY }));
  const k = a.pretax.find((x) => x.key === "k401").amount;
  const caf = 120 + 2600 / 26 + 5200 / 26 + 130 * 12 / 26;
  near(a.pretaxTotal, k + caf); near(a.wages.fica, 3900 - caf); near(a.wages.federal, 3900 - k - caf);
  assert.equal(a.pretax.find((x) => x.key === "fsa").from, "plan"); assert.equal(a.pretax.find((x) => x.key === "health").from, "typed");
});

test("Social Security stops at the wage base; the 0.9% starts above $200,000; the year's take-home counts both", () => {
  const p = withPay((q) => { q.income.find((x) => x.id === "i-ana").amount = 10000; q.retirement.contributions = []; });   // 260,000 a year
  const a = ana(compute(p, { today: TODAY }));
  assert.equal(a.ssStopsAfter, Math.ceil(184500 / 10000)); assert.equal(a.extraMedicareFrom, Math.floor(200000 / 10000) + 1);
  near(a.yearly.ss, 0.062 * 184500); near(a.yearly.medicare, 0.0145 * 260000 + 0.009 * 60000);
  near(a.yearly.net, a.net * 26 + (a.ss * 26 - 0.062 * 184500) - 0.009 * 60000);
  near(a.monthly, a.yearly.net / 12);
});

test("the pay stub's federal figure wins, then the Withholding page's; the state at its rate or as typed", () => {
  const typed = withPay((q) => { q.whatIfs = { paycheck: { "p-ana": { federal: 300, state: 90 } } }; q.taxes = { ...(q.taxes ?? {}), withholding: { self: { perPaycheck: 250, period: "biweekly" } } }; });
  const a = ana(compute(typed, { today: TODAY }));
  assert.equal(a.federal.from, "typed"); near(a.federal.amount, 300); assert.equal(a.state.from, "typed"); near(a.state.amount, 90);
  const page = withPay((q) => { q.taxes = { ...(q.taxes ?? {}), withholding: { self: { perPaycheck: 250, period: "biweekly" } } }; });
  assert.equal(ana(compute(page, { today: TODAY })).federal.from, "withholding");
  const pa = withPay((q) => { q.household.state = "PA"; });
  const b = ana(compute(pa, { today: TODAY }));
  // Pennsylvania taxes pay before the 401(k) comes off
  assert.equal(b.state.from, "rate"); near(b.state.rate, 0.0307); near(b.wages.state, 3900); near(b.state.amount, 0.0307 * 3900);
});

test("the employer's part: the match from the plan's contributions, its own Social Security and Medicare", () => {
  const a = ana(compute(familyPlan(TODAY), { today: TODAY }));
  const match = familyPlan(TODAY).retirement.contributions.filter((c) => c.personId === "p-ana").reduce((t, c) => t + (Number(c.employerMatch) || 0), 0);
  near(a.employer.match, match / 26); near(a.employer.payroll, (PAYROLL.ss + PAYROLL.medicare) * 3900);
});

test("paychecks: the Income page's period, typed, or 26 assumed for yearly pay; a Roth 401(k) after tax", () => {
  const p = withPay((q) => { q.income.find((x) => x.id === "i-bo").period = "annual"; q.income.find((x) => x.id === "i-bo").amount = 62400; q.whatIfs = { paycheck: { "p-ana": { paychecks: 24, roth: 100 } } }; });
  const d = compute(p, { today: TODAY });
  assert.equal(bo(d).paychecksFrom, "assumed"); assert.equal(bo(d).paychecks, 26); near(bo(d).gross, 62400 / 26);
  const a = ana(d);
  assert.equal(a.paychecks, 24); near(a.gross, 3900 * 26 / 24);
  const roth = a.aftertax.find((x) => x.key === "roth");
  near(roth.amount, 100); near(a.wages.federal, a.gross - a.pretaxTotal);
});

test("not ready without pay; pay not linked to anyone", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).why, "no-pay");
  const p = withPay((q) => { q.income.forEach((x) => { if (x.type === "salary") x.personId = ""; }); });
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.why, "no-person");
});
