import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, homeOffice, soleTax, scorpTax, PAYROLL } from "./compute.js";
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
const ctx = (p) => { const ti = taxInputs(p, { today: TODAY }); return { inputs: ti.inputs, params: ti.params, otherOrdinary: Math.max(0, ti.inputs.otherOrdinary - 7200), wages: 62400, medicareWages: 101400 + 62400, wageBase: 184500 }; };

test("the home office, simplified: $5 a square foot, at most 300, never more than the profit", () => {
  assert.equal(homeOffice(150), 750); assert.equal(homeOffice(500), HOME_OFFICE.maxSqft * HOME_OFFICE.perSqft);
  assert.equal(homeOffice(200, 400), 400); assert.equal(homeOffice(200, -10), 0); assert.equal(homeOffice(null), 0);
});

test("the profit and loss: revenue less typed expenses, the miles at 76 cents and the home office", () => {
  const d = compute(withBiz(BIZ), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.incomeId, "i-side"); assert.equal(d.person.id, "p-bo");
  assert.equal(d.revenue, 60000); assert.equal(d.revenueFrom, "typed");
  near(d.typedTotal, 4000 + 720); near(d.miles.amount, 3000 * 0.76); assert.equal(d.homeOffice, 750);
  near(d.expensesTotal, 4720 + 2280 + 750); near(d.profit, 60000 - 7750);
  near(d.margin, 52250 / 60000); near(d.breakEvenMonthly, 7750 / 12);
});

test("the sole proprietor's tax by hand: self-employment tax, half of it and the 20% deduction off, 22% income tax", () => {
  const d = compute(withBiz(BIZ), { today: TODAY });
  const se = 52250 * SE.base * (SE.ss + SE.medicare);
  near(d.tax.se, se); near(d.tax.qbi, 0.2 * (52250 - se / 2));
  near(d.tax.income, 0.22 * (52250 - se / 2 - d.tax.qbi), 0.01);
  near(d.tax.total, d.tax.se + d.tax.income + d.tax.extra + d.tax.state);
  near(d.keepMonthly, (52250 - d.tax.total) / 12); assert.equal(d.draw, "ok");
  assert.equal(compute(withBiz({ ...BIZ, drawMonthly: 4000 }), { today: TODAY }).draw, "over");
});

test("self-employment tax stops at the wage base after the owner's wages; the 0.9% above the household's line", () => {
  const p = withBiz(BIZ);
  const c = ctx(p);
  const big = soleTax(200000, { ...c, wages: 150000 });
  near(big.se.ss, SE.ss * (184500 - 150000)); near(big.se.medicare, SE.medicare * 200000 * SE.base);
  near(big.extra, SE.addlMedicare * (163800 + 200000 * SE.base - 250000));
  assert.equal(soleTax(300, c).se.total, 0, "under $400 of earnings: none");
});

test("self-employed health insurance comes off income, up to the profit less half the tax", () => {
  const c = ctx(withBiz(BIZ));
  const a = soleTax(30000, c), b = soleTax(30000, { ...c, health: 6000 });
  assert.equal(b.healthOff, 6000); assert.ok(b.income < a.income);
  near(soleTax(5000, { ...c, health: 9000 }).healthOff, 5000 - seHalf(5000));
  function seHalf(x) { return x * SE.base * (SE.ss + SE.medicare) / 2; }
});

test("an S corporation by hand: payroll tax on the salary only, the rest passed through with the 20% deduction", () => {
  const p = withBiz({ ...BIZ, salary: 30000, scorpCosts: 1500 });
  const d = compute(p, { today: TODAY });
  const s = d.scorp;
  assert.equal(s.salaryFrom, "typed"); assert.equal(s.costs, 1500);
  near(s.employer, 30000 * (PAYROLL.ss + PAYROLL.medicare)); near(s.employee, 30000 * (PAYROLL.ss + PAYROLL.medicare));
  near(s.passed, 52250 - 30000 - s.employer - 1500); near(s.qbi, 0.2 * s.passed);
  const c = ctx(p);
  const none = federalTax({ ...c.inputs, otherOrdinary: c.otherOrdinary }, c.params);
  near(s.total, s.income - (none.totalTax - none.additionalMedicare) + s.employee + s.employer + s.state);
  near(s.saving, d.tax.total - (s.total + 1500));
  // the example salary and costs when none is typed
  const e = compute(withBiz(BIZ), { today: TODAY }).scorp;
  assert.equal(e.salaryFrom, "example"); assert.equal(e.salary, 31400); assert.equal(e.costs, SCORP_COSTS_EXAMPLE);
});

test("an S corporation pays off on a bigger profit", () => {
  const d = compute(withBiz({ revenue: 200000, salary: 80000, scorpCosts: 2000 }), { today: TODAY });
  assert.ok(d.scorp.saving > 0, `saving ${d.scorp.saving}`);
  const r = scorpTax(10000, 20000, 0, ctx(withBiz(BIZ)));
  assert.equal(r.salary, 10000, "a salary is never more than the profit");
});

test("the retirement plans: SEP 20% of earnings, solo 401(k) with the employee part, SIMPLE with its 3% match", () => {
  const d = compute(withBiz(BIZ), { today: TODAY });
  const earned = 52250 - d.tax.se / 2;
  near(d.earned, earned);
  const [sep, solo, simple] = d.plans;
  near(sep.room, 0.2 * earned); near(solo.room, 0.2 * earned + 24500);
  near(simple.room, SIMPLE[2026].limit + SIMPLE[2026].match * earned);
  assert.ok(sep.saved > 0 && solo.saved > sep.saved && simple.saved > sep.saved);
  // the saving is the tax worked again with the contribution off income (and off the 20% deduction's base)
  near(sep.saved, sep.room * 0.22 * 0.8, 0.5);
});

test("a 401(k) at a job leaves the solo 401(k) and SIMPLE less room; the 20% deduction's line", () => {
  const p = withBiz(BIZ, (q) => { q.accounts.push({ id: "a-bo401", name: "Bo's 401(k)", type: "401k", balance: 0, ownerId: "p-bo" }); q.retirement.contributions.push({ id: "c-bo2", accountId: "a-bo401", personId: "p-bo", amount: 1500, period: "monthly", employerMatch: 0 }); });
  const d = compute(p, { today: TODAY });
  const solo = d.plans.find((x) => x.key === "solo"), simple = d.plans.find((x) => x.key === "simple");
  near(solo.room, 0.2 * d.earned + (24500 - 18000));
  near(simple.room, 24500 - 18000 + 0.03 * d.earned);
  assert.ok(d.notes.some((n) => /already uses/.test(n)));
  assert.equal(d.qbiLine, QBI_LINE[2026].married_joint); assert.equal(d.qbiLimited, false);
});

test("not ready without a business; the Income page's amount when no revenue is typed", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.revenue, 7200); assert.equal(d.revenueFrom, "income");
  assert.ok(d.notes.some((n) => /No expenses typed/.test(n)));
});
