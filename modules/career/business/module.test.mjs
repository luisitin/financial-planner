import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, homeOffice, soleTax, scorpTax, mileageYear, planRooms, PAYROLL, DEDUCTIBLE } from "./compute.js";
import { HOME_OFFICE, SIMPLE, QBI_LINE, SCORP_COSTS_EXAMPLE } from "./data/business.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { SE } from "../../taxes/self-employment/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const BIZ = { revenue: 60000, expenses: [{ id: "a", category: "equipment", amount: 4000, period: "annual" }, { id: "b", category: "software", amount: 60, period: "monthly" }], homeOfficeSqft: 150, miles: 3000, drawMonthly: 3000 };
const withBiz = (b, fn) => { const p = familyPlan(TODAY); p.whatIfs = { business: b }; if (fn) fn(p); return p; };
const ctx = (p) => { const ti = taxInputs(p, { today: TODAY }); return { inputs: { ...ti.inputs, otherOrdinary: Math.max(0, ti.inputs.otherOrdinary - 7200) }, params: ti.params, otherSE: 0, wages: 62400, medicareWages: 101400 + 62400, wageBase: 184500 }; };
const seOf = (profit) => profit * SE.base * (SE.ss + SE.medicare);
const MILES_2026 = (181 * 0.725 + 184 * 0.76) / 365;   // 72.5 cents to June 30, 76 cents from July 1
const born = (year) => (p) => { p.household.people.find((x) => x.id === "p-bo").birthDate = `${year}-11-02`; };

test("the home office, simplified: $5 a square foot, at most 300, never more than the profit", () => {
  assert.equal(homeOffice(150), 750); assert.equal(homeOffice(500), HOME_OFFICE.maxSqft * HOME_OFFICE.perSqft);
  assert.equal(homeOffice(200, 400), 400); assert.equal(homeOffice(200, -10), 0); assert.equal(homeOffice(null), 0);
});

test("the year's mileage rate weighs each IRS rate by the days it was in force", () => {
  near(mileageYear(2026), MILES_2026); near(mileageYear(2025), 0.70);
});

test("the profit and loss: revenue less typed expenses, the miles at the year's rate and the home office", () => {
  const d = compute(withBiz(BIZ), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.incomeId, "i-side"); assert.equal(d.person.id, "p-bo"); assert.equal(d.year, 2026);
  assert.equal(d.revenue, 60000); assert.equal(d.revenueFrom, "typed");
  near(d.typedTotal, 4000 + 720); near(d.miles.amount, 3000 * MILES_2026); assert.equal(d.homeOffice, 750);
  near(d.expensesTotal, 4720 + 3000 * MILES_2026 + 750); near(d.profit, 60000 - d.expensesTotal);
  near(d.margin, d.profit / 60000); near(d.breakEvenMonthly, d.expensesTotal / 12);
  // a negative amount from an imported plan counts as nothing
  near(compute(withBiz({ revenue: 60000, expenses: [{ id: "x", category: "other", amount: -1000, period: "monthly" }] }), { today: TODAY }).profit, 60000);
});

test("business meals count half; the other half still leaves the business", () => {
  assert.equal(DEDUCTIBLE.meals, 0.5);
  const d = compute(withBiz({ revenue: 60000, expenses: [{ id: "m", name: "Client lunches", category: "meals", amount: 500, period: "monthly" }] }), { today: TODAY });
  near(d.typedTotal, 6000); near(d.expensesTotal, 3000); near(d.notDeducted, 3000); near(d.profit, 57000);
  near(d.keepMonthly, (57000 - 3000 - d.tax.total) / 12); near(d.breakEvenMonthly, 6000 / 12);
});

test("the sole proprietor's tax by hand: self-employment tax, half of it off, the 20% deduction after AGI, 22% income tax", () => {
  const P = 50000;
  const d = compute(withBiz({ revenue: P, drawMonthly: 2500 }), { today: TODAY });
  const se = seOf(P);
  near(d.tax.se, se); near(d.tax.qbi, 0.2 * (P - se / 2));
  near(d.tax.income, 0.22 * (P - se / 2 - d.tax.qbi), 0.01);
  near(d.tax.total, d.tax.se + d.tax.income + d.tax.extra + d.tax.state);
  near(d.keepMonthly, (P - d.tax.total) / 12); assert.equal(d.draw, "ok");
  assert.equal(compute(withBiz({ revenue: P, drawMonthly: 3500 }), { today: TODAY }).draw, "over");
});

test("the state's rate on profit less half the self-employment tax and the health insurance (Pennsylvania, 3.07%)", () => {
  const PA = (q) => { q.household.state = "PA"; };
  const d = compute(withBiz({ revenue: 50000, healthPremiums: 6000 }, PA), { today: TODAY });
  assert.equal(d.stateRate, 0.0307);
  near(d.tax.state, (50000 - seOf(50000) / 2 - 6000) * 0.0307, 0.01);
  const s = compute(withBiz({ revenue: 100000, salary: 50000, scorpCosts: 0, healthPremiums: 6000 }, PA), { today: TODAY }).scorp;
  // the corporation pays the health insurance, so it comes off what passes through and the state's base; the owner's
  // deduction for it comes off the 20% deduction's base again (IRS section 199A FAQ 39)
  near(s.passed, 100000 - 50000 - s.employer - 6000); near(s.qbi, 0.2 * (s.passed - 6000), 0.01); near(s.state, (50000 + s.passed) * 0.0307, 0.01);
  // the owner's deduction for it stops at the salary (the Medicare wages from the corporation)
  const low = scorpTax(100000, 3000, 0, { ...ctx(withBiz(BIZ)), health: 6000 });
  assert.equal(low.healthOff, 3000); assert.equal(low.premiums, 6000);
});

test("the tax year is the Federal tax page's: 2025's wage base, SIMPLE limit, mileage and the deduction's line", () => {
  const d = compute(withBiz({ revenue: 400000 }, (q) => { q.taxes = { ...(q.taxes ?? {}), year: 2025 }; }), { today: TODAY });
  assert.equal(d.year, 2025); assert.equal(d.simpleLimit, SIMPLE[2025].small.limit); near(d.miles.rate, 0.70);
  near(d.tax.se, SE.ss * (176100 - 62400) + SE.medicare * 400000 * SE.base);
  assert.equal(d.qbiLine, QBI_LINE[2025].married_joint);
  assert.equal(d.plans.find((x) => x.key === "sep").room, 70000, "2025's 415(c) limit");
});

test("self-employment tax stops at the wage base after the owner's wages; the 0.9% above the household's line", () => {
  const c = ctx(withBiz(BIZ));
  const big = soleTax(200000, { ...c, wages: 150000 });
  near(big.se.ss, SE.ss * (184500 - 150000)); near(big.se.medicare, SE.medicare * 200000 * SE.base);
  near(big.extra, SE.addlMedicare * (163800 + 200000 * SE.base - 250000));
  assert.equal(soleTax(300, c).se.total, 0, "under $400 of earnings: none");
});

test("self-employed health insurance comes off income, up to the profit less half the tax and the retirement contribution", () => {
  const c = ctx(withBiz(BIZ));
  const a = soleTax(30000, c), b = soleTax(30000, { ...c, health: 6000 });
  assert.equal(b.healthOff, 6000); assert.ok(b.income < a.income);
  near(soleTax(5000, { ...c, health: 9000 }).healthOff, 5000 - seOf(5000) / 2);
  near(soleTax(30000, { ...c, health: 25000, retirement: 5576 }).healthOff, 30000 - seOf(30000) / 2 - 5576);
});

test("the 20% deduction: at most 20% of taxable income less qualified dividends, but at least $400 on $1,000 of business profit", () => {
  // no pay, 150,000 of qualified dividends: taxable income is all dividends, so only the $400 minimum is left
  const rich = compute(withBiz({ revenue: 30000 }, (q) => { q.income = q.income.filter((x) => x.type === "business"); q.retirement.contributions = []; q.taxes = { ...(q.taxes ?? {}), thisYear: { qualifiedIncome: 150000 } }; }), { today: TODAY });
  near(rich.tax.qbi, 400);
  // a small profit: 20% of 1,858.70 is 371.74, lifted to 400
  near(compute(withBiz({ revenue: 2000 }), { today: TODAY }).tax.qbi, 400);
  near(compute(withBiz({ revenue: 900 }), { today: TODAY }).tax.qbi, 0.2 * (900 - seOf(900) / 2), 0.01);
});

test("the refundable child tax credit counts the business's earnings, which it would not have without it", () => {
  // no pay: profit 30,000 is all the earned income; taxable income is under the standard deduction, so the credit is refunded (1,700 a child)
  const d = compute(withBiz({ revenue: 30000 }, (q) => { q.income = q.income.filter((x) => x.type === "business"); q.retirement.contributions = []; }), { today: TODAY });
  near(d.tax.income, -1700, 0.01);
});

test("a sole proprietor's loss comes off other income: no self-employment tax, the tax falls", () => {
  const d = compute(withBiz({ revenue: 10000, expenses: [{ id: "e", category: "equipment", amount: 20000, period: "annual" }] }), { today: TODAY });
  assert.equal(d.loss, true); near(d.profit, -10000); assert.equal(d.tax.se, 0); assert.equal(d.tax.qbi, 0);
  near(d.tax.income, -0.22 * 10000, 0.01); near(d.keepMonthly, (-10000 - d.tax.total) / 12);
  assert.equal(d.scorp, null); assert.equal(d.earned, 0); assert.equal(d.best, null);
  assert.ok(d.plans.every((p) => p.room === 0));
});

test("an S corporation by hand: payroll tax on the salary only, the rest passed through with the 20% deduction", () => {
  const p = withBiz({ ...BIZ, salary: 30000, scorpCosts: 1500 });
  const d = compute(p, { today: TODAY });
  const s = d.scorp;
  assert.equal(s.salaryFrom, "typed"); assert.equal(s.costs, 1500);
  near(s.employer, 30000 * (PAYROLL.ss + PAYROLL.medicare)); near(s.employee, 30000 * (PAYROLL.ss + PAYROLL.medicare));
  near(s.passed, d.profit - 30000 - s.employer - 1500); near(s.qbi, 0.2 * s.passed);
  near(s.federal, 0.22 * (30000 + s.passed - s.qbi), 0.01);
  near(s.total, s.federal + s.employee + s.employer + s.state);
  near(s.saving, d.tax.total - (s.total + 1500));
  // the example salary and costs when none is typed
  const e = compute(withBiz({ revenue: 52300 }), { today: TODAY }).scorp;
  assert.equal(e.salaryFrom, "example"); assert.equal(e.salary, 31400); assert.equal(e.costs, SCORP_COSTS_EXAMPLE);
});

test("an S corporation: a loss passed through comes off other income; it pays off on a bigger profit", () => {
  const c = scorpTax(10000, 10000, 2000, ctx(withBiz(BIZ)));
  near(c.passed, 10000 - 10000 - 10000 * (PAYROLL.ss + PAYROLL.medicare) - 2000); assert.equal(c.qbi, 0);
  const none = federalTax({ ...ctx(withBiz(BIZ)).inputs, selfEmployment: 0 }, ctx(withBiz(BIZ)).params);
  near(c.income - (none.totalTax - none.additionalMedicare), 0.22 * (10000 + c.passed), 0.01);
  assert.equal(scorpTax(10000, 20000, 0, ctx(withBiz(BIZ))).salary, 10000, "a salary is never more than the profit");
  assert.ok(compute(withBiz({ revenue: 200000, salary: 80000, scorpCosts: 2000 }), { today: TODAY }).scorp.saving > 0);
});

test("the retirement plans: SEP 20% of earnings, solo 401(k) with the employee part, SIMPLE matched up to 3% of 92.35% of profit", () => {
  const P = 52250;
  const d = compute(withBiz({ revenue: P }), { today: "2026-09-15" });
  const earned = P - seOf(P) / 2, comp = P * SE.base;
  near(d.earned, earned); near(d.simpleComp, comp);
  const [sep, solo, simple] = d.plans;
  near(sep.room, 0.2 * earned); near(solo.room, 0.2 * earned + 24500);
  near(simple.room, SIMPLE[2026].small.limit + 0.03 * comp);
  assert.equal(simple.late, false); assert.equal(d.best, "solo");
  assert.ok(sep.saved > 0 && solo.saved > sep.saved && simple.saved > sep.saved);
  // the saving is the tax worked again with the contribution off income (and off the 20% deduction's base)
  near(sep.saved, sep.room * 0.22 * 0.8, 0.5);
  // after October 1 a new SIMPLE IRA is for next year: no saving counted this year
  const late = compute(withBiz({ revenue: P }), { today: TODAY }).plans.find((x) => x.key === "simple");
  assert.equal(late.late, true); assert.equal(late.saved, 0);
});

test("the plans never take more than the business earned; the SIMPLE match never more than what is put in", () => {
  const d = compute(withBiz({ revenue: 10000 }), { today: TODAY });
  const solo = d.plans.find((x) => x.key === "solo"), simple = d.plans.find((x) => x.key === "simple");
  near(solo.room, d.earned); near(simple.room, d.simpleComp + 0.03 * d.simpleComp, 1e-6);
  // a big profit: SEP and solo both reach 72,000 (no single best); SIMPLE 18,100 matched by 18,100
  const big = compute(withBiz({ revenue: 1234567 }), { today: "2026-09-15" });
  assert.deepEqual(big.plans.map((x) => Math.round(x.room)), [72000, 72000, 36200]); assert.equal(big.best, null);
});

test("the solo 401(k) stays within 100% of pay, earnings less the business's part (Publication 560 worksheet, steps 9-15)", () => {
  // 2025, age 33, 38,358 of profit, 2,709.91 half the self-employment tax: earnings 35,648.09
  const r = planRooms({ profit: 38358, seHalf: 2709.91, age: 33, deferralLeft: 23500, year: 2025 });
  near(r.earned, 35648.09, 1e-6);
  // business part 20% = 7,129.62 would leave 28,518.47 of pay for a 23,500 deferral, but pay is earnings less the
  // business part: d + E <= 35,648.09 - E with d = 23,500 gives E = 6,074.05, 29,574.05 in all (not 30,629.62)
  near(r.solo, (35648.09 + 23500) / 2, 1e-6); near(r.solo, 29574.045, 1e-6);
  // the deferral alone is small next to the earnings: the 20% is the limit, as before
  const room = planRooms({ profit: 80000, seHalf: 5651.88, age: 33, deferralLeft: 5000, year: 2025 });
  near(room.solo, 0.2 * (80000 - 5651.88) + 5000, 1e-6);
});

test("catch-ups from 50, and the larger ones from 60 to 63, on top of the solo 401(k) and SIMPLE limits", () => {
  const at = (year) => compute(withBiz({ revenue: 120000 }, born(year)), { today: "2026-09-15" }).plans;
  const base = at(1988), y55 = at(1971), y62 = at(1964);
  near(y55[1].room - base[1].room, 8000); near(y62[1].room - base[1].room, 11250);
  near(y55[2].room - base[2].room, SIMPLE[2026].small.catchUp); near(y62[2].room - base[2].room, SIMPLE[2026].superCatchUp.amount);
  near(y55[0].room, base[0].room, 1e-9);
});

test("a 401(k) at a job leaves the solo 401(k) and SIMPLE less room; none left means no SIMPLE match either", () => {
  const job = (amount) => (q) => { q.accounts.push({ id: "a-bo401", name: "Bo's 401(k)", type: "401k", balance: 0, ownerId: "p-bo" }); q.retirement.contributions.push({ id: "c-bo2", accountId: "a-bo401", personId: "p-bo", amount, period: "monthly", employerMatch: 0 }); };
  const d = compute(withBiz(BIZ, job(1500)), { today: TODAY });
  const solo = d.plans.find((x) => x.key === "solo"), simple = d.plans.find((x) => x.key === "simple");
  near(solo.room, 0.2 * d.earned + (24500 - 18000));
  near(simple.room, 6500 + Math.min(6500, 0.03 * d.simpleComp));
  assert.deepEqual(d.job401k, { used: 18000, limit: 24500 });
  const full = compute(withBiz({ revenue: 60000 }, job(24500 / 12)), { today: TODAY });
  assert.equal(full.plans.find((x) => x.key === "simple").room, 0);
  assert.equal(d.qbiLine, QBI_LINE[2026].married_joint); assert.equal(d.qbiLimited, false);
});

test("not ready without a business, but expenses typed first are kept; the Income page's amount and the Self-employment page's expenses", () => {
  const e = emptyPlan(); e.whatIfs = { business: { expenses: [{ id: "x", name: "Camera lens", category: "equipment", amount: 120, period: "monthly" }] } };
  const n = compute(e, { today: TODAY });
  assert.equal(n.ready, false); assert.equal(n.expenses.length, 1); near(n.typedTotal, 1440);
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.revenue, 7200); assert.equal(d.revenueFrom, "income"); assert.equal(d.typedHere, false);
  assert.ok(d.notes.some((x) => /No expenses typed/.test(x)));
  const p = familyPlan(TODAY); p.whatIfs = { selfEmployment: { expenses: 3000 } };
  const s = compute(p, { today: TODAY });
  near(s.profit, 4200); assert.equal(s.expenses[0].fromSelfEmployment, true); assert.equal(s.seExpenses, 3000);
});
