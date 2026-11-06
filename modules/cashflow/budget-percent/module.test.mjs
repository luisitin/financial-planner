import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, yearTaxes, targetsFor, RULE, PRESETS, FICA, SLACK } from "./compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { compute as computeSE, seTax } from "../../taxes/self-employment/compute.js";
import { compute as computePaycheck } from "../paycheck/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
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
  // the federal tax with half the self-employment tax off and the 20% deduction, by hand in the 1040's order:
  // self-employment tax 7,200 x 92.35% x 15.3% = 1,017.33, half 508.66; AGI 158,780 - 508.66 = 158,271.34; the 20% deduction
  // after AGI (line 13): 20% x (7,200 - 508.66) = 1,338.27; taxable 158,271.34 - 32,200 - 1,338.27 = 124,733.07; tax
  // 11,600 + 22% x 23,933.07 = 16,865.27; less the child care credit on Cy's care (35% less a point per 4,000 of joint AGI
  // over 150,000, or part: 32% of 3,000 = 960) and the child tax credit 2,200: 13,705.27; with the self-employment tax 14,722.60.
  // (The Self-employment page takes the 20% deduction off AGI instead, which puts its AGI at 156,933 and its credit at 33%:
  // its total is 30 lower. That is taxes/self-employment's lane; this page follows the 1040.)
  const half = seTax(7200, { wages: 62400, wageBase: 184500 }).half;
  near(half, 0.5 * 7200 * 0.9235 * 0.153, 1e-9);
  near(d.month.federal * 12, 13705.27, 0.02); near(d.month.federal * 12 + se, 14722.60, 0.02);
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
  // the Visa's extra on Debts ($210 on top of its required $190) is saving, not a want (2026-11-02)
  near(d.saving.debts, 210); near(b.needs.monthly, exp.essentialMonthly); near(b.wants.monthly, exp.monthly - exp.essentialMonthly - d.saving.debts);
  assert.ok(d.needs.some((x) => x.name === "Visa card payment (from Debts)" && Math.abs(x.monthly - 190) < 0.01));
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
  near(d.needs.filter((x) => x.id === null).reduce((t, x) => t + x.monthly, 0), exp.debtRequired);
  near(exp.debtFromDebts - exp.debtRequired, d.saving.debts);
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
  // the Visa's $210 extra on Debts is saving too (0.05 of spending left plus it)
  const extra = compute(spend, { today: TODAY }).saving.debts, sh = 0.05 + extra / A;
  near(s.savings.share, sh, 1e-6); assert.equal(s.savings.status, "under"); near(s.savings.gap, (sh - 0.2) * A, 1e-6);
  // within the slack counts as on target: needs at 51% are on, at 53% over
  const at = (share) => by(compute(fam((x) => { const A0 = compute(x, { today: TODAY }).month.afterTax; x.expenses.push({ id: "x-need", name: "Rent", category: "housing", amount: share * A0 - computeExpenses(x, { today: TODAY }).essentialMonthly, period: "monthly", essential: true }); }), { today: TODAY })).needs;
  assert.equal(SLACK, 0.02); near(at(0.51).share, 0.51, 1e-9); assert.equal(at(0.51).status, "on"); assert.equal(at(0.53).status, "over");
});

test("the careful month (review 2026-11-02): side income above what you count on, after its tax, is off the month, as on Next best action", async () => {
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { compute: income } = await import("../income/compute.js");
  const { heldAfterTax } = await import("./compute.js");
  const plain = compute(fam(), { today: TODAY });
  assert.equal(plain.month.held, 0); assert.equal(plain.month.heldGross, 0);
  for (const countOn of [300, 0]) {
    const p = fam((q) => { q.income.find((x) => x.id === "i-side").countOn = countOn; });
    const d = compute(p, { today: TODAY }), T = yearTaxes(p, { today: TODAY });
    // by hand: the year's taxes less the same taxes with $countOn a month typed as the side income, over 12
    const typed = fam((q) => { q.income.find((x) => x.id === "i-side").amount = countOn; });
    const TC = yearTaxes(typed, { today: TODAY });
    const tax = ((T.federal + T.payroll + T.state) - (TC.federal + TC.payroll + TC.state)) / 12;
    assert.ok(tax > 0, "the part held back carries tax");
    near(d.month.heldGross, 600 - countOn); near(d.month.held, 600 - countOn - tax, 1e-6);
    near(heldAfterTax(p, { today: TODAY, inc: income(p, { today: TODAY }), T }).held, d.month.held, 1e-9);
    // the taxes stay the whole year's; the month after tax is the careful one
    near(d.month.federal, T.federal / 12); near(d.month.afterTax, T.afterTax / 12 - d.month.held, 1e-6);
    near(d.month.afterTax, plain.month.afterTax - d.month.held, 1e-6);
    // the same money left over as the app's left-over figure (Next best action), and the shares on the careful month
    const nb = next(p, { today: TODAY }).spare;
    near(nb.held, d.month.held, 1e-6);
    near(d.saving.leftover - d.saving.short, nb.monthly, 0.01);
    near(by(d).needs.share, by(d).needs.monthly / d.month.afterTax, 1e-9);
  }
  // no year's taxes to work it again from: the whole part held back comes off (Next best action's fallback)
  const p = fam((q) => { q.income.find((x) => x.id === "i-side").countOn = 300; });
  assert.deepEqual(heldAfterTax(p, { today: TODAY, inc: income(p, { today: TODAY }), T: null }), { gross: 300, tax: 0, held: 300 });
});

test("spending above income after tax: nothing left over, the shortfall, a note", () => {
  const p = fam((q) => { q.expenses.push({ id: "x-big", name: "Too much", category: "fun", amount: 20000, period: "monthly", essential: false }); });
  const d = compute(p, { today: TODAY });
  assert.equal(d.saving.leftover, 0); assert.ok(d.saving.short > 0);
  near(d.saving.short, by(d).needs.monthly + by(d).wants.monthly + d.saving.retirement + d.saving.goals + d.saving.debts - d.month.afterTax);
  assert.ok(d.saving.short > 0.5, "the view says the shortfall");
});

test("a state with an income tax comes off; with no expense marked as a must-pay, a note", () => {
  const pa = compute(fam((q) => { q.household.state = "PA"; }), { today: TODAY });
  assert.ok(pa.month.state > 0); near(pa.month.afterTax, pa.month.gross - pa.month.federal - pa.month.payroll - pa.month.state);
  const none = compute(fam((q) => { q.expenses.forEach((e) => { e.essential = false; }); }), { today: TODAY });
  // only the required payment of a debt kept on Debts alone is still a need
  assert.ok(none.needs.every((x) => x.id === null)); assert.ok(none.notes.some((n) => /No expense is marked/.test(n)));
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

test("the full month and where this page's left over is not the app's left-over figure (review 2026-11-02, round 5)", async () => {
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { aboutTen } = await import("./compute.js");
  // what a month that brings the Income page's amount leaves: left over (or short) plus the part held back; said to $10
  const p = fam((q) => { q.income.find((x) => x.id === "i-side").countOn = 0; });
  const d = compute(p, { today: TODAY }), nb = next(p, { today: TODAY }).spare;
  near(d.saving.full, d.saving.leftover - d.saving.short + d.month.held, 1e-9);
  assert.equal(d.saving.fullAbout, aboutTen(d.saving.full));
  near(d.saving.full, nb.full, 0.01); assert.equal(d.saving.fullAbout, nb.fullAbout);
  // the same number as the app's left-over figure only while Expenses lists no tax and no debt plan pays an extra:
  // a tax on Expenses (a property tax filed under taxes) is left out of needs here, and counted as spending there
  const taxed = fam((q) => { q.expenses.push({ id: "x-ptax", name: "Property tax", category: "taxes", amount: 4800, period: "annual", essential: true }); });
  const dt = compute(taxed, { today: TODAY }), nt = next(taxed, { today: TODAY }).spare;
  near(dt.taxesListed, 400, 1e-9);
  near((dt.saving.leftover - dt.saving.short) - nt.monthly, 400, 0.01);
  // the saved debt plan's extra (Pay off debts) is spoken for on both, read by the one helper (savedPlan): saving here,
  // under "extra on debts", and the left over is the app's figure again (round 5; it used to be $150 more here)
  const extra = fam((q) => { q.debtPlan = { ...(q.debtPlan ?? {}), extra: 150, order: "avalanche" }; });
  const de = compute(extra, { today: TODAY }), ne = next(extra, { today: TODAY }), d0 = compute(fam(), { today: TODAY });
  assert.equal(ne.spare.debtExtra, 150);
  assert.equal(de.saving.debtPlan, 150);
  near(de.saving.debts - d0.saving.debts, 150, 1e-9);
  near((de.saving.leftover - de.saving.short) - ne.spare.monthly, 0, 0.01);
  near((de.saving.leftover - de.saving.short) - (d0.saving.leftover - d0.saving.short), -150, 1e-9);
  near(de.buckets.find((b) => b.key === "savings").monthly, d0.buckets.find((b) => b.key === "savings").monthly, 1e-9, "moved from left over to extra on debts");
});

// A freelancer of one, invented: design work and weekend workshops, both counted at what can be counted on (Side
// income's "count on"), a card with a saved debt plan extra (review 2026-11-02, round 5)
function freelancer(extra = 150) {
  const p = emptyPlan();
  const D = "2026-11-02";
  p.household = { people: [{ id: "p-rae", name: "Rae", role: "self", birthDate: "1986-06-15", retirementAge: 65 }], filingStatus: "single", state: "CO" };
  p.accounts = [
    { id: "a-chk", name: "Checking", type: "checking", balance: 7400, asOf: D, ownerId: "p-rae", history: [] },
    { id: "a-sav", name: "Savings", type: "savings", balance: 9500, asOf: D, ownerId: "p-rae", history: [] },
    { id: "a-card", name: "Credit card", type: "credit", balance: 1800, asOf: D, ownerId: "p-rae", history: [] },
  ];
  p.income = [
    { id: "i-free", name: "Freelance design", type: "business", personId: "p-rae", amount: 6500, period: "monthly", growth: 0.02, taxable: true, countOn: 4100 },
    { id: "i-wk", name: "Weekend workshops", type: "business", personId: "p-rae", amount: 600, period: "monthly", growth: 0, taxable: true, countOn: 300 },
  ];
  const e = (id, name, category, amount, essential, period = "monthly") => ({ id, name, category, amount, period, essential, inflates: true });
  p.expenses = [e("e-rent", "Rent", "housing", 1850, true), e("e-util", "Utilities", "utilities", 170, true), e("e-groc", "Groceries", "groceries", 480, true),
    e("e-health", "Health insurance", "health", 540, true), e("e-car", "Car", "transport", 260, true), e("e-phone", "Phone", "phone", 120, true),
    e("e-eat", "Eating out", "dining", 300, false), e("e-fun", "Fun", "fun", 200, false), e("e-trip", "Trip", "travel", 2400, false, "annual")];
  p.debts = [{ id: "d-card", accountId: "a-card", rate: 0.229, minPayment: 60, extra: 0 }];
  p.goals = [];
  if (extra) p.debtPlan = { extra, order: "avalanche" };
  return p;
}

test("the freelancer with a $150 saved debt plan extra: Budget (50/30/20) and every page say the same full month and gap (round 5)", async () => {
  const D = "2026-11-02";
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { compute: alerts } = await import("../../overview/alerts/compute.js");
  const { compute: health } = await import("../../overview/health-score/compute.js");
  const { standing } = await import("../../overview/setup/compute.js");
  const { savedPlan } = await import("../../debt/payoff/compute.js");
  const { money } = await import("../../../core/format.js");
  const p = freelancer(150);
  const n = next(p, { today: D }), d = compute(p, { today: D });
  assert.equal(savedPlan(p, { today: D }).extra, 150);
  assert.equal(n.spare.debtExtra, 150); assert.equal(d.saving.debtPlan, 150);
  // short in a lean month, a full month leaves money: the case every page words
  assert.ok(n.spare.monthly < 0 && n.spare.held > 0.5 && n.spare.full > 5);
  // Budget's left over and full month are the app's: the same gap, the same "about $X"
  near(d.saving.leftover - d.saving.short, n.spare.monthly, 0.01);
  near(d.saving.full, n.spare.full, 0.01);
  assert.equal(d.saving.fullAbout, n.spare.fullAbout);
  assert.equal(d.saving.fullKind, "ahead");
  // without the extra the full month is $150 more on both
  const p0 = freelancer(0), n0 = next(p0, { today: D }), d0 = compute(p0, { today: D });
  near(d0.saving.full - d.saving.full, 150, 0.01); near(n0.spare.full - n.spare.full, 150, 0.01);
  // every page says it: Next best action, the done screen and Dashboard (standing), Needs attention, Health score
  const about = money(n.spare.fullAbout, "USD");
  assert.ok(n.steps.find((s) => s.id === "bills").detail.includes(`leaves about ${about}`));
  assert.equal(standing(p, { today: D }).lean.about, n.spare.fullAbout);
  assert.ok(alerts(p, { today: D }).alerts.find((a) => a.id === "overspend").detail.includes(`leaves about ${about}`));
  assert.ok(health(p, { today: D }).parts.find((x) => x.id === "saving").detail.includes(`leaves about ${about}`));
  // and Budget (50/30/20)'s own notice, drawn with a stand-in for the UI kit
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, querySelector() { return null; }, scrollIntoView() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form") };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => D }, plan: p, store: { update() {} } });
  const text = root.textContent.replace(/\s+/g, " ");
  assert.ok(text.includes(`Counting uneven pay at what you can count on, ${money(Math.round(-n.spare.monthly), "USD")} a month more goes out than comes in after tax. A month that brings the Income page's amount leaves about ${about}`), text.slice(0, 400));
  assert.ok(text.includes(`extra on debts ${money(150, "USD")}`));
});

test("fullKind: a full month within $5 of $0 just about breaks even (no 'about $0'), counted with short (round 5)", async () => {
  const { fullKind, EVEN_WITHIN } = await import("./compute.js");
  assert.equal(EVEN_WITHIN, 5);
  assert.deepEqual([4.99, 0, -4.99, 5, 1200, -5, -770].map(fullKind), ["even", "even", "even", "ahead", "ahead", "short", "short"]);
  assert.equal(fullKind(null), "even");
});

/** Jo, the single parent (the reviewer's plan): head of household in Ohio, 62,000 of pay, a child born 2022-07-15, 900 a
 * month of daycare; `acct` a child care account for 2026 on Benefits elections. */
function jo({ pay = 62000, acct = 0, care = 900, kids = 1 } = {}) {
  const p = emptyPlan();
  p.household.filingStatus = "head_of_household"; p.household.state = "OH";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  if (kids > 1) p.household.people.push({ id: "kid2", name: "Lou", role: "dependent", birthDate: "2019-09-01" });
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: pay, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "rent", name: "Rent", category: "housing", amount: 1300, period: "monthly", essential: true }];
  if (care) p.expenses.push({ id: "care", name: "Childcare and school", category: "childcare", amount: care, period: "monthly", essential: true });
  if (acct) p.whatIfs = { benefits: { jo: { dcfsaElect: acct, planYear: 2026 } } };
  return p;
}

test("yearTaxes: the child care account is the Federal estimate's (its own wages), not taxed as pay or the credit lost twice", () => {
  const NOV = "2026-11-02";
  // Jo with a 5,000 account for 2026: wages 57,000, no credit, 3,588 - 2,200 = 1,388 (the reviewer: Budget said 166 a month,
  // 1,988 a year, the account back in wages and the credit gone); the state on 57,000 of income
  for (const [plan, fed] of [[jo({ acct: 5000 }), 1388], [jo({ acct: 2000 }), 1398], [jo({ pay: 88000, acct: 5000 }), 4508], [jo({ acct: 5000, kids: 2 }), -1162], [jo(), 938]]) {
    const T = yearTaxes(plan, { today: NOV });
    const f = computeFederal(plan, { today: NOV }).result;
    near(T.federal, fed, 1e-6); near(T.federal, f.totalTax - f.additionalMedicare, 1e-6); near(T.agi, f.agi, 1e-6);
  }
  near(yearTaxes(jo({ acct: 5000 }), { today: NOV }).agi, 57000);
  // a health FSA comes off the wages too, as the Federal estimate has it
  const h = jo(); h.taxes.hsa = { fsa: 2000 };
  near(yearTaxes(h, { today: NOV }).federal, computeFederal(h, { today: NOV }).result.totalTax, 1e-6);
});

test("Next best action's month takes the same federal tax with a child care account (1,388 a year for Jo, not 2,040)", () => {
  const NOV = "2026-11-02";
  for (const [plan, fed] of [[jo({ acct: 5000 }), 1388], [jo({ pay: 30000 }), -1700], [jo(), 938]]) {
    const d = computeNext(plan, { today: NOV });
    near(d.spare.federalTax * 12, fed, 1e-6);
    near(d.spare.federalTax * 12, computeFederal(plan, { today: NOV }).result.totalTax, 1e-6);
  }
});

test("the child care account's money it would lose comes off the month after tax, as Next best action takes it (care fourth pass)", async () => {
  const NOV = "2026-11-02";
  // Jo with a 5,000 account for 2026 and no care on Expenses: all 5,000 is lost (Form 2441 line 14: "You forfeited an amount
  // if you didn't receive it because you didn't incur the expense"); the tax falls 1,120 (600 federal, 382.50 Social Security
  // and Medicare, 137.50 Ohio), so the month has 3,880 / 12 = 323.33 LESS after tax (it showed 6 more)
  const none = compute(jo({ care: 0 }), { today: NOV }), acct = compute(jo({ care: 0, acct: 5000 }), { today: NOV });
  near(acct.month.careLost, 5000 / 12, 1e-9); assert.equal(none.month.careLost, 0);
  near(acct.month.afterTax - none.month.afterTax, -3880 / 12, 0.005);
  near(yearTaxes(jo({ care: 0, acct: 5000 }), { today: NOV }).careLost, 5000, 1e-9);
  // Next best action leaves the same money: the same 323.33 less
  const n0 = computeNext(jo({ care: 0 }), { today: NOV }).spare, n1 = computeNext(jo({ care: 0, acct: 5000 }), { today: NOV }).spare;
  near(n1.monthly - n0.monthly, acct.month.afterTax - none.month.afterTax, 0.005);
  // 1,800 of care (150 a month): 3,200 of the 5,000 is lost
  near(compute(jo({ care: 150, acct: 5000 }), { today: NOV }).month.careLost, 3200 / 12, 1e-9);
  // and the page says so, under the month's taxes
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, querySelector() { return null; }, scrollIntoView() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form") };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => NOV }, plan: jo({ care: 0, acct: 5000 }), store: { update() {} } });
  assert.ok(root.textContent.replace(/\s+/g, " ").includes("The child care account would lose $417 a month"));
});

test("filing separately: each return's own business, half its self-employment tax, its 20% deduction and its 0.9% (care fourth pass)", () => {
  const NOV = "2026-11-02";
  // the family filing separately with a 3,750 child care account each: the law's figure (scratchpad mfs-law oracle) is Ana's
  // return 7,764.60 + Bo's 5,500.37 (his photography with half its self-employment tax off his own income and its 20%
  // deduction on his own return) + 1,017.33 of self-employment tax = 14,282.30, with no 0.9% (each return's own Medicare wages
  // are under 125,000). The page said 14,439.15: Bo's deductions on Ana's 22% return and 341.54 of 0.9% on the household's pay
  const p = familyPlan(NOV); p.household.filingStatus = "married_separate";
  p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const T = yearTaxes(p, { today: NOV });
  near(T.extraMedicare, 0, 1e-9); near(T.se, 1017.33, 0.01);
  near(T.federal, 7764.60 + 5500.37, 0.02); near(T.federal + T.se + T.extraMedicare, 14282.30, 0.02);
  // the same figure as the Withholding check's year (separateBusiness) and Next best action's month
  near(computeNext(p, { today: NOV }).spare.federalTax * 12, T.federal, 1e-6);
  // no accounts: 8,589.60 + 6,075.68 + 1,017.33 = 15,682.61, still no 0.9%
  const q = familyPlan(NOV); q.household.filingStatus = "married_separate";
  const U = yearTaxes(q, { today: NOV });
  near(U.extraMedicare, 0, 1e-9); near(U.federal + U.se, 15682.61, 0.02);
  // filing jointly nothing moves: 14,722.60 as before
  near(yearTaxes(familyPlan(NOV), { today: NOV }).federal + yearTaxes(familyPlan(NOV), { today: NOV }).se, 14722.60, 0.02);
});
