// tests/golden-business.test.mjs -- career/business (a sole proprietor's tax, an S corporation, the self-employed
// retirement plans' limits) against an answer key worked independently from the IRS forms and the statute
// (tools/golden_business, tests/golden/business/RULES.md), never from this repo's code. Each row is fed to the page's
// own functions the way compute() does: the household's federal inputs without the business, the owner's wages for
// the Social Security wage base, the household's Medicare wages for the 0.9%. Money must agree within $1.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { FEDERAL } from "../modules/taxes/federal/data/federal.js";
import { paramsFor, federalTax } from "../core/math/tax.js";
import { seTax } from "../modules/taxes/self-employment/compute.js";
import { maximumEarnings } from "../modules/retirement/social-security/compute.js";
import { LIMITS } from "../modules/retirement/contributions/data/limits.js";
import { soleTax, scorpTax, planRooms } from "../modules/career/business/compute.js";
import { QBI_MINIMUM, forYear } from "../modules/career/business/data/business.js";

const read = (name) => toObjects(parseCsv(fs.readFileSync(new URL(`./golden/business/${name}`, import.meta.url), "utf8")));
const num = (v) => Number(v) || 0;
const near = (a, b, what, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${what}: app ${a} vs key ${b}`);
const fedOnly = (r) => r.totalTax - r.additionalMedicare;
const household = (row, ownerWages) => {
  const wages = ownerWages + num(row.other_wages);
  return { filingStatus: row.filing_status, wages, medicareWages: wages, otherOrdinary: 0, qualifiedIncome: num(row.qualified_dividends), investmentIncome: num(row.qualified_dividends), dependentsUnder17: num(row.kids_under_17), otherDependents: 0, ages65plus: 0, adjustments: 0 };
};

const sole = read("sole.csv");
test(`the answer key has sole proprietor rows (${sole.length})`, () => assert.ok(sole.length >= 1000));
for (const row of sole) {
  test(`sole proprietor ${row.case_id}`, () => {
    const year = num(row.year), P = paramsFor(FEDERAL, year), inputs = household(row, num(row.owner_wages));
    const r = soleTax(num(row.profit), { inputs, params: P, otherSE: 0, wages: num(row.owner_wages), medicareWages: inputs.medicareWages, wageBase: maximumEarnings(year), health: num(row.health_premiums), retirement: num(row.retirement), qbiMinimum: forYear(QBI_MINIMUM, year) });
    near(r.se.total, num(row.se_tax), "self-employment tax"); near(r.se.half, num(row.se_half), "half of it");
    near(r.healthOff, num(row.sehi), "health insurance"); near(r.qbi, num(row.qbi), "20% deduction");
    near(r.agi, num(row.agi_with), "AGI"); near(r.taxable - r.qbi, num(row.taxable_income_with), "taxable income");
    near(r.income, num(row.tax_with), "income tax with the business"); near(fedOnly(federalTax(inputs, P)), num(row.tax_without), "income tax without it");
    near(r.extra, num(row.addl_medicare_se), "0.9% on self-employment income");
  });
}

const scorp = read("scorp.csv");
test(`the answer key has S corporation rows (${scorp.length})`, () => assert.ok(scorp.length >= 500));
for (const row of scorp) {
  test(`S corporation ${row.case_id}`, () => {
    const year = num(row.year), P = paramsFor(FEDERAL, year), inputs = household(row, num(row.owner_other_wages));
    const c = scorpTax(num(row.profit), num(row.salary), num(row.costs), { inputs, params: P, otherSE: 0, wages: num(row.owner_other_wages), medicareWages: inputs.medicareWages, wageBase: maximumEarnings(year), health: num(row.health_premiums), qbiMinimum: forYear(QBI_MINIMUM, year) });
    near(c.employer, num(row.employer_tax), "employer's payroll tax"); near(c.employee, num(row.employee_tax), "owner's payroll tax");
    near(c.passed, num(row.passed), "passed through"); near(c.healthOff, num(row.sehi), "health insurance"); near(c.qbi, num(row.qbi), "20% deduction");
    near(c.income, num(row.tax_with), "income tax with it"); near(fedOnly(federalTax(inputs, P)), num(row.tax_without), "income tax without it");
  });
}

const plans = read("plans.csv");
test(`the answer key has retirement plan rows (${plans.length})`, () => assert.ok(plans.length >= 500));
for (const row of plans) {
  test(`retirement plans ${row.case_id}`, () => {
    const year = num(row.year), profit = num(row.profit);
    const half = seTax(profit, { wages: num(row.owner_wages), wageBase: maximumEarnings(year) }).half;
    near(half, num(row.se_half), "half the self-employment tax");
    const limit = (LIMITS[year] ?? LIMITS[2026]).kinds["401k"].limit;
    const R = planRooms({ profit, seHalf: half, age: num(row.age), deferralLeft: Math.max(0, limit - num(row.job_deferrals)), year });
    near(R.earned, num(row.earned), "earnings"); near(R.sep, num(row.sep_max), "SEP-IRA"); near(R.solo, num(row.solo_max), "solo 401(k)");
    near(R.simpleComp, num(row.simple_comp), "SIMPLE pay"); near(R.simple, num(row.simple_max), "SIMPLE IRA");
  });
}
