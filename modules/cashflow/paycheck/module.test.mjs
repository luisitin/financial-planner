import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, withholdFederal, w4StatusFor, hundred, PAYROLL } from "./compute.js";
import { FEDERAL } from "../../taxes/federal/data/federal.js";
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
  // the tables start where the standard deduction (less line 1g) or half of it runs out: ties them to the year's figures
  const F = FEDERAL[2026].status;
  assert.equal(T.standard.married_joint[1].from, F.married_joint.standardDeduction - T.step1g.married_joint);
  assert.equal(T.standard.single[1].from, F.single.standardDeduction - T.step1g.other);
  assert.equal(T.standard.head_of_household[1].from, F.head_of_household.standardDeduction - T.step1g.other);
  for (const s of ["married_joint", "single", "head_of_household"]) assert.equal(T.checkbox[s][1].from, F[s].standardDeduction / 2);
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
  // line 1i to the cent: 415.03 x 260 + 1,030.20 is 108,938.00, the start of a row, not a floating-point hair below it
  const edge = withholdFederal(415.03, 260, { status: "single", step2: true, otherIncome: 1030.2 }, 2026);
  assert.equal(edge.adjusted, 108938); near(edge.tentative, 20512);
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
  assert.equal(a.shares.net + a.shares.taxes + a.shares.saved + a.shares.benefits, 100);
  assert.equal(a.shares.saved, Math.round(100 * k.amount / 3900)); assert.equal(a.shares.taxes, Math.round(100 * a.taxesTotal / 3900));
  near(bo(d).gross, 5200); assert.equal(bo(d).paychecks, 12);
  // nothing typed: the note says the W-4s are assumed; typed, it says so as a fact
  assert.ok(d.notes.some((n) => /assume both W-4s say "Married filing jointly"/.test(n)));
  const typed = compute(withPay((q) => { q.whatIfs = { paycheck: { "p-ana": { w4Status: "married_joint" }, "p-bo": { w4Status: "married_joint" } } }; }), { today: TODAY });
  assert.ok(typed.notes.some((n) => /You both have "Married filing jointly"/.test(n)));
  assert.equal(a.state.from, "no-tax", "Texas has no income tax"); assert.equal(a.state.amount, 0);
});

test("whole-dollar shares of $100 always add up to 100 (largest remainder)", () => {
  assert.deepEqual(hundred({ a: 14.4, b: 12.4, c: 0.6, d: 72.6 }, 100), { a: 14, b: 12, c: 1, d: 73 });
  assert.deepEqual(hundred({ a: 1, b: 1, c: 1 }, 3), { a: 34, b: 33, c: 33 });
});

test("health cover, the HSA, the FSAs and commuting come off before every tax; Benefits elections for this year fill the gaps", () => {
  // in June the Benefits elections page plans this year, so its choices count
  const JUNE = "2026-06-15";
  const p = withPay((q) => { q.whatIfs = { paycheck: { "p-ana": { health: 120 } }, benefits: { "p-ana": { fsaElect: 2600, dcfsaElect: 5200, transitMonthly: 130 } } }; });
  const a = ana(compute(p, { today: JUNE }));
  const k = a.pretax.find((x) => x.key === "k401").amount;
  const caf = 120 + 2600 / 26 + 5200 / 26 + 130 * 12 / 26;
  near(a.pretaxTotal, k + caf); near(a.wages.fica, 3900 - caf); near(a.wages.federal, 3900 - k - caf);
  assert.equal(a.pretax.find((x) => x.key === "fsa").from, "plan"); assert.equal(a.pretax.find((x) => x.key === "health").from, "typed");
  // the elections are capped by the Benefits elections page's limits (2026: health FSA 3,400, child care 7,500, transit 340 a month)
  const big = withPay((q) => { q.whatIfs = { benefits: { "p-ana": { fsaElect: 5000, dcfsaElect: 9000, transitMonthly: 500 } } }; });
  const b = ana(compute(big, { today: JUNE }));
  near(b.pretax.find((x) => x.key === "fsa").amount, 3400 / 26); near(b.pretax.find((x) => x.key === "dcfsa").amount, 7500 / 26); near(b.pretax.find((x) => x.key === "commuter").amount, 340 * 12 / 26);
  // from October that page plans next year: left out, with a note
  const oct = compute(big, { today: TODAY });
  assert.equal(ana(oct).pretax.some((x) => x.key === "fsa"), false); assert.ok(oct.notes.some((n) => /next year's benefits/.test(n)));
});

test("the HSA and FSA page's figures are the first adult's; an HSA is state pay in California", () => {
  const p = withPay((q) => { q.taxes = { ...(q.taxes ?? {}), hsa: { coverage: "family", contribution: 2600, employer: 520, fsa: 1300 } }; });
  const a = ana(compute(p, { today: TODAY }));
  near(a.pretax.find((x) => x.key === "hsa").amount, 100); near(a.pretax.find((x) => x.key === "fsa").amount, 50); near(a.employer.hsa, 20);
  assert.equal(bo(compute(p, { today: TODAY })).pretax.some((x) => x.key === "hsa"), false);
  const ca = withPay((q) => { q.household.state = "CA"; q.taxes = { ...(q.taxes ?? {}), hsa: { contribution: 2600 }, state: { rate: 0.05 } }; });
  const c = ana(compute(ca, { today: TODAY }));
  near(c.wages.state, c.wages.federal + 100);
});

test("Social Security stops at the wage base; the 0.9% starts above $200,000; the year's take-home counts both", () => {
  const p = withPay((q) => { q.income.find((x) => x.id === "i-ana").amount = 10000; q.retirement.contributions = []; });   // 260,000 a year
  const a = ana(compute(p, { today: TODAY }));
  assert.equal(a.ssStopsAfter, Math.ceil(184500 / 10000)); assert.equal(a.extraMedicareFrom, Math.floor(200000 / 10000) + 1);
  near(a.yearly.ss, 0.062 * 184500); near(a.yearly.medicare, 0.0145 * 260000 + 0.009 * 60000);
  near(a.yearly.net, a.net * 26 + (a.ss * 26 - 0.062 * 184500) - 0.009 * 60000);
  near(a.monthly, a.yearly.net / 12);
  // a year whose pay lands exactly on the wage base at its last paycheck: that paycheck reaches it (the page says nothing,
  // as nothing stops early); exactly $200,000 is not above it
  const exact = ana(compute(withPay((q) => { const i = q.income.find((x) => x.id === "i-ana"); i.amount = 15375; i.period = "monthly"; q.retirement.contributions = []; }), { today: TODAY }));
  assert.equal(exact.ssStopsAfter, 12); near(exact.yearly.ss, 0.062 * 184500);
  const flat = ana(compute(withPay((q) => { const i = q.income.find((x) => x.id === "i-ana"); i.amount = 200000 / 8; i.period = "monthly"; q.retirement.contributions = []; }), { today: TODAY }));
  assert.equal(flat.extraMedicareFrom, 9, "200,000 reached at paycheck 8 exactly: the 0.9% starts with the 9th");
});

test("two jobs: each employer counts Social Security to the wage base and the 0.9% on its own pay", () => {
  const p = withPay((q) => { q.retirement.contributions = []; q.income.find((x) => x.id === "i-ana").amount = 110000 / 26; q.income.push({ id: "i-ana2", name: "Second job", type: "salary", personId: "p-ana", amount: 110000 / 26, period: "biweekly", growth: 0, taxable: true }); });
  const a = ana(compute(p, { today: TODAY }));
  assert.equal(a.jobs, 2); assert.equal(a.ssStopsAfter, null); assert.equal(a.extraMedicareFrom, null);
  near(a.yearly.ss, 0.062 * 220000, 0.01); near(a.yearly.medicare, 0.0145 * 220000, 0.01);
});

test("the pay stub's federal figure wins, then the W-4 typed here, then the Withholding check page's for the same paychecks", () => {
  const p = withPay((q) => { q.taxes = { ...(q.taxes ?? {}), withholding: { self: { perPaycheck: 250, period: "monthly" } } }; });
  assert.equal(ana(compute(p, { today: TODAY })).federal.from, "estimate", "12 a year on that page, 26 here: not the same paychecks");
  const w4 = withPay((q) => { q.taxes = { ...(q.taxes ?? {}), withholding: { self: { perPaycheck: 250, period: "biweekly" } } }; q.whatIfs = { paycheck: { "p-ana": { step2: true } } }; });
  const a = ana(compute(w4, { today: TODAY }));
  assert.equal(a.federal.from, "estimate"); assert.equal(a.federal.period, "biweekly"); near(a.federal.onPage, 250); assert.equal(a.federal.onPageMatches, true);
});

test("the state: the State page's tax as a share of income (after its allowances), as typed, or none", () => {
  const co = withPay((q) => { q.household.state = "CO"; });
  const d = compute(co, { today: TODAY }), a = ana(d);
  assert.ok(a.state.rate > 0 && a.state.rate < 0.044, `Colorado's 4.4% less its allowance: ${a.state.rate}`);
  near(a.state.amount, a.state.rate * a.wages.state);
  const typed = withPay((q) => { q.household.state = "CA"; q.whatIfs = { paycheck: { "p-ana": { state: 150 }, "p-bo": { state: 210 } } }; });
  const t = compute(typed, { today: TODAY });
  assert.equal(t.notes.some((n) => /state's income tax is not counted/.test(n)), false);
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
  assert.equal(b.state.from, "rate"); near(b.wages.state, 3900); near(b.state.amount, b.state.rate * 3900);
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
  assert.ok(d.notes.some((n) => /Bo's pay is entered as a yearly figure/.test(n)));
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
  const kid = withPay((q) => { q.income.forEach((x) => { if (x.type === "salary") x.personId = "p-cy"; }); });
  assert.equal(compute(kid, { today: TODAY }).why, "no-person", "pay linked to a child counts as no adult's");
});

test("each adult's own health FSA from the HSA and FSA page comes off their own paycheck (fsa for Me, fsaPartner for the other)", () => {
  const p = familyPlan("2026-10-30"); p.taxes.hsa = { ...(p.taxes.hsa ?? {}), fsa: 1300, fsaPartner: 2400 };
  const d = compute(p, { today: "2026-10-30" });
  const fsaOf = (name) => d.people.find((x) => x.name === name).pretax.find((y) => y.key === "fsa").amount;
  assert.equal(fsaOf("Ana"), 1300 / 26); assert.equal(fsaOf("Bo"), 2400 / 12);   // Ana is paid every two weeks, Bo monthly
});
