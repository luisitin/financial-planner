// tests/golden-paycheck.test.mjs -- cashflow/paycheck (federal withholding by IRS Publication 15-T 2026's Worksheet 1A,
// and Social Security and Medicare over the year) against an answer key worked independently from the publications
// (tools/golden_paycheck, tests/golden/paycheck/RULES.md), never from this repo's code. Withholding rows go to the
// page's own `withholdFederal`; payroll rows to its `compute` on a one-job plan. Money must agree to the cent.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { withholdFederal, compute, PERIOD_OF } from "../modules/cashflow/paycheck/compute.js";
import { emptyPlan } from "../core/schema/migrate.js";

const read = (name) => toObjects(parseCsv(fs.readFileSync(new URL(`./golden/paycheck/${name}`, import.meta.url), "utf8")));
const num = (v) => Number(v) || 0;
const near = (a, b, what, tol = 0.011) => assert.ok(Math.abs(a - b) <= tol, `${what}: app ${a} vs key ${b}`);
const blankOr = (v) => (v === "" || v === undefined || v === null ? null : Number(v));

const withholding = read("withholding.csv");
test(`the answer key has withholding rows (${withholding.length})`, () => assert.ok(withholding.length >= 1000));
for (const row of withholding) {
  test(`withholding ${row.case_id}`, () => {
    const r = withholdFederal(num(row.wages), num(row.paychecks), { status: row.w4_status, step2: row.step2 === "1", credits: num(row.step3_credits), otherIncome: num(row.step4a_other), deductions: num(row.step4b_deductions), extra: num(row.step4c_extra) }, num(row.year));
    near(r.adjusted, num(row.adjusted_annual), "adjusted annual wage (line 1i)");
    near(r.tentative, num(row.tentative_annual), "tentative annual withholding (table)");
    near(r.perCheck, num(row.withholding), "withholding a paycheck (line 4b)");
  });
}

const payroll = read("payroll.csv");
test(`the answer key has payroll rows (${payroll.length})`, () => assert.ok(payroll.length >= 500));
for (const row of payroll) {
  test(`payroll ${row.case_id}`, () => {
    const plan = emptyPlan();
    plan.household.people = [{ id: "p1", name: "Pat", role: "self", birthDate: "1985-04-01" }];
    plan.household.filingStatus = "single"; plan.household.state = "TX";
    plan.income = [{ id: "job", name: "Pay", type: "salary", personId: "p1", amount: num(row.wages), period: PERIOD_OF[num(row.paychecks)], taxable: true }];
    const d = compute(plan, { today: `${row.year}-06-01` });
    assert.ok(d.ready, "the page is ready with one salary");
    const p = d.people[0];
    assert.equal(p.paychecks, num(row.paychecks));
    near(p.yearly.ss, num(row.ss_year), "Social Security over the year");
    near(p.yearly.medicare, num(row.medicare_year), "Medicare over the year, with the 0.9% above $200,000");
    assert.equal(p.ssStopsAfter, blankOr(row.ss_last_paycheck), "the last paycheck with Social Security");
    assert.equal(p.extraMedicareFrom, blankOr(row.extra_medicare_first_paycheck), "the first paycheck with the 0.9%");
  });
}
