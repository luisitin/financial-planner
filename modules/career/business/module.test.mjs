import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, homeOffice, soleTax, scorpTax, mileageYear, planRooms, PAYROLL, DEDUCTIBLE } from "./compute.js";
import { HOME_OFFICE, SIMPLE, QBI_LINE, SCORP_COSTS_EXAMPLE } from "./data/business.js";
import { taxInputs, careInputsWith } from "../../taxes/federal/compute.js";
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
// the child and dependent care credit on Cy's care (taxes/federal README): 3,000 x a rate that falls from 35% one point per
// 4,000 (or part) of joint AGI over 150,000, to 20% (IRC 21(a)(2), 2026). Without Bo's photography the family's AGI is 151,580.
const careAt = (agi) => 3000 * Math.max(20, 35 - Math.ceil(Math.max(0, agi - 150000) / 4000)) / 100;
const AGI0 = 151580;
const careLost = (more) => careAt(AGI0) - careAt(AGI0 + more);   // the credit lost to `more` of AGI

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
  near(d.margin, d.profit / 60000); near(d.breakEvenMonthly, (d.expensesTotal - 750) / 12, 1e-9);   // the home office is not money out
  // a negative amount from an imported plan counts as nothing
  near(compute(withBiz({ revenue: 60000, expenses: [{ id: "x", category: "other", amount: -1000, period: "monthly" }] }), { today: TODAY }).profit, 60000);
});

test("the home office is not money out of the business: what is left rises by the tax it saves (2026-11-16)", () => {
  // the family's 7,200 of photography from Income: 150 square feet take $750 off the profit and about $259 off the tax;
  // what the business leaves is $412 a month without it and about $434 with it (it said $371: the $750 taken as spent)
  const T = "2026-11-16";
  const a = compute(familyPlan(T), { today: T });
  const p = familyPlan(T); p.whatIfs = { business: { homeOfficeSqft: 150 } };
  const b = compute(p, { today: T });
  assert.equal(b.homeOffice, 750); near(b.profit, a.profit - 750);
  near(b.keepMonthly * 12, a.keepMonthly * 12 + (a.tax.total - b.tax.total), 1e-6);
  assert.equal(Math.round(a.keepMonthly), 412); assert.equal(Math.round(b.keepMonthly), 434);
  assert.equal(Math.round(a.tax.total - b.tax.total), 259);
  assert.equal(Math.round((b.profit - b.notDeducted - b.tax.total) / 12), 371, "the old sum, the office taken as spent");
  // the costs a month to break even leave it out too: it is capped at the profit, so it never needs covering
  near(b.breakEvenMonthly, (b.expensesTotal - 750 + b.notDeducted) / 12, 1e-9); near(b.breakEvenMonthly, a.breakEvenMonthly, 1e-9);
});

test("the one deliberate change from a491122: only with a home office typed do what is left and the costs a month move; with none they are the old sums to the bit", async () => {
  // money critic F1 (2026-11-16): the invariance rule holds for every plan without a home office; with one, what the
  // business leaves a month and the costs a month to break even no longer take the office as money spent (the old sums
  // are worked here by hand, so the test fails if either moves for a plan with no office)
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const R8 = await import("../../../qa/fixtures/round8-households.mjs");
  const plans = [familyPlan(TODAY), withBiz(BIZ), withBiz({ ...BIZ, homeOfficeSqft: 0 }), withBiz({ revenue: 1000, homeOfficeSqft: 300 }), withBiz({ revenue: 30000, expenses: [{ id: "m", category: "meals", amount: 2000, period: "annual" }], homeOfficeSqft: 200 }),
    R8.freelancerPlan(), R8.landlordBusinessPlan(), R8.stockAndBusinessPlan(), ...ARCHETYPES.map((x) => x.build())];
  let offices = 0, none = 0;
  for (const p of plans) {
    const d = compute(p, { today: TODAY });
    if (!d.ready) continue;
    if (d.homeOffice === 0) none++; else offices++;
    const oldKeep = (d.profit - d.notDeducted - d.tax.total) / 12, oldBreakEven = (d.expensesTotal + d.notDeducted) / 12;
    if (d.homeOffice === 0) { assert.equal(d.keepMonthly, oldKeep); assert.equal(d.breakEvenMonthly, oldBreakEven); }
    else { near(d.keepMonthly, oldKeep + d.homeOffice / 12, 1e-9); near(d.breakEvenMonthly, oldBreakEven - d.homeOffice / 12, 1e-9); }
  }
  assert.equal(offices, 3); assert.ok(none >= 4, `${none} plans with a business and no home office`);
  // the draw check follows: a draw between the old and the new figure was "over", it is "ok" now
  const d = compute(withBiz({ ...BIZ, drawMonthly: null }), { today: TODAY });
  const between = Math.round((d.profit - d.notDeducted - d.tax.total) / 12 + 30);
  assert.equal(compute(withBiz({ ...BIZ, drawMonthly: between }), { today: TODAY }).draw, "ok");
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
  // 22% on what is taxed, and the child care credit the profit's AGI (less half the self-employment tax) costs:
  // 151,580 -> 198,048 takes it from 34% to 22% of 3,000, 360
  near(d.tax.income, 0.22 * (P - se / 2 - d.tax.qbi) + careLost(P - se / 2), 0.01);
  near(careLost(P - se / 2), 360, 1e-9);
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
  // the loss takes AGI to 141,580, under the care credit's phase-down: 35% instead of 34% of 3,000, 30 more off
  near(d.tax.income, -0.22 * 10000 + careLost(-10000), 0.01); near(careLost(-10000), -30, 1e-9);
  near(d.keepMonthly, (-10000 - d.tax.total) / 12);
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
  near(s.federal, 0.22 * (30000 + s.passed - s.qbi) + careLost(30000 + s.passed), 0.01);   // the salary and what passes through raise AGI: the care credit lost
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
  near(c.income - (none.totalTax - none.additionalMedicare), 0.22 * (10000 + c.passed) + careLost(10000 + c.passed), 0.01);
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
  // and the child care credit: AGI 151,580 + the earnings, less the SEP money, is two of its 4,000 steps lower (+60)
  near(sep.saved, sep.room * 0.22 * 0.8 + careLost(earned) - careLost(earned - sep.room), 0.5);
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

test("the business chosen stays chosen after a raise from a later date starts the line that carries it on (review 2026-11-02, round 5)", async () => {
  const { changeFrom } = await import("../../cashflow/income/compute.js");
  const T = "2026-11-02";
  // two businesses; the smaller one is picked on this page, then raised on Income from January (still the smaller)
  const p = withBiz({ incomeId: "i-wk" }, (q) => { q.income.push({ id: "i-wk", name: "Weekend workshops", type: "business", personId: "p-bo", amount: 300, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true }); });
  const was = p.income.find((x) => x.id === "i-wk");
  const ch = changeFrom(was, { ...was, amount: 400, startDate: "2027-01-01" }, T);
  const i = p.income.indexOf(was);
  p.income[i] = ch.old; p.income.splice(i + 1, 0, { id: "i-wk-2027", ...ch.next });
  assert.deepEqual([compute(p, { today: T }).incomeId, compute(p, { today: T }).name], ["i-wk", "Weekend workshops"]);
  const later = compute(p, { today: "2027-02-01" });
  assert.deepEqual([later.incomeId, later.name, later.revenue], ["i-wk-2027", "Weekend workshops", 4800], "not the larger photography business");
  // still once the half that ended is removed on Income
  p.income = p.income.filter((x) => x.id !== "i-wk");
  assert.equal(compute(p, { today: "2027-02-01" }).incomeId, "i-wk-2027");
  // a choice with nothing carrying it on still falls back to the largest business
  p.whatIfs.business.incomeId = "gone";
  assert.equal(compute(p, { today: "2027-02-01" }).incomeId, "i-side");
});

test("a business that is the lower earner's only work unlocks the child care credit (IRC 21(d)(1)(B))", () => {
  // Bo has no salary, only the photography: without the business Bo earns nothing, so there is no credit on Cy's care; with
  // 30,000 of profit Bo's earned income is the profit less half its self-employment tax, and the credit comes back. The
  // business's income tax counts it (2026-11-02: it kept the plan's figure, with or without the business)
  const p = withBiz({ revenue: 30000 }, (q) => { q.income = q.income.filter((x) => x.id !== "i-bo"); });
  const d = compute(p, { today: TODAY });
  const ti = taxInputs(p, { today: TODAY });
  const care = (business) => careInputsWith(ti, { "p-bo": { business, pay: 0 } });
  const se = seOf(30000), inputs = { ...ti.inputs, otherOrdinary: Math.max(0, ti.inputs.otherOrdinary - 7200) };
  const T = { inputs, params: ti.params, otherSE: 0, wages: 0, medicareWages: 101400, wageBase: 184500 };
  const none = federalTax({ ...inputs, selfEmployment: 0, care: care(0) }, ti.params);
  assert.equal(none.credits.careCredit, 0);
  const sole = soleTax(30000, { ...T, careAt: ({ business }) => care(business) });
  near(d.tax.income, sole.income - (none.totalTax - none.additionalMedicare), 0.01);
  const frozen = soleTax(30000, T), frozenNone = federalTax({ ...inputs, selfEmployment: 0 }, ti.params);
  const unlocked = federalTax({ ...inputs, otherOrdinary: inputs.otherOrdinary + 30000, adjustments: inputs.adjustments + se / 2, selfEmployment: 30000 - se / 2, qbiDeduction: 0.2 * (30000 - se / 2), care: care(30000 - se / 2) }, ti.params).credits.careCredit;
  assert.ok(unlocked > 0);
  near((frozen.income - (frozenNone.totalTax - frozenNone.additionalMedicare)) - d.tax.income, unlocked, 0.01);
});

test("the lower earner's business lets the other's child care account stay out of income (one rule: careInputsWith's wagesChange)", () => {
  // Bo has no salary, only a business; Ana has a 5,000 account for 2026. Without the business Bo earns nothing: none of the
  // account stays out of income, it is taxed as pay (wages 5,000 higher); with 30,000 of profit all 5,000 stays out
  const p = withBiz({ revenue: 30000 }, (q) => { q.income = q.income.filter((x) => x.id !== "i-bo"); q.whatIfs.benefits = { "p-ana": { dcfsaElect: 5000, planYear: 2026 } }; });
  const ti = taxInputs(p, { today: TODAY });
  const care = (business) => careInputsWith(ti, { "p-bo": { business, pay: 0 } });
  near(care(0).wagesChange, 5000, 1e-9); assert.equal(care(0).benefits, 0);
  const se = seOf(30000);
  near(care(30000 - se / 2).wagesChange, 0, 1e-9); assert.equal(care(30000 - se / 2).benefits, 5000);
  // the page's income tax counts it: against the business with the plan's wages kept, 22% of the 5,000 less
  const d = compute(p, { today: TODAY });
  const inputs = { ...ti.inputs, otherOrdinary: Math.max(0, ti.inputs.otherOrdinary - 7200) };
  const T = { inputs, params: ti.params, otherSE: 0, wages: 0, medicareWages: 101400, wageBase: 184500, qbiMinimum: { amount: 400, from: 1000 } };
  const none = federalTax({ ...inputs, selfEmployment: 0, care: care(0), wages: inputs.wages + 5000 }, ti.params);
  const sole = soleTax(30000, { ...T, careAt: ({ business }) => care(business) });
  near(d.tax.income, sole.income - (none.totalTax - none.additionalMedicare), 0.01);
});

test("care fourth pass: filing separately, the business is on its owner's own return (Bo's photography: +642.37, no 0.9%, 1,659.70)", () => {
  // the family filing separately, 3,750 each in a child care account. Bo's own return with the 7,200 of profit, half its
  // self-employment tax off his income and its 20% deduction: 642.37 more income tax than without it (the scratchpad
  // mfs-law oracle); with the 1,017.33 of self-employment tax, 1,659.70. His own Medicare wages and earnings are under the
  // separate return's 125,000: no 0.9%. (The page said -406.32 and 60: the business taken off Ana's return)
  const p = familyPlan(TODAY); p.household.filingStatus = "married_separate";
  p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } }, business: { incomeId: "i-side" } };
  const d = compute(p, { today: TODAY });
  near(d.tax.income, 642.37, 0.01); near(d.tax.extra, 0, 1e-9); near(d.tax.se, seOf(7200), 0.01); near(d.tax.total, 1659.70, 0.01);
  // filing jointly nothing moves
  const j = familyPlan(TODAY); j.whatIfs = { ...(j.whatIfs ?? {}), business: { incomeId: "i-side" } };
  near(compute(j, { today: TODAY }).tax.total, 2255.01, 0.01);
});

// ---------------------------------------------------------------- the answer in words (words.js): one sentence per case
import { answerFor, drawLine, savedLine, scorpWorth, scorpStatus } from "./words.js";
import { checklist, missedStatus, typedByKind, CHECKLIST, MISSED_TITLE } from "./costs.js";
import { CATEGORIES } from "./compute.js";
const $ = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const D = (o = {}) => ({ ready: true, profit: 50000, keepMonthly: 2950, margin: 0.83, notDeducted: 0, tax: { total: 14600, se: 7065, health: 0 }, draw: null, drawMonthly: null, scorp: null, ...o });

test("the headline and the line under it: one written sentence per case (R3, R5)", () => {
  const cases = [
    [D(), "keep", "After tax, the business leaves you about $2,950 a month", "It makes $50,000 a year after costs, and about $14,600 of that goes to tax."],
    [D({ tax: { total: 0 } }), "keepNoTax", "After tax, the business leaves you about $2,950 a month", "It makes $50,000 a year after costs, and it brings no tax."],
    [D({ profit: 9000, keepMonthly: 800, margin: 1, tax: { total: -600 } }), "keepLowers", "After tax, the business leaves you about $800 a month", "It makes $9,000 a year after costs, and it lowers the household's tax by about $600."],
    [D({ profit: 2000, keepMonthly: -40, margin: 0.2, notDeducted: 1500, tax: { total: 1000 } }), "shortMeals", "After tax, the business costs you about $40 a month", "It makes $2,000 a year after costs, but the tax and the half of business meals that does not count come to more."],
    [D({ profit: 2000, keepMonthly: -40, margin: 0.2, tax: { total: 2480 } }), "shortTax", "After tax, the business costs you about $40 a month", "It makes $2,000 a year after costs, but what it adds to the household's tax comes to more."],
    [D({ profit: -6000, keepMonthly: -390, margin: -0.5, tax: { total: -1320 } }), "lossSaves", "The business loses about $6,000 a year", "The loss comes off the household's other income and lowers the tax by about $1,320; after that it costs you about $390 a month."],
    [D({ profit: -6000, keepMonthly: -500, margin: -0.5, tax: { total: 0 } }), "loss", "The business loses about $6,000 a year", "There is no other income for the loss to come off this year, so it costs you about $500 a month."],
    [D({ profit: 0.2, keepMonthly: 0 }), "even", "The business breaks even", "What customers pay covers the costs with nothing left over, so there is no tax on it."],
    // no profit for tax, but the home office (not money out) leaves what came in with the person, or the half of meals
    // that does not count takes it from them (money critic F2)
    [D({ profit: 0, keepMonthly: 83.33, tax: { total: 0 } }), "evenOffice", "After tax, the business leaves you about $83 a month", "The home office takes the profit for tax down to nothing, so there is no tax on it; the room is paid for anyway."],
    [D({ profit: 0, keepMonthly: -83.33, notDeducted: 1000, tax: { total: 0 } }), "evenMeals", "After tax, the business costs you about $83 a month", "There is no profit for tax, but the half of business meals that does not count comes out of your own pocket."],
    [{ ready: false }, "notReady", "Your small business", "What the business earns after costs and tax, and what you can safely pay yourself."],
  ];
  for (const [d, c, title, line] of cases) assert.deepEqual(answerFor(d, $), { case: c, title, line }, c);
  // the green line after a save names the new answer (R7), per case
  assert.equal(savedLine(D(), $), "Saved. After tax the business now leaves you about $2,950 a month.");
  assert.equal(savedLine(D({ profit: 2000, keepMonthly: -40, tax: { total: 2480 } }), $, "Phone added."), "Phone added. After tax the business now costs you about $40 a month.");
  assert.equal(savedLine(D({ profit: -6000, keepMonthly: -500, tax: { total: 0 } }), $), "Saved. The business now loses about $6,000 a year.");
  assert.equal(savedLine(D({ profit: 0, keepMonthly: 0 }), $), "Saved. The business now breaks even.");
  assert.equal(savedLine(D({ profit: 0, keepMonthly: 83.33 }), $), "Saved. After tax the business now leaves you about $83 a month.");
  assert.equal(savedLine(D({ profit: 0, keepMonthly: -83.33, notDeducted: 1000 }), $), "Saved. After tax the business now costs you about $83 a month.");
  assert.equal(savedLine({ ready: false }, $), "Saved.");
  // what the owner takes out, when it fits (the amber notice says the other case)
  assert.equal(drawLine(D({ draw: "ok", drawMonthly: 2500 }), $), "You take out $2,500 a month; that leaves $450 a month in the business.");
  assert.equal(drawLine(D({ draw: "over", drawMonthly: 3500 }), $), null); assert.equal(drawLine(D({ draw: "ok", drawMonthly: 0 }), $), null); assert.equal(drawLine(D(), $), null);
  // an S corporation: a worth line only when it saves; the row's status within 20 characters
  assert.equal(scorpWorth(D({ scorp: { saving: 1234 } }), $), "As an S corporation you might keep about $1,234 more a year, after its running costs.");
  assert.equal(scorpWorth(D({ scorp: { saving: -800 } }), $), null); assert.equal(scorpWorth(D(), $), null);
  assert.equal(scorpStatus(D({ scorp: { saving: 1234 } }), $), "would save $1,234"); assert.equal(scorpStatus(D({ scorp: { saving: -800 } }), $), "would cost $800");
  assert.equal(scorpStatus(D({ scorp: { saving: 0.2 } }), $), "about the same");
  assert.ok(scorpStatus(D({ scorp: { saving: -123456 } }), $).length <= 20);
});

test("the headline from the page's own figures: the BIZ plan keeps, the family's 7,200 from Income keeps, a loss saves", () => {
  const d = compute(withBiz(BIZ), { today: TODAY });
  const a = answerFor(d, $);
  assert.equal(a.case, "keep"); assert.equal(a.title, `After tax, the business leaves you about ${$(d.keepMonthly)} a month`);
  assert.equal(a.line, `It makes ${$(d.profit)} a year after costs, and about ${$(d.tax.total)} of that goes to tax.`);
  const loss = compute(withBiz({ revenue: 10000, expenses: [{ id: "x", category: "equipment", amount: 16000, period: "annual" }] }), { today: TODAY });
  assert.equal(answerFor(loss, $).case, "lossSaves"); assert.match(answerFor(loss, $).title, /^The business loses about \$6,000 a year$/);
  // $1,000 coming in and 300 square feet: the office takes the profit to nothing, the $1,000 stays with the person
  // untaxed ($83 a month), and the costs a month to break even are nothing (it said "breaks even" beside $83 of costs)
  const office = compute(withBiz({ revenue: 1000, homeOfficeSqft: 300 }), { today: TODAY });
  assert.equal(office.profit, 0); near(office.keepMonthly, 1000 / 12, 1e-9); assert.equal(office.breakEvenMonthly, 0);
  assert.equal(answerFor(office, $).case, "evenOffice"); assert.equal(answerFor(office, $).title, "After tax, the business leaves you about $83 a month");
  // $1,000 coming in and $2,000 of business meals: half counts, so no profit for tax, but $1,000 a year is paid out
  const meals = compute(withBiz({ revenue: 1000, expenses: [{ id: "m", category: "meals", amount: 2000, period: "annual" }] }), { today: TODAY });
  assert.equal(meals.profit, 0); near(meals.keepMonthly, -1000 / 12, 1e-9); near(meals.breakEvenMonthly, 2000 / 12, 1e-9);
  assert.equal(answerFor(meals, $).case, "evenMeals"); assert.equal(answerFor(meals, $).title, "After tax, the business costs you about $83 a month");
});

// ---------------------------------------------------------------- costs people often forget to count (costs.js)
const S = (o = {}) => ({ ...o });
const itemOf = (c, key) => c.items.find((x) => x.key === key);

test("the checklist: nine rows in a person's order, each with what counts and a source; nothing counted from here", () => {
  assert.equal(MISSED_TITLE, "Costs people often forget to count");
  assert.deepEqual(CHECKLIST.map((x) => x.key), ["office", "miles", "health", "retire", "seHalf", "phone", "supplies", "professional", "education"]);
  for (const r of CHECKLIST) { assert.ok(r.counts.length > 20 && r.counts.length < 140, r.key); assert.ok(/[.]$/.test(r.counts), `${r.key} ends with a stop`); }
  // the two kinds the checklist needed are expense kinds now, counted in full
  assert.equal(CATEGORIES.professional, "Accountant, lawyer, tax help"); assert.equal(CATEGORIES.education, "Courses for your work");
  const d = compute(withBiz({ revenue: 60000, expenses: [{ id: "p", category: "professional", amount: 400, period: "annual" }, { id: "e", category: "education", amount: 300, period: "annual" }] }), { today: TODAY });
  near(d.expensesTotal, 700); near(d.profit, 59300);
  assert.equal(typedByKind(d).professional, 400); assert.equal(typedByKind(d).education, 300);
});

test("the checklist's states, each with its written sentence: counted, limited, typed but none, not yet, by itself, elsewhere, none", () => {
  // nothing typed: every row with a box or a kind is "not yet"; half the tax is counted by itself; the plans are elsewhere
  let c = checklist(D({ homeOffice: 0, miles: { amount: 0, miles: 0 }, earned: 46000, expenses: [] }), S(), $);
  assert.deepEqual(c.items.map((x) => x.state), ["add", "add", "add", "elsewhere", "auto", "add", "add", "add", "add"]);
  assert.equal(c.missing, 7); assert.equal(missedStatus(c), "7 not counted yet");
  assert.equal(itemOf(c, "office").said, "Not counted yet."); assert.deepEqual(itemOf(c, "office").go, { box: "homeOfficeSqft" });
  // plain words, no "comes off income" (person critic P5)
  assert.equal(itemOf(c, "seHalf").said, "The page already takes $3,533 off the income you pay tax on."); assert.equal(itemOf(c, "seHalf").go, null);
  assert.equal(itemOf(c, "retire").said, "This lowers the income you pay tax on; it is not a business cost. The plans and the tax each saves are above.");
  assert.deepEqual(itemOf(c, "retire").go, { href: "#/retirement/contributions" });
  assert.deepEqual(itemOf(c, "phone").go, { kind: "phone" }); assert.deepEqual(itemOf(c, "education").go, { kind: "education" });
  // everything counted
  c = checklist(D({ homeOffice: 750, miles: { amount: 2227.8, miles: 3000 }, tax: { total: 9000, se: 7000, health: 6000 }, earned: 46000,
    expenses: [{ category: "phone", yearly: 720 }, { category: "software", yearly: 480 }, { category: "supplies", yearly: 720 }, { category: "professional", yearly: 400 }, { category: "education", yearly: 300 }, { category: "meals", yearly: 600 }] }), S({ homeOfficeSqft: 150, healthPremiums: 6000 }), $);
  assert.deepEqual(c.items.map((x) => [x.key, x.state, Math.round(x.amount), x.said]), [
    ["office", "counted", 750, "Counted: $750 for 150 square feet."],
    ["miles", "counted", 2228, "Counted: $2,228 for 3,000 miles."],
    ["health", "counted", 6000, "Counted: $6,000 off the income you pay tax on."],
    ["retire", "elsewhere", 0, "This lowers the income you pay tax on; it is not a business cost. The plans and the tax each saves are above."],
    ["seHalf", "auto", 3500, "The page already takes $3,500 off the income you pay tax on."],
    ["phone", "counted", 720, "Counted: $720 a year."],
    ["supplies", "counted", 1200, "Counted: $1,200 a year."],
    ["professional", "counted", 400, "Counted: $400 a year."],
    ["education", "counted", 300, "Counted: $300 a year."],
  ]);
  assert.equal(c.missing, 0); assert.equal(missedStatus(c), "nothing missing");
  assert.ok(c.items.every((x) => x.key === "retire" ? x.go?.href : x.go === null), "a counted row has no button");
  // typed, but the profit is too small: the home office and the health insurance count only up to it
  // the profit cuts the home office: the $1,500 that 300 square feet allow is said beside what counts (money critic F5)
  c = checklist(D({ profit: 900, homeOffice: 900, tax: { total: 0, se: 127, health: 0 }, earned: 836, expenses: [] }), S({ homeOfficeSqft: 300, healthPremiums: 6000 }), $);
  assert.equal(itemOf(c, "office").state, "limited"); assert.equal(itemOf(c, "office").said, "Counted: $900 of the $1,500 for 300 square feet: it counts only up to the profit.");
  assert.equal(itemOf(c, "office").amount, 900); assert.equal(itemOf(c, "office").go, null);
  assert.equal(checklist(D({ homeOffice: 1500, expenses: [] }), S({ homeOfficeSqft: 450 }), $).items[0].said, "Counted: $1,500 for 300 square feet.", "above 300 square feet only 300 count, and that is no cut");
  assert.equal(itemOf(c, "health").state, "typedNone"); assert.equal(itemOf(c, "health").said, "It counts only up to the profit, so none this year."); assert.equal(itemOf(c, "health").go, null);
  c = checklist(D({ profit: 5000, homeOffice: 0, tax: { total: 0, se: 706, health: 4647 }, earned: 4647, expenses: [] }), S({ homeOfficeSqft: 100, healthPremiums: 6000 }), $);
  assert.equal(itemOf(c, "health").state, "limited"); assert.equal(itemOf(c, "health").said, "Counted: $4,647 of the $6,000: it counts only up to the profit.");
  assert.equal(itemOf(c, "office").state, "typedNone"); assert.equal(itemOf(c, "office").said, "It counts only up to the profit, so none this year.");
  // a loss: no self-employment tax, nothing can go into a plan
  c = checklist(D({ profit: -3000, homeOffice: 0, tax: { total: -660, se: 0, health: 0 }, earned: 0, expenses: [] }), S(), $);
  assert.equal(itemOf(c, "seHalf").state, "none"); assert.equal(itemOf(c, "seHalf").said, "No self-employment tax this year, so nothing to take off.");
  assert.equal(itemOf(c, "retire").state, "none"); assert.equal(itemOf(c, "retire").said, "No earnings from the business this year, so nothing can go in from it."); assert.equal(itemOf(c, "retire").go, null);
  // no business yet: expenses typed meanwhile still count in their rows; the status counts nothing as missed (person
  // critic P2: someone with no business was told "7 not counted yet")
  c = checklist({ ready: false, expenses: [{ category: "phone", yearly: 600 }, { category: "other", yearly: 99, fromSelfEmployment: true }] }, S({ homeOfficeSqft: 120 }), $);
  assert.equal(itemOf(c, "phone").state, "counted"); assert.equal(itemOf(c, "office").state, "typedNone"); assert.equal(itemOf(c, "retire").state, "none");
  assert.equal(c.missing, 5); assert.equal(c.ready, false); assert.equal(missedStatus(c), "a short list");
  assert.equal(missedStatus(checklist({ ready: false, expenses: [] }, S(), $)), "a short list");
});

test("the checklist from the page's own figures: the BIZ plan's office, miles and software are counted with their figures", () => {
  const d = compute(withBiz(BIZ), { today: TODAY });
  const c = checklist(d, BIZ, $);
  assert.equal(itemOf(c, "office").said, "Counted: $750 for 150 square feet.");
  assert.equal(itemOf(c, "miles").said, `Counted: ${$(3000 * MILES_2026)} for 3,000 miles.`);
  assert.equal(itemOf(c, "supplies").said, "Counted: $720 a year.", "60 a month of software is in the supplies-and-software row");
  near(itemOf(c, "seHalf").amount, d.tax.se / 2);
  assert.deepEqual(c.items.filter((x) => x.state === "add").map((x) => x.key), ["health", "phone", "professional", "education"]);
  // reading writes nothing
  const p = withBiz(BIZ), was = JSON.stringify(p); checklist(compute(p, { today: TODAY }), p.whatIfs.business); assert.equal(JSON.stringify(p), was);
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
async function drawPage(plan0, { answer = true, today = TODAY } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const asked = [];
  let cur = migrate(structuredClone(plan0)); const saved = [];
  let n = 0;
  const store = { get: () => cur, update: (fn) => { const dft = structuredClone(cur); fn(dft); cur = dft; saved.push(dft); } };
  const draw = () => {
    const root = new FakeElement("main");
    const ctx = { ui: { ...ui, uid: () => `new-${++n}`, confirm: (q) => { asked.push(q); return answer; } }, fmt: { ...fmt, today: () => today }, plan: cur, route: { rest: [], query: {} }, module: { group: "career", id: "business" }, computeOf: () => null, store };
    render(root, ctx);
    return root;
  };
  return { draw, saved, asked, textOf, plan: () => cur };
}
const partsOpen = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
const partEl = (root, id) => root.querySelectorAll("details").find((x) => x.dataset.part === id);
const btnOf = (root, words) => root.querySelectorAll("button").find((b) => b.textContent === words);
const boxOf = (el, name) => el.querySelector(`[name="${name}"]`);
const shutIn = (el) => { for (let a = el.parentNode; a; a = a.parentNode) if (a.tagName === "DETAILS" && !a.hasAttribute("open")) return true; return false; };
const filledOf = (root) => root.all().filter((b) => b.tagName === "BUTTON" || (b.tagName === "A" && /\bbtn\b/.test(String(b.className ?? "")))).filter((b) => !String(b.className ?? "").includes("secondary") && (b.tagName === "A" || b.getAttribute("type") === "submit" || b.textContent === "Use this profit on Income") && !shutIn(b));
const boxesShown = (root) => root.all().filter((b) => /^(INPUT|SELECT|TEXTAREA)$/.test(b.tagName) && b.getAttribute("type") !== "hidden" && !shutIn(b));

test("the page opens simple: the answer, the plans for retirement, then quiet rows; no fold by hand, no box, one filled button at most", async () => {
  const a = await drawPage(withBiz(BIZ));
  const root = a.draw(), t = a.textOf(root);
  const d = compute(withBiz(BIZ), { today: TODAY });
  assert.equal(a.textOf(root.querySelector("h1")), answerFor(d, $).title);
  assert.match(t, new RegExp(answerFor(d, $).line.replace(/[$().]/g, "\\$&")));
  assert.match(t, /You take out \$3,000 a month; that leaves \$[\d,]+ a month in the business\./);
  assert.deepEqual(partsOpen(root), { missed: false, business: false, scorp: false, how: false });
  assert.deepEqual(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => a.textOf(x.querySelector(".fold-title"))), ["Costs people often forget to count", "The business", "As an S corporation", "How this is worked out"]);
  assert.equal(a.textOf(partEl(root, "missed").querySelector(".fold-status")), "4 not counted yet");
  assert.equal(a.textOf(partEl(root, "business").querySelector(".fold-status")), "6 set by you", "revenue, home office, miles, what is taken out and the two expenses");
  assert.match(a.textOf(partEl(root, "scorp").querySelector(".fold-status")), /^would (save|cost) \$[\d,]+$/);
  assert.equal(root.querySelectorAll("details").filter((x) => !x.dataset.part && !String(x.className).includes("form-more")).length, 0, "no fold by hand (R10)");
  assert.equal(boxesShown(root).length, 0, "no box on the first view");
  assert.deepEqual(filledOf(root).map((b) => a.textOf(b)), ["Use this profit on Income"], "the one filled button");
  // the retirement plans stay in sight (each saving is worth money), the SIMPLE IRA too late on October 30
  assert.match(t, /Retirement plans for the business/); assert.match(t, /SIMPLE IRA\s*too late now/); assert.match(t, /Putting in the most saves about \$[\d,]+ in tax this year\./);
  // moved, never deleted: the profit, the tax and the plans' rules are in How this is worked out
  const how = a.textOf(partEl(root, "how"));
  for (const re of [/What customers paid\s*\$60,000/, /Home office \(\$5 a square foot\)\s*−\$750/, /Self-employment tax \(Social Security and Medicare\)/, /Only the business puts in: 20% of your earnings/, /Costs a month: \$[\d,]+, what must come in each month to break even\./]) assert.match(how, re);
  assert.match(a.textOf(root), /More on this/); assert.match(a.textOf(root), /What is the self-employment tax\?/);
  // opening and shutting writes nothing
  for (const p of root.querySelectorAll("details").filter((x) => x.dataset.part)) { p.setAttribute("open", ""); p.dispatch("toggle"); p.removeAttribute("open"); p.dispatch("toggle"); }
  assert.equal(a.saved.length, 0);
});

test("the empty plan: one sentence on what to do first and one filled way to start; The business waits one tap away", async () => {
  const a = await drawPage(emptyPlan());
  const root = a.draw();
  assert.equal(a.textOf(root.querySelector("h1")), "Your small business");
  assert.deepEqual(filledOf(root).map((b) => a.textOf(b)), ["Add it on Income"]);
  assert.equal(boxesShown(root).length, 0);
  assert.deepEqual(partsOpen(root), { missed: false, business: false });
  // no business yet: the costs list counts nothing as missed (person critic P2)
  assert.equal(a.textOf(partEl(root, "missed").querySelector(".fold-status")), "a short list");
  assert.equal(a.textOf(partEl(root, "business").querySelector(".fold-status")), "not set yet");
  // the boxes a person may not know offhand carry a labelled example in their help line (P4), never grey text
  for (const [box, words] of [["homeOfficeSqft", /For example, a 10 by 12 foot room is 120\./], ["miles", /For example, 50 miles a week is 2,600 a year\./]]) {
    const el = boxOf(partEl(root, "business"), box);
    assert.match(a.textOf(el.closest("label")), words, box); assert.equal(el.getAttribute("placeholder") ?? null, null, `${box}: no grey text`);
  }
  // Save with nothing typed is held back with words (stress test F5)
  const f = boxOf(partEl(root, "business"), "revenue").closest("form");
  f.dispatch("submit");
  assert.equal(a.saved.length, 0); assert.match(a.textOf(f), /Type what customers pay a year, or the business's name, first\./);
  boxOf(f, "revenue").value = "24000"; f.dispatch("submit");
  assert.equal(a.saved.length, 1); assert.equal(a.plan().whatIfs.business.revenue, 24000);
  const r2 = a.draw();
  assert.equal(partsOpen(r2).business, true); assert.match(a.textOf(partEl(r2, "business")), /^.*Saved\. After tax the business now leaves you about \$[\d,]+ a month\./);
});

test("a checklist row's button opens The business where it is, the box ready or the expense form with its kind picked; nothing is saved", async () => {
  const a = await drawPage(withBiz(BIZ));
  let root = a.draw();
  const missed = partEl(root, "missed");
  assert.ok(btnOf(missed, "Type what you pay"), "health insurance is not counted yet");
  btnOf(missed, "Type what you pay").click();
  assert.equal(partsOpen(root).business, true, "The business opens");
  assert.ok(boxOf(partEl(root, "business"), "healthPremiums"));
  btnOf(missed, "Add the bill").click();
  const f = btnOf(partEl(root, "business"), "Add the expense").closest("form");
  assert.equal(boxOf(f, "category").value, "phone", "the expense form opens with Phone and internet picked");
  btnOf(missed, "Add a course").click();
  assert.equal(boxOf(btnOf(partEl(root, "business"), "Add the expense").closest("form"), "category").value, "education", "the same form, its kind changed");
  assert.equal(a.saved.length, 0, "nothing saved by a tap here");
  // the retirement row goes to Retirement contributions; the counted rows have no button
  assert.equal(missed.querySelectorAll("a").find((x) => a.textOf(x) === "Retirement contributions")?.getAttribute("href"), "#/retirement/contributions");
  for (const k of ["office", "miles", "supplies"]) assert.equal(missed.querySelectorAll("li").find((x) => x.dataset.cost === k).querySelectorAll("button").length, 0, k);
  // an amount left empty is held back with words; typed, the expense is added and the green line names the new answer
  boxOf(f, "amount").value = ""; f.dispatch("submit");
  assert.equal(a.saved.length, 0);
  boxOf(f, "amount").value = "60"; boxOf(f, "name").value = "Photo course"; f.dispatch("submit");
  assert.equal(a.saved.length, 1);
  const e = a.plan().whatIfs.business.expenses.at(-1);
  assert.deepEqual({ category: e.category, amount: e.amount, name: e.name }, { category: "education", amount: 60, name: "Photo course" });
  root = a.draw();
  const d2 = compute(a.plan(), { today: TODAY });
  assert.match(a.textOf(partEl(root, "business")), new RegExp(`Photo course added\\. After tax the business now leaves you about \\${$(d2.keepMonthly)} a month\\.`));
});

test("S11 (R17): a save in a row keeps that row open with its green line; no other row opens or shuts; the next visit opens shut", async () => {
  const a = await drawPage(withBiz(BIZ));
  let root = a.draw();
  assert.deepEqual(partsOpen(root), { missed: false, business: false, scorp: false, how: false });
  const f = boxOf(partEl(root, "business"), "miles").closest("form");
  boxOf(f, "miles").value = "4000"; f.dispatch("submit");
  assert.equal(a.saved.length, 1); assert.equal(a.plan().whatIfs.business.miles, 4000);
  root = a.draw();
  assert.deepEqual(partsOpen(root), { missed: false, business: true, scorp: false, how: false }, "the row just saved stays open, no other moves");
  assert.match(a.textOf(partEl(root, "business")), /Saved\. After tax the business now leaves you about \$[\d,]+ a month\./);
  root = a.draw();
  assert.deepEqual(partsOpen(root), { missed: false, business: false, scorp: false, how: false }, "the next draw opens shut");
  // the S corporation's figures: Compare keeps its row open and says the new saving or cost
  const sf = boxOf(partEl(root, "scorp"), "salary").closest("form");
  boxOf(sf, "salary").value = "30000"; sf.dispatch("submit");
  root = a.draw();
  assert.deepEqual(partsOpen(root), { missed: false, business: false, scorp: true, how: false });
  assert.match(a.textOf(partEl(root, "scorp")), /Saved\. As an S corporation you would now (keep|pay) about \$[\d,]+ more a year\./);
  // removing an expense keeps The business open, with its line
  root = a.draw();
  btnOf(partEl(root, "business"), "Remove").click();
  root = a.draw();
  assert.deepEqual(partsOpen(root), { missed: false, business: true, scorp: false, how: false });
  assert.match(a.textOf(partEl(root, "business")), /Equipment removed\. After tax the business now leaves you about \$[\d,]+ a month\./);
  assert.equal(a.plan().whatIfs.business.expenses.length, 1);
});
