// tests/tax.test.mjs -- the federal tax engine against hand-worked 2025 cases (brackets and
// deductions from the IRS's 2025 figures via UsTaxes; the Social Security worksheet by hand).
import test from "node:test";
import assert from "node:assert/strict";
import { FEDERAL } from "../modules/taxes/federal/data/federal.js";
import { federalTax, taxOnOrdinary, taxOnQualified, taxableSocialSecurity, standardDeduction, paramsFor, marginalRate, roomUnder, bracketTop, bracketsFor } from "../core/math/tax.js";

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
  near(taxableSocialSecurity(30000, 100000, 0, "single", P), 25500);          // capped at 85%
  const r = federalTax({ filingStatus: "single", otherOrdinary: 20000, socialSecurity: 30000, ages65plus: 1 }, P);
  near(r.income.taxableSocialSecurity, 5350); near(r.agi, 25350);
  assert.equal(r.deduction.standard, 17750); assert.equal(r.deduction.senior, 6000); assert.equal(r.deduction.amount, 23750);
  assert.equal(r.taxableIncome, 1600); near(r.totalTax, 160);
  near(marginalRate({ filingStatus: "single", otherOrdinary: 20000, socialSecurity: 30000, ages65plus: 1 }, P), 0.185, 1e-6);   // every pension dollar drags 85 cents of benefits into tax
});

test("the senior deduction phases out at 6% over the threshold and disappears outside 2025-2028", () => {
  const r = federalTax({ filingStatus: "married_joint", otherOrdinary: 170000, ages65plus: 2 }, P);
  near(r.deduction.senior, 12000 - 0.06 * 20000);
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

test("net investment income tax and the additional Medicare tax", () => {
  const r = federalTax({ filingStatus: "single", wages: 250000, qualifiedIncome: 50000 }, P);
  near(r.niit, 0.038 * 50000); near(r.additionalMedicare, 0.009 * 50000);
  assert.equal(federalTax({ filingStatus: "married_joint", wages: 240000 }, P).additionalMedicare, 0);
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
