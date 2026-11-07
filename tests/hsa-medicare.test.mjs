// Round 8 follow-up F1/Q1: Medicare ends HSA saving (IRC 223(b)(7), Pub. 969), no payroll tax is saved without wages,
// and the HSA page works the saving on the Federal estimate's own return. Invented households only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute } from "../modules/taxes/hsa-fsa/compute.js";
import { compute as health } from "../modules/insurance/health/compute.js";
import { taxView } from "../modules/taxes/federal/known.js";
import { withoutHsaPayroll } from "../modules/taxes/hsa-fsa/compute.js";

const T = "2026-11-06";
const near = (a, b, tol = 0.011) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);

function planOf({ birth, pay = 0, ss = null, pension = 0, hsa = 4400, filing = "single" }) {
  const p = emptyPlan();
  p.household.filingStatus = filing;
  p.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: birth }];
  p.income = [];
  if (pay) p.income.push({ id: "pay", name: "Pay", type: "salary", personId: "a", amount: pay, period: "annual", growth: 0, taxable: true });
  if (pension) p.income.push({ id: "pen", name: "Pension", type: "pension", personId: "a", amount: pension, period: "annual", growth: 0, taxable: true });
  if (ss !== null) p.income.push({ id: "ss", name: "Social Security", type: "social", personId: "a", amount: 24000, period: "annual", growth: 0, startDate: ss, taxable: true });
  p.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "a" }];
  p.retirement.contributions = [];
  p.taxes.hsa = { coverage: "self", contribution: hsa, employer: 0, fsa: 0, fsaSpent: 0 };
  return p;
}

test("F1 widow, 74 and on Social Security: the HSA limit is 0, 4,400 typed is too much, nothing is saved", () => {
  const d = compute(planOf({ birth: "1952-03-15", ss: "", pension: 22800 }), { today: T });
  assert.equal(d.hsa.limit, 0);
  near(d.hsa.over, 4400); near(d.hsa.excess, 4400);
  assert.equal(d.hsa.deducted, 0);
  near(d.hsa.taxSaved, 0); near(d.hsa.ficaSaved, 0); near(d.hsa.savedTotal, 0);
  assert.ok(d.notes.some((n) => /^Ada is on Medicare \(people 65 or older who get Social Security are signed up for Medicare Part A\)\./.test(n) && /4,400 going into Ada's HSA is 4,400 too much/.test(n) && /Take it out/.test(n)), d.notes.join("|"));
});

test("F1 no wages, no payroll tax: a 50-year-old with a pension and no pay saves income tax only", () => {
  const d = compute(planOf({ birth: "1976-05-05", pension: 40000, hsa: 3000 }), { today: T });
  assert.equal(d.hsa.limit, 4400);
  assert.equal(d.hsa.ficaSaved, 0);
  assert.ok(d.hsa.taxSaved > 0);
  // with nothing on the Income page at all the old convention stays (7.65% of money kept out of pay)
  const bare = planOf({ birth: "1976-05-05", hsa: 3000 }); bare.income = [];
  near(compute(bare, { today: T }).hsa.ficaSaved, 3000 * 0.0765);
});

test("F1 a 64-year-old with pay is eligible and saves payroll tax", () => {
  const d = compute(planOf({ birth: "1962-04-10", pay: 80000 }), { today: T });
  assert.equal(d.hsa.limit, 5400);
  near(d.hsa.over, 0);
  near(d.hsa.ficaSaved, 4400 * 0.0765);
  assert.ok(d.hsa.taxSaved > 0);
});

test("F1 a 66-year-old still working with no Social Security yet: no Medicare is assumed, the HSA works", () => {
  const d = compute(planOf({ birth: "1960-02-20", pay: 80000 }), { today: T });
  assert.equal(d.hsa.limit, 5400); near(d.hsa.over, 0);
  near(d.hsa.ficaSaved, 4400 * 0.0765);
  assert.ok(!d.notes.some((n) => /Medicare/.test(n)));
  // Social Security that starts only in the second half of next year does not end it this year (Part A goes back six months)
  const later = compute(planOf({ birth: "1960-02-20", pay: 80000, ss: "2027-08-01" }), { today: T });
  assert.equal(later.hsa.limit, 5400);
});

test("F1 turning 65 in July and getting Social Security: the limit is 6/12 of 5,400 and the rest is too much", () => {
  const d = compute(planOf({ birth: "1961-07-15", pay: 80000, ss: "" }), { today: T });
  near(d.hsa.limit, 2700); near(d.hsa.over, 1700);
  assert.ok(d.notes.some((n) => /on Medicare from July/.test(n) && /only 2,700/.test(n)), d.notes.join("|"));
  // a birthday on the 1st starts Medicare the month before (medicare.gov): June, 7 months
  near(compute(planOf({ birth: "1961-07-01", pay: 80000, ss: "" }), { today: T }).hsa.limit, 5400 * 5 / 12);
  // Social Security starting in October, after the 65th birthday in March: Part A goes back six months, to April (9 months on Medicare)
  near(compute(planOf({ birth: "1961-03-20", pay: 80000, ss: "2026-10-01" }), { today: T }).hsa.limit, 5400 * 3 / 12);
});

test("F1 Health page: an HSA plan's limit is 0 on Medicare and the payroll part is 0 without wages", () => {
  const p = planOf({ birth: "1952-03-15", ss: "", pension: 22800 });
  p.insurance.health = { tier: "self", expected: 5000, plans: [{ id: "x", name: "HDHP", premium: 300, deductible: 3000, oopMax: 6000, coinsurance: 0.2, hsa: true, employerHsa: 0 }] };
  const h = health(p, { today: T });
  assert.equal(h.hsaLimit, 0); assert.equal(h.medicareMonths, 12);
  assert.ok(h.warnings.some((w) => /can't add to an HSA/.test(w)));
  const q = planOf({ birth: "1976-05-05", pension: 40000 });
  q.insurance.health = p.insurance.health;
  const hq = health(q, { today: T });
  near(hq.taxRate, hq.marginal);
});

test("Q1 the HSA page works the saving on the Federal estimate's own return, IRA included", () => {
  const p = emptyPlan();
  p.household.filingStatus = "married_joint";
  p.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: "1985-01-01" }, { id: "b", name: "Bo", role: "partner", birthDate: "1986-01-01" }];
  p.income = [{ id: "p1", name: "Pay", type: "salary", personId: "a", amount: 80000, period: "annual", growth: 0, taxable: true }, { id: "p2", name: "Pay", type: "salary", personId: "b", amount: 76000, period: "annual", growth: 0, taxable: true }];
  p.accounts = [{ id: "k1", name: "401k", type: "401k", balance: 10000, ownerId: "a" }, { id: "i1", name: "IRA", type: "ira", balance: 5000, ownerId: "a" }, { id: "h1", name: "HSA", type: "hsa", balance: 0, ownerId: "a" }];
  p.retirement.contributions = [
    { id: "c1", accountId: "k1", personId: "a", period: "annual", amount: 6000, employerMatch: 3000 },
    { id: "c2", accountId: "i1", personId: "a", period: "annual", amount: 7500, employerMatch: 0 },
    { id: "c3", accountId: "h1", personId: "a", period: "annual", amount: 4400, employerMatch: 0 }];
  p.taxes.hsa = { coverage: "self", contribution: 4400, employer: 0, fsa: 0, fsaSpent: 0 };
  const d = compute(p, { today: T, iraAsAssumed: false });
  const own = taxView(withoutHsaPayroll(p), { today: T }).result.totalTax - taxView(p, { today: T }).result.totalTax;
  near(d.hsa.taxSaved, own);
  const forced = taxView(withoutHsaPayroll(p), { today: T }, { without: "ira" }).result.totalTax - taxView(p, { today: T }, { without: "ira" }).result.totalTax;
  assert.ok(d.hsa.taxSaved > forced + 100, `${d.hsa.taxSaved} vs ${forced}`);
  // the default (what the answer key counts) keeps the assumed IRA
  near(compute(p, { today: T }).hsa.taxSaved, forced);
});

import { readFileSync } from "node:fs";
import { compute as location } from "../modules/investments/asset-location/compute.js";
import { investmentsPlan } from "../qa/fixtures/investments-plan.mjs";

test("F3 asset location: with no income tax the 10% minimum is flagged and the page does not call it your marginal rate", () => {
  const p = investmentsPlan(); p.income = []; p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), wages: 0 };
  const d = location(p, { today: "2026-09-16" });
  assert.equal(d.marginal, 0.1); assert.equal(d.floored, true);
  const src = readFileSync(new URL("../modules/investments/asset-location/view.js", import.meta.url), "utf8");
  assert.match(src, /d\.floored/); assert.match(src, /10% minimum/);
  const rich = investmentsPlan(); assert.equal(location(rich, { today: "2026-09-16" }).floored, false);
});

test("F2 equity card: the labels say the 0.9% and the Medicare part of the business's tax", () => {
  const src = readFileSync(new URL("../modules/career/equity/view.js", import.meta.url), "utf8");
  assert.match(src, /Social Security and Medicare\$\{t\.extraMedicare >= 1 \? " \(0\.9% included\)"/);
  assert.match(src, /self-employment and Medicare tax changes by/);
});
