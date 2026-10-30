import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, yearTaxes, targetsFor, RULE, PRESETS, FICA, SLACK } from "./compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { compute as computeSE, seTax } from "../../taxes/self-employment/compute.js";
import { compute as computePaycheck } from "../paycheck/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const fam = (fn) => { const p = familyPlan(TODAY); if (fn) fn(p); return p; };
const by = (d) => Object.fromEntries(d.buckets.map((b) => [b.key, b]));

test("the rule and the presets add up to 100%; own shares are scaled to 100%", () => {
  assert.deepEqual(RULE, { needs: 0.5, wants: 0.3, savings: 0.2 });
  for (const p of Object.values(PRESETS)) near(p.needs + p.wants + p.savings, 1);
  assert.equal(targetsFor({}).from, "50-30-20");
  assert.equal(targetsFor({ preset: "60-20-20" }).needs, 0.6);
  const own = targetsFor({ preset: "own", needs: 0.55, wants: 0.25, savings: 0.3 });
  near(own.needs, 0.55 / 1.1); near(own.savings, 0.3 / 1.1); assert.equal(own.scaled, true);
  assert.equal(targetsFor({ preset: "own" }).from, "50-30-20", "own with nothing typed: the rule");
  assert.equal(targetsFor({ preset: "own", needs: 0.6 }).from, "50-30-20", "own with one share typed: the rule until all three are");
  // the plan's choice feeds the page: 70/20/10 aims for 10% saved
  const d = compute(fam((q) => { q.whatIfs = { ...(q.whatIfs ?? {}), budgetPercent: { preset: "70-20-10" } }; }), { today: TODAY });
  const s = by(d).savings; near(s.target, 0.1); near(s.targetMonthly, 0.1 * d.month.afterTax);
});

test("income after tax by hand: federal income tax, each person's Social Security and Medicare, self-employment tax, the state", () => {
  const p = fam();
  const d = compute(p, { today: TODAY });
  // Ana 101,400 and Bo 62,400 of pay; Bo's 7,200 of photography pays self-employment tax after his wages
  const se = seTax(7200, { wages: 62400, wageBase: 184500 }).total;
  const payroll = FICA.ss * 101400 + FICA.medicare * 101400 + FICA.ss * 62400 + FICA.medicare * 62400 + se;
  near(d.month.gross, 171000 / 12); near(d.month.payroll, payroll / 12);
  // the federal tax with half the self-employment tax off and the 20% deduction: the Self-employment page's "with" figure
  near(d.month.federal * 12 + se, computeSE(p, { today: TODAY }).taxWith, 0.01);
  assert.equal(d.month.state, 0, "Texas"); near(d.month.afterTax, (171000 - d.month.federal * 12 - payroll) / 12);
});

test("Social Security stops at the wage base; pay linked to no one is its own earner; the Paycheck page's pre-tax benefits come off", () => {
  const big = yearTaxes(fam((q) => { q.income.find((x) => x.id === "i-ana").amount = 10000; }), { today: TODAY });   // 260,000 a year
  near(big.ss, FICA.ss * 184500 + FICA.ss * 62400); near(big.medicare, FICA.medicare * (260000 + 62400));
  near(big.extraMedicare, 0.009 * (260000 + 62400 + 7200 * 0.9235 - 250000), 1e-6);
  const two = yearTaxes(fam((q) => { q.income = [{ id: "j1", name: "Job one", type: "salary", personId: "", amount: 150000, period: "annual" }, { id: "j2", name: "Job two", type: "salary", personId: "", amount: 150000, period: "annual" }]; }), { today: TODAY });
  near(two.ss, 2 * FICA.ss * 150000);
  const hsa = fam((q) => { q.taxes.hsa = { contribution: 8000 }; });
  const pc = computePaycheck(hsa, { today: TODAY }).people;
  near(yearTaxes(hsa, { today: TODAY }).ss + yearTaxes(hsa, { today: TODAY }).medicare, pc.reduce((t, x) => t + x.yearly.ss + x.yearly.medicare, 0), 0.05);
});

test("business income after the Self-employment page's expenses; the 0.9% on self-employment earnings; a refund of the child tax credit", () => {
  const p = fam((q) => { q.whatIfs = { ...(q.whatIfs ?? {}), selfEmployment: { expenses: 5000 } }; });
  const T = yearTaxes(p, { today: TODAY });
  near(T.business.profit, 2200); near(T.gross, 171000 - 5000); near(T.se, seTax(2200, { wages: 62400, wageBase: 184500 }).total);
  near(T.federal + T.se, computeSE(p, { today: TODAY }).taxWith, 0.01);
  near(compute(p, { today: TODAY }).month.bizExpenses, 5000 / 12);
  // single, 190,000 of pay and 100,000 of business: 0.9% on 190,000 + 92,350 above 200,000
  const hi = yearTaxes(fam((q) => { q.household.filingStatus = "single"; q.household.people = q.household.people.filter((x) => x.id === "p-ana"); q.income = [{ id: "w", name: "Pay", type: "salary", personId: "p-ana", amount: 190000, period: "annual" }, { id: "b", name: "Shop", type: "business", personId: "p-ana", amount: 100000, period: "annual" }]; q.retirement.contributions = []; }), { today: TODAY });
  near(hi.extraMedicare, 0.009 * (190000 + 92350 - 200000), 1e-6);
  // head of household with two children and 25,000 of pay: the refundable credit is more than the tax
  const low = yearTaxes(fam((q) => { q.household.filingStatus = "head_of_household"; q.household.people = q.household.people.filter((x) => x.id !== "p-bo").concat({ id: "p-dee", name: "Dee", role: "dependent", birthDate: "2018-01-01" }); q.income = [{ id: "w", name: "Pay", type: "salary", personId: "p-ana", amount: 25000, period: "annual" }]; q.retirement.contributions = []; }), { today: TODAY });
  assert.ok(low.federal < 0, "a credit, not zero"); near(low.afterTax, 25000 - low.federal - low.payroll);
});

test("one-off income on the Federal tax page (a sale, typed amounts) is left out, with a note", () => {
  const base = compute(fam(), { today: TODAY });
  const sold = compute(fam((q) => { q.taxes.gains = [{ proceeds: 80000, basis: 30000, held: "long" }]; q.taxes.thisYear = { ...(q.taxes.thisYear ?? {}), otherOrdinary: 60000 }; }), { today: TODAY });
  near(sold.month.afterTax, base.month.afterTax); assert.ok(sold.notes.some((n) => /not on the Income page/.test(n)));
  assert.ok(!base.notes.some((n) => /not on the Income page/.test(n)));
});

test("needs are the bills marked \"I must pay this\", wants the rest, savings retirement + goals + what is left", () => {
  const p = fam();
  const d = compute(p, { today: TODAY }), b = by(d);
  const exp = computeExpenses(p, { today: TODAY });
  near(b.needs.monthly, exp.essentialMonthly); near(b.wants.monthly, exp.monthly - exp.essentialMonthly);
  const retirement = computeContributions(p, { today: TODAY }).yearly / 12;
  near(d.saving.retirement, retirement);
  near(b.savings.monthly, d.month.afterTax - b.needs.monthly - b.wants.monthly);
  near(b.needs.share, b.needs.monthly / d.month.afterTax); near(b.needs.targetMonthly, 0.5 * d.month.afterTax); near(b.needs.gap, b.needs.monthly - 0.5 * d.month.afterTax);
  assert.ok(d.needs[0].monthly >= d.needs[1].monthly, "largest first");
  assert.equal(d.saving.unlisted, true, "the family's expenses leave over 10% of income unlisted");
  // a goal already reached is not saving any more
  const done = compute(fam((q) => { q.goals.find((g) => g.id === "g-car").saved = 30000; }), { today: TODAY });
  near(done.saving.goals, d.saving.goals - 300);
});

test("taxes listed on Expenses are left out (they come off income already); the Debts page's payments are needs when Expenses lists none", () => {
  const base = compute(fam(), { today: TODAY });
  const t = compute(fam((q) => { q.expenses.push({ id: "x-tax", name: "Estimated tax", category: "taxes", amount: 900, period: "quarterly", essential: true }); }), { today: TODAY });
  near(by(t).needs.monthly, by(base).needs.monthly); near(t.taxesListed, 300);
  const p = fam((q) => { q.expenses = q.expenses.filter((x) => x.category !== "debt"); });
  const exp = computeExpenses(p, { today: TODAY }), d = compute(p, { today: TODAY });
  assert.ok(exp.debtFromDebts > 0);
  near(by(d).needs.monthly, exp.essentialMonthly);
  const row = d.needs.find((x) => x.id === null); near(row.monthly, exp.debtFromDebts);
});

test("over and under: needs and wants above their share by more than the slack, savings below theirs", () => {
  const p = fam((q) => { q.expenses.push({ id: "x-rent", name: "Second home", category: "housing", amount: 6000, period: "monthly", essential: true }, { id: "x-fun", name: "Boat", category: "fun", amount: 3000, period: "monthly", essential: false }); });
  const b = by(compute(p, { today: TODAY }));
  assert.equal(b.needs.status, "over"); assert.equal(b.wants.status, "over");
  // no retirement saving, no goals, and spending that leaves 5% over: savings under 20% - the slack
  const q = fam((x) => { x.retirement.contributions = []; x.goals = []; });
  const A = compute(q, { today: TODAY }).month.afterTax;
  const spend = fam((x) => { x.retirement.contributions = []; x.goals = []; x.expenses.push({ id: "x-fill", name: "Everything else", category: "fun", amount: A * 0.95 - computeExpenses(x, { today: TODAY }).monthly, period: "monthly", essential: false }); });
  const s = by(compute(spend, { today: TODAY }));
  near(s.savings.share, 0.05, 1e-6); assert.equal(s.savings.status, "under"); near(s.savings.gap, (0.05 - 0.2) * A, 1e-6);
  // within the slack counts as on target: needs at 51% are on, at 53% over
  const at = (share) => by(compute(fam((x) => { const A0 = compute(x, { today: TODAY }).month.afterTax; x.expenses.push({ id: "x-need", name: "Rent", category: "housing", amount: share * A0 - computeExpenses(x, { today: TODAY }).essentialMonthly, period: "monthly", essential: true }); }), { today: TODAY })).needs;
  assert.equal(SLACK, 0.02); near(at(0.51).share, 0.51, 1e-9); assert.equal(at(0.51).status, "on"); assert.equal(at(0.53).status, "over");
});

test("spending above income after tax: nothing left over, the shortfall, a note", () => {
  const p = fam((q) => { q.expenses.push({ id: "x-big", name: "Too much", category: "fun", amount: 20000, period: "monthly", essential: false }); });
  const d = compute(p, { today: TODAY });
  assert.equal(d.saving.leftover, 0); assert.ok(d.saving.short > 0);
  near(d.saving.short, by(d).needs.monthly + by(d).wants.monthly + d.saving.retirement + d.saving.goals - d.month.afterTax);
  assert.ok(d.saving.short > 0.5, "the view says the shortfall");
});

test("a state with an income tax comes off; with no expense marked as a must-pay, a note", () => {
  const pa = compute(fam((q) => { q.household.state = "PA"; }), { today: TODAY });
  assert.ok(pa.month.state > 0); near(pa.month.afterTax, pa.month.gross - pa.month.federal - pa.month.payroll - pa.month.state);
  const none = compute(fam((q) => { q.expenses.forEach((e) => { e.essential = false; }); }), { today: TODAY });
  assert.equal(none.needs.length, 0); assert.ok(none.notes.some((n) => /No expense is marked/.test(n)));
});

test("a state whose tax cannot be worked out: not counted, with a note", () => {
  const d = compute(fam((q) => { q.household.state = ""; }), { today: TODAY });   // no state chosen
  assert.equal(d.month.stateKnown, false); assert.equal(d.month.state, 0); assert.ok(d.notes.some((n) => /state's income tax is not taken off/.test(n)));
});

test("not ready without income or regular spending (one-offs and taxes do not count)", () => {
  assert.deepEqual(compute(emptyPlan(), { today: TODAY }).missing, ["income", "expenses"]);
  const p = fam((q) => { q.expenses = []; q.debts = []; });
  assert.deepEqual(compute(p, { today: TODAY }).missing, ["expenses"]);
  const once = fam((q) => { q.expenses = [{ id: "x1", name: "New tyres", category: "transport", amount: 900, period: "once" }]; q.debts = []; });
  assert.deepEqual(compute(once, { today: TODAY }).missing, ["expenses"]);
});
