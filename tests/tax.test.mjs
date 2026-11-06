// tests/tax.test.mjs -- the federal tax engine against hand-worked 2025 cases (brackets and
// deductions from the IRS's 2025 figures via UsTaxes; the Social Security worksheet by hand).
import test from "node:test";
import assert from "node:assert/strict";
import { FEDERAL } from "../modules/taxes/federal/data/federal.js";
import { federalTax, taxOnOrdinary, taxOnQualified, taxableSocialSecurity, standardDeduction, paramsFor, marginalRate, roomUnder, bracketTop, bracketsFor, careCreditRate, careCredit, careStep } from "../core/math/tax.js";

const P = FEDERAL[2025];
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("2025 tables carry the IRS figures", () => {
  assert.deepEqual(P.status.single.brackets, [11925, 48475, 103350, 197300, 250525, 626350]);
  assert.equal(P.status.married_joint.standardDeduction, 31500);
  assert.equal(P.status.single.extraAllowance, 2000);
  assert.equal(P.status.married_joint.extraAllowance, 1600);
  assert.deepEqual(P.status.single.ltcgBrackets, [48350, 533400]);
  assert.equal(P.ssWageBase, 176100);
  assert.equal(P.seniorDeduction.perPerson, 6000);
  assert.equal(FEDERAL[2024].status.single.standardDeduction, 14600);
  assert.equal(FEDERAL[2026].status.married_joint.standardDeduction, 32200);
});

test("single, 60,000 of wages: 5,071.50 of tax, in the 12% bracket with 4,225 of room", () => {
  const r = federalTax({ filingStatus: "single", wages: 60000 }, P);
  assert.equal(r.deduction.amount, 15750);
  assert.equal(r.taxableIncome, 44250);
  near(r.incomeTax, 1192.5 + 0.12 * 32325);
  near(r.totalTax, 5071.5);
  assert.equal(r.bracketRate, 0.12); assert.equal(r.roomInBracket, 4225); assert.equal(r.nextRate, 0.22);
  near(r.effectiveRate, 5071.5 / 60000, 1e-9);
  near(marginalRate({ filingStatus: "single", wages: 60000 }, P), 0.12, 1e-9);
});

test("married, 150,000 of wages and 20,000 of qualified dividends: gains stack on top at 15%", () => {
  const r = federalTax({ filingStatus: "married_joint", wages: 150000, qualifiedIncome: 20000 }, P);
  assert.equal(r.taxableIncome, 138500); assert.equal(r.ordinaryTaxable, 118500); assert.equal(r.qualifiedTaxable, 20000);
  near(r.ordinaryTax, 2385 + 8772 + 4741);
  near(r.qualifiedTax, 3000);
  near(r.totalTax, 18898);
  assert.equal(r.niit, 0);
});

test("qualified income inside the 0% band pays nothing", () => {
  const r = federalTax({ filingStatus: "single", qualifiedIncome: 40000 }, P);
  assert.equal(r.taxableIncome, 24250); assert.equal(r.qualifiedTaxable, 24250);
  assert.equal(r.totalTax, 0);
  const q = taxOnQualified(30000, 40000, "single", P);   // 18,350 at 0%, the rest at 15%
  near(q.tax, 0.15 * (70000 - 48350));
  assert.equal(q.layers.length, 2);
});

test("Social Security worksheet: 30,000 of benefits with a 20,000 pension -> 5,350 taxable; senior deduction and age allowance apply", () => {
  near(taxableSocialSecurity(30000, 20000, 0, "single", P), 5350);
  assert.equal(taxableSocialSecurity(30000, 5000, 0, "single", P), 0);          // provisional 20,000 < 25,000
  // filing separately and living together: no base amount, 85% of the provisional income up to 85% of the benefits
  // (IRC 86(c)(1)(C)(ii), (c)(2)(C); the 1040 worksheet's line 16 = 85% of line 8): 0.85 x (5,000 + 15,000) = 17,000
  assert.equal(P.ssTaxation.married_separate.base, 0);
  near(taxableSocialSecurity(30000, 5000, 0, "married_separate", P), 17000);
  near(taxableSocialSecurity(30000, 100000, 0, "married_separate", P), 25500);
  // a qualifying surviving spouse's return is not a joint return: the child credit phases out over $200,000 (IRC 24(b)(2));
  // wages 230,000 -> AGI 230,000: 30 x $50 = $1,500 off the 2025 table's $2,200, leaving $700
  assert.equal(P.childTaxCreditPhaseOut.qualifying_surviving, 200000);
  near(federalTax({ filingStatus: "qualifying_surviving", wages: 230000, dependentsUnder17: 1 }, P).credits.childTaxCredit, (P.childTaxCredit ?? 2000) - 1500);
  near(taxableSocialSecurity(30000, 100000, 0, "single", P), 25500);          // capped at 85%
  const r = federalTax({ filingStatus: "single", otherOrdinary: 20000, socialSecurity: 30000, ages65plus: 1 }, P);
  near(r.income.taxableSocialSecurity, 5350); near(r.agi, 25350);
  assert.equal(r.deduction.standard, 17750); assert.equal(r.deduction.senior, 6000); assert.equal(r.deduction.amount, 23750);
  assert.equal(r.taxableIncome, 1600); near(r.totalTax, 160);
  near(marginalRate({ filingStatus: "single", otherOrdinary: 20000, socialSecurity: 30000, ages65plus: 1 }, P), 0.185, 1e-6);   // every pension dollar drags 85 cents of benefits into tax
});

test("the senior deduction phases out at 6% over the threshold and disappears outside 2025-2028", () => {
  const r = federalTax({ filingStatus: "married_joint", otherOrdinary: 170000, ages65plus: 2 }, P);
  near(r.deduction.senior, 2 * (6000 - 0.06 * 20000));   // each person's 6,000 loses 6% of the excess (Schedule 1-A)
  assert.equal(federalTax({ filingStatus: "married_separate", otherOrdinary: 40000, ages65plus: 1 }, P).deduction.senior, 0, "married people only on a joint return");
  const p2024 = FEDERAL[2024];
  assert.equal(federalTax({ filingStatus: "single", otherOrdinary: 50000, ages65plus: 1 }, p2024).deduction.senior, 0);
  assert.equal(paramsFor(FEDERAL, 2030).seniorDeduction, undefined);
  assert.equal(paramsFor(FEDERAL, 2027).seniorDeduction.perPerson, 6000);
});

test("child tax credit: two children take 4,400 off a 6,543 bill; phased out $50 per 1,000 over 400,000", () => {
  const r = federalTax({ filingStatus: "married_joint", wages: 90000, dependentsUnder17: 2 }, P);
  near(r.incomeTax, 6543); assert.equal(r.credits.childTaxCredit, 4400); near(r.totalTax, 2143);
  const rich = federalTax({ filingStatus: "married_joint", wages: 450000, dependentsUnder17: 2 }, P);
  assert.equal(rich.credits.childTaxCredit, 4400 - 50 * 50);   // 50,000 over -> 50 steps
  const low = federalTax({ filingStatus: "single", wages: 20000, dependentsUnder17: 1 }, P);   // little tax: the rest comes back as the refundable part
  near(low.incomeTax, 425); assert.equal(low.credits.childTaxCredit, 425); near(low.credits.refundable, 1700); near(low.totalTax, -1700);
});

test("the refundable child tax credit: a business loss lowers the earned income it is figured on (Schedule 8812)", () => {
  const job = federalTax({ filingStatus: "single", wages: 12000, dependentsUnder17: 1 }, P);
  near(job.credits.refundable, 0.15 * (12000 - 2500));
  const loss = federalTax({ filingStatus: "single", wages: 12000, adjustments: 2000, selfEmployment: -2000, dependentsUnder17: 1 }, P);
  near(loss.credits.refundable, 0.15 * (10000 - 2500));
  const big = federalTax({ filingStatus: "single", wages: 12000, adjustments: 12000, selfEmployment: -15000, dependentsUnder17: 1 }, P);
  assert.equal(big.credits.refundable, 0, "earned income never below zero");
});

test("net investment income tax and the additional Medicare tax", () => {
  const r = federalTax({ filingStatus: "single", wages: 250000, qualifiedIncome: 50000 }, P);
  near(r.niit, 0.038 * 50000); near(r.additionalMedicare, 0.009 * 50000);
  assert.equal(federalTax({ filingStatus: "married_joint", wages: 240000 }, P).additionalMedicare, 0);
});

test("the additional Medicare tax is on Medicare wages (before 401(k) saving) when they are given", () => {
  const P = paramsFor(FEDERAL, 2026);
  // W-2 box 1 wages of 240,000 after a 20,000 401(k): box 5 Medicare wages are 260,000, 10,000 over the joint line
  near(federalTax({ filingStatus: "married_joint", wages: 240000, medicareWages: 260000 }, P).additionalMedicare, 0.009 * 10000);
  assert.equal(federalTax({ filingStatus: "married_joint", wages: 240000 }, P).additionalMedicare, 0, "without them, wages as before");
  // the income tax itself still uses box 1 wages
  near(federalTax({ filingStatus: "married_joint", wages: 240000, medicareWages: 260000 }, P).incomeTax, federalTax({ filingStatus: "married_joint", wages: 240000 }, P).incomeTax);
});

test("the 20% business deduction comes after AGI, at most 20% of taxable income less net capital gain", () => {
  const P = paramsFor(FEDERAL, 2026);
  // single, 60,000 of business income, standard deduction 16,100: 43,900 before it, so at most 8,780
  const a = federalTax({ filingStatus: "single", otherOrdinary: 60000, qbiDeduction: 10000 }, P);
  near(a.agi, 60000); near(a.deduction.qbi, 8780); near(a.taxableIncome, 43900 - 8780);
  near(federalTax({ filingStatus: "single", otherOrdinary: 60000, qbiDeduction: 5000 }, P).taxableIncome, 43900 - 5000);
  // taxable income all from qualified dividends: no room for it
  assert.equal(federalTax({ filingStatus: "single", otherOrdinary: 10000, qualifiedIncome: 150000, qbiDeduction: 2000 }, P).deduction.qbi, 0);
  // AGI, and so taxable Social Security, does not move
  const ss = { filingStatus: "single", ages65plus: 1, socialSecurity: 30000, otherOrdinary: 50000 };
  const b = federalTax({ ...ss, qbiDeduction: 4000 }, P), c = federalTax(ss, P);
  near(b.agi, c.agi); near(b.income.taxableSocialSecurity, c.income.taxableSocialSecurity); near(c.taxableIncome - b.taxableIncome, 4000);
  // the active-business minimum overrides the limit: 17,000 of income leaves 900, but the deduction is still 400
  near(federalTax({ filingStatus: "single", otherOrdinary: 17000, qbiDeduction: 300, qbiMinimum: 400 }, P).taxableIncome, 500);
  assert.equal(federalTax({ filingStatus: "single", otherOrdinary: 60000 }, P).deduction.qbi, 0, "nothing passed, nothing taken");
});

test("itemized deductions replace the standard one only when larger; withholding gives a balance", () => {
  const a = federalTax({ filingStatus: "single", wages: 80000, itemized: 12000 }, P);
  assert.equal(a.deduction.used, "standard");
  const b = federalTax({ filingStatus: "single", wages: 80000, itemized: 20000, withheld: 9000 }, P);
  assert.equal(b.deduction.used, "itemized"); assert.equal(b.taxableIncome, 60000);
  near(b.totalTax, 1192.5 + 0.12 * 36550 + 0.22 * 11525);
  near(b.balance, b.totalTax - 9000);
});

test("brackets, standard deduction helpers and the room under a bracket top", () => {
  const rows = bracketsFor("head_of_household", P);
  assert.equal(rows.length, 7); assert.equal(rows[0].to, 17000); assert.equal(rows[6].to, Infinity);
  assert.equal(standardDeduction("married_joint", P, { ages65plus: 2, blind: 1 }), 31500 + 3 * 1600);
  assert.equal(bracketTop(0.12, "single", P), 48475); assert.equal(bracketTop(0.37, "single", P), Infinity);
  near(taxOnOrdinary(0, "single", P).tax, 0);
  assert.equal(taxOnOrdinary(11925, "single", P).bracketRate, 0.1);
  assert.equal(roomUnder({ filingStatus: "single", otherOrdinary: 30000 }, P, 48475), 34225);
  // with benefits in the mix the room is smaller, because each conversion dollar also drags benefits into tax
  const room = roomUnder({ filingStatus: "married_joint", otherOrdinary: 20000, socialSecurity: 40000 }, P, 96950);
  const ti = federalTax({ filingStatus: "married_joint", otherOrdinary: 20000 + room, socialSecurity: 40000 }, P).taxableIncome;
  near(ti, 96950, 1);
});

test("years without a table are indexed from the latest one; unindexed thresholds stay", () => {
  const p = paramsFor(FEDERAL, 2030, { inflation: 0.02 });
  assert.equal(p.year, 2030); assert.equal(p.indexed, true);
  assert.equal(p.status.single.brackets[0], 13425);        // 12,400 x 1.02^4 = 13,422 -> nearest 25
  assert.equal(p.ssTaxation.single.base, 25000);
  assert.equal(p.niitThreshold.single, 200000);
  assert.equal(paramsFor(FEDERAL, 2025).indexed, false);
  assert.equal(paramsFor(FEDERAL, 2010).status.single.standardDeduction, 14600);   // before the first table: the first table as is
});

test("married filing separately is two returns: each spouse's tax on their own, added (Pub. 501); one itemizing makes both (IRC 63(c)(6)(A))", () => {
  const P = paramsFor(FEDERAL, 2026);
  const ana = { personId: "a", name: "Ana", wages: 120000 }, bo = { personId: "b", name: "Bo", wages: 30000 };
  const alone = (x) => federalTax({ ...x, filingStatus: "married_separate" }, P).totalTax;
  const two = federalTax({ filingStatus: "married_separate", wages: 150000, separate: [ana, bo] }, P);
  assert.equal(two.separate.length, 2);
  assert.equal(two.totalTax, Math.round((alone(ana) + alone(bo)) * 100) / 100);
  assert.equal(two.deduction.standard, 2 * 16100);
  // one combined return at the separate rates would tax 133,900 through one set of brackets: more
  assert.ok(federalTax({ filingStatus: "married_separate", wages: 150000 }, P).totalTax > two.totalTax + 1000);
  // a figure added on top of the parts (the next dollar, a typed amount) lands on the named spouse's return, else the first
  const more = federalTax({ filingStatus: "married_separate", wages: 160000, separate: [ana, bo], separateTo: "b" }, P);
  assert.equal(more.separate[1].income.wages, 40000); assert.equal(more.separate[0].income.wages, 120000);
  const first = federalTax({ filingStatus: "married_separate", wages: 160000, separate: [ana, bo] }, P);
  assert.equal(first.separate[0].income.wages, 130000);
  // Ana itemizes 25,000; Bo's 2,000 of itemized deductions must then be his deduction, not the 16,100 standard one
  const it = federalTax({ filingStatus: "married_separate", wages: 150000, separate: [{ ...ana, itemized: 25000 }, { ...bo, itemized: 2000 }] }, P);
  assert.equal(it.separate[0].deduction.used, "itemized"); assert.equal(it.separate[1].deduction.used, "itemized");
  assert.equal(it.separate[1].deduction.amount, 2000); assert.equal(it.deduction.amount, 27000);
  // with no parts, or another status, it is one return as before
  assert.equal(federalTax({ filingStatus: "married_joint", wages: 150000, separate: [ana, bo] }, P).separate, undefined);
});

// --- the child and dependent care credit (IRC 21, Form 2441; sources read 2026-11-02 in core/math/tax.js) -------------
const P26 = FEDERAL[2026], P25 = FEDERAL[2025];
const jo = (care, extra = {}) => ({ filingStatus: "head_of_household", wages: 62000, dependentsUnder17: 1, care: { expenses: 10800, persons: 1, benefits: 0, earnedLow: 62000, ...care }, ...extra });

test("care credit, worked example A: head of household, 62,000, one child of 4, 10,800 of daycare, no FSA", () => {
  // 2026: line 3 = min(10,800, 3,000) = 3,000; line 6 = min(3,000, 62,000) = 3,000; line 8: 62,000 is in the
  // 43,000-75,000 band of the other-filers column, .35; line 9a = 3,000 x .35 = 1,050. Tax: 62,000 - 24,150 = 37,850
  // taxable; 1,770 + 12% x 20,150 = 4,188, more than 1,050, so all of it counts. 4,188 - 2,200 child credit - 1,050 = 938.
  const r = federalTax(jo(), P26);
  near(r.incomeTax, 4188); near(r.credits.careCredit, 1050); near(r.credits.childTaxCredit, 2200); near(r.totalTax, 938);
  assert.equal(r.credits.care.rate, 0.35); assert.equal(r.credits.care.base, 3000);
  // 2025 (the old law): over 43,000 the rate is .20, so 3,000 x .20 = 600. Tax: 62,000 - 23,625 = 38,375 taxable;
  // 1,700 + 12% x 21,375 = 4,265; 4,265 - 2,200 - 600 = 1,465.
  const o = federalTax(jo(), P25);
  near(o.incomeTax, 4265); near(o.credits.careCredit, 600); near(o.totalTax, 1465);
});

test("care credit, worked example B: the same household with 5,000 through a dependent care FSA gets none", () => {
  // Form 2441 line 29: 3,000 - 5,000 excluded = -2,000, stop. Both years (the 2025 exclusion limit, 5,000, also fits).
  for (const P of [P26, P25]) assert.equal(federalTax(jo({ benefits: 5000 }), P).credits.careCredit, 0);
  // the 62,000 before the FSA: AGI and earned income 57,000, still .35 in 2026, still none
  assert.equal(federalTax(jo({ benefits: 5000, earnedLow: 57000 }, { wages: 57000 }), P26).credits.careCredit, 0);
});

test("care credit, worked example C: married filing jointly, 160,000, two children, 14,000 of care, lower earner 50,000", () => {
  // line 3 = min(14,000, 6,000) = 6,000; line 6 = min(6,000, 110,000, 50,000) = 6,000. 2026 rate: 35 less one point per
  // 4,000 (or part) over 150,000: 10,000 over -> ceil(2.5) = 3 points -> .32 (the table's 158,000-162,000 row);
  // 6,000 x .32 = 1,920. Tax: 160,000 - 32,200 = 127,800; 11,600 + 22% x 27,000 = 17,540. 17,540 - 1,920 - 4,400 = 11,220.
  const c = { filingStatus: "married_joint", wages: 160000, dependentsUnder17: 2, care: { expenses: 14000, persons: 2, benefits: 0, earnedLow: 50000 } };
  const r = federalTax(c, P26);
  near(r.incomeTax, 17540); near(r.credits.careCredit, 1920); near(r.totalTax, 11220);
  // 2025: .20 over 43,000: 6,000 x .20 = 1,200. Tax: 160,000 - 31,500 = 128,500; 2,385 + 8,772 + 22% x 31,550 = 18,098.
  const o = federalTax(c, P25);
  near(o.incomeTax, 18098); near(o.credits.careCredit, 1200); near(o.totalTax, 18098 - 1200 - 4400);
});

test("care credit: the percentage on and one dollar over every step of the IRS tables", () => {
  // the 2026 draft Form 2441 instructions' "2026 Phaseout Schedule" (each row: over, but not over, decimal), written out row
  // by row: married filing jointly from 150,000 by 4,000; any other status from 75,000 by 2,000
  const lower = [[0, 15000, 0.5]];
  for (let i = 0; i < 14; i++) lower.push([15000 + 2000 * i, 17000 + 2000 * i, 0.49 - 0.01 * i]);   // 15,000-17,000 .49 ... 41,000-43,000 .36
  const joint = [...lower, [43000, 150000, 0.35]], other = [...lower, [43000, 75000, 0.35]];
  for (let i = 0; i < 14; i++) { joint.push([150000 + 4000 * i, 154000 + 4000 * i, 0.34 - 0.01 * i]); other.push([75000 + 2000 * i, 77000 + 2000 * i, 0.34 - 0.01 * i]); }
  joint.push([206000, Infinity, 0.2]); other.push([103000, Infinity, 0.2]);
  assert.deepEqual(joint.at(-2).slice(0, 2), [202000, 206000]); assert.deepEqual(other.at(-2).slice(0, 2), [101000, 103000]);   // the .21 rows
  for (const [rows, statuses] of [[joint, ["married_joint"]], [other, ["single", "head_of_household", "qualifying_surviving"]]]) {
    for (const s of statuses) for (const [over, notOver, dec] of rows) {
      if (over > 0) near(careCreditRate(over + 1, s, P26), dec, 1e-9);           // one dollar over the row's start
      if (Number.isFinite(notOver)) near(careCreditRate(notOver, s, P26), dec, 1e-9);   // exactly on its end
    }
  }
  near(careCreditRate(1e7, "married_joint", P26), 0.2, 1e-9);
  // 2025 Form 2441 line 8: $0-15,000 .35, one point less per 2,000 to "43,000-No limit .20", every status
  near(careCreditRate(15000, "married_joint", P25), 0.35, 1e-9); near(careCreditRate(15001, "married_joint", P25), 0.34, 1e-9);
  near(careCreditRate(17000, "single", P25), 0.34, 1e-9); near(careCreditRate(17001, "single", P25), 0.33, 1e-9);
  near(careCreditRate(43000, "head_of_household", P25), 0.21, 1e-9); near(careCreditRate(43001, "head_of_household", P25), 0.2, 1e-9);
  near(careCreditRate(200000, "married_joint", P25), 0.2, 1e-9);
  // a qualifying surviving spouse is not a joint return: the other column (phase 2 from 75,000)
  near(careCreditRate(75001, "qualifying_surviving", P26), 0.34, 1e-9); near(careCreditRate(75001, "married_joint", P26), 0.35, 1e-9);
  // 2024 runs on the same old law; a year past the tables keeps 2026's figures (the law does not index them)
  assert.deepEqual(FEDERAL[2024].careCredit, P25.careCredit);
  assert.deepEqual(paramsFor(FEDERAL, 2030).careCredit, P26.careCredit);
  assert.equal(P26.careCredit.benefitLimit, 7500); assert.equal(P26.careCredit.benefitLimitSeparate, 3750);
  assert.equal(P25.careCredit.benefitLimit, 5000); assert.equal(P25.careCredit.benefitLimitSeparate, 2500);
});

test("care credit: the limit after dependent care benefits, the limit for two or more, and expenses the FSA paid", () => {
  // 3,000 - 2,000 of FSA = 1,000 of limit (21(c) last sentence; line 29): 1,000 x .35 = 350
  near(federalTax(jo({ benefits: 2000 }), P26).credits.careCredit, 350);
  // only 2,500 of care and a 2,000 FSA: the FSA's 2,000 cannot count again (line 30), so 500 x .35 = 175, not 1,000 x .35
  near(federalTax(jo({ expenses: 2500, benefits: 2000 }), P26).credits.careCredit, 175);
  // two children: 6,000 even if all the care was for one of them (line 2, column (d)): 6,000 x .35 = 2,100;
  // 6,000 - 5,000 of FSA = 1,000: 350
  near(federalTax(jo({ persons: 2, expenses: 6000 }, { dependentsUnder17: 2 }), P26).credits.careCredit, 2100);
  near(federalTax(jo({ persons: 2, benefits: 5000 }, { dependentsUnder17: 2 }), P26).credits.careCredit, 350);
  // 7,500 through the FSA (the 2026 limit) leaves no credit for two children either
  assert.equal(federalTax(jo({ persons: 2, benefits: 7500 }, { dependentsUnder17: 2 }), P26).credits.careCredit, 0);
  // less care than the limit: all of it counts
  near(federalTax(jo({ expenses: 1200 }), P26).credits.careCredit, 1200 * 0.35);
  // an account passed in over the year's limit: only the limit is excluded (129(a)(2)(A), line 21), the rest is pay (line 26).
  // 2025, two children, 12,000 of care, 7,500 elected: 5,000 excluded, limit 6,000 - 5,000 = 1,000, care 12,000 - 5,000
  // = 7,000 -> 1,000 x .20 = 200 (the oracle's case; it gave 0 before the limit was applied in the engine)
  near(federalTax(jo({ persons: 2, expenses: 12000, benefits: 7500 }, { dependentsUnder17: 2 }), P25).credits.careCredit, 200);
  near(federalTax(jo({ persons: 2, expenses: 12000, benefits: 9000 }, { dependentsUnder17: 2 }), P26).credits.careCredit, 0);   // 2026: 7,500 > 6,000
});

test("care credit: careStep, the width over which the next dollar's cost is worked with the credit in play", () => {
  assert.equal(careStep("married_joint", P26), 4000); assert.equal(careStep("head_of_household", P26), 2000);
  assert.equal(careStep("married_joint", P25), 2000); assert.equal(careStep("single", { year: 2026 }), 0);
});

test("care credit: no more than the lower earned income (21(d)(1)); none without earned income", () => {
  // joint, 90,000 of wages, the lower earner made 1,800: 1,800 x .35 = 630. Tax: 90,000 - 32,200 = 57,800 taxable ->
  // 2,480 + 12% x 33,000 = 6,440, which takes all of it.
  const r = federalTax({ filingStatus: "married_joint", wages: 90000, dependentsUnder17: 1, care: { expenses: 8000, persons: 1, earnedLow: 1800 } }, P26);
  near(r.incomeTax, 6440); near(r.credits.care.base, 1800); near(r.credits.careCredit, 630);
  assert.equal(federalTax({ filingStatus: "married_joint", wages: 90000, care: { expenses: 8000, persons: 1, earnedLow: 0 } }, P26).credits.careCredit, 0);
});

test("care credit: not refundable, limited to the income tax, and taken before the child tax credit (Schedule 8812 Worksheet A)", () => {
  // tax already zero: 20,000 of wages under the 24,150 standard deduction -> no care credit, the child credit's refundable part as before
  const zero = federalTax(jo({ expenses: 6000, earnedLow: 20000 }, { wages: 20000 }), P26);
  assert.equal(zero.incomeTax, 0); assert.equal(zero.credits.careCredit, 0);
  near(zero.totalTax, federalTax({ ...jo({}, { wages: 20000 }), care: undefined }, P26).totalTax);
  // 30,000: rate 50 - ceil(15,000 / 2,000) = 42, 3,000 x .42 = 1,260 tentative; the tax is 585 (5,850 taxable at 10%), so
  // the care credit is 585 and the child credit's limit is 585 - 585 = 0: the 2,200 goes to its refundable part,
  // min(2,200, 1,700 a child, 15% of (30,000 - 2,500) = 4,125) = 1,700. Total -1,700 (the child credit first: -1,615).
  const low = federalTax(jo({ expenses: 3000, earnedLow: 30000 }, { wages: 30000 }), P26);
  near(low.incomeTax, 585); near(low.credits.care.tentative, 1260); near(low.credits.careCredit, 585);
  near(low.credits.childTaxCredit, 0); near(low.credits.refundable, 1700); near(low.totalTax, -1700);
  near(federalTax({ ...jo({}, { wages: 30000 }), care: undefined }, P26).totalTax, -1615);
  // the extra taxes are not offset: 3.8% on investment income stays whole
  const rich = federalTax({ filingStatus: "single", wages: 230000, qualifiedIncome: 20000, care: { expenses: 3000, persons: 1, earnedLow: 230000 } }, P26);
  near(rich.credits.careCredit, 600); near(rich.niit, 0.038 * 20000);
  near(rich.totalTax, rich.incomeTax - 600 + rich.niit + rich.additionalMedicare);
});

test("care credit: married filing separately gives none (21(e)(2)); two separate returns still add up", () => {
  assert.equal(federalTax(jo({}, { filingStatus: "married_separate" }), P26).credits.careCredit, 0);
  assert.equal(careCredit({ expenses: 10800, persons: 1, earnedLow: 62000 }, 62000, "married_separate", P26), null);
  const ana = { personId: "a", name: "Ana", wages: 62000, dependentsUnder17: 1 }, bo = { personId: "b", name: "Bo", wages: 30000 };
  const two = federalTax({ filingStatus: "married_separate", wages: 92000, separate: [ana, bo], care: { expenses: 10800, persons: 1, earnedLow: 30000 } }, P26);
  assert.equal(two.credits.careCredit, 0);
  near(two.totalTax, two.separate.reduce((s, x) => s + x.totalTax, 0));
  near(two.totalTax, federalTax({ filingStatus: "married_separate", wages: 92000, separate: [ana, bo] }, P26).totalTax);
});

test("care credit: absent, zero care or no qualifying person changes nothing", () => {
  const base = { filingStatus: "head_of_household", wages: 62000, dependentsUnder17: 1 };
  const plain = federalTax(base, P26);
  assert.equal(plain.credits.careCredit, 0); assert.equal(plain.credits.care, null);
  for (const care of [{ expenses: 0, persons: 1, earnedLow: 62000 }, { expenses: 10800, persons: 0, earnedLow: 62000 }, null]) {
    const r = federalTax({ ...base, care }, P26);
    assert.equal(r.totalTax, plain.totalTax); assert.equal(r.credits.careCredit, 0);
  }
  // tables without the figures (an old copy) give none rather than fail
  const { careCredit: _drop, ...noCare } = P26;
  assert.equal(federalTax({ ...base, care: { expenses: 10800, persons: 1, earnedLow: 62000 } }, noCare).credits.careCredit, 0);
});
