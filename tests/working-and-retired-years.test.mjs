// tests/working-and-retired-years.test.mjs -- L11 follow-ups from the critics' review of 2026-11-13 (rv/eng/critic-law.md,
// rv/eng/critic-engine.md): the year's tax and income before and after the household retires. Each test was written before the
// change it checks and failed on the code before it (rv/eng/fix.md):
// - a required withdrawal in a working year pays only the tax it adds (critic-law 1, critic-engine F4);
// - a required withdrawal is worked on last year-end's balance, not on this year's contributions (critic-law 7);
// - a figure typed just above the loans Get started's figure holds no longer falls off a cliff below them (critic-engine F6);
// and three rules behind the owner's switches (projection SWITCHES: off, so every answer stays as it was, until the owner says yes;
// a run turns one on with `params.switches`):
// - newIncomeSaved: a pension or Social Security that today's month does not hold, paid once its owner has stopped work and
//   before the household retires, goes into savings after its own tax (critic-law 2);
// - partnerPayNet: a partner at work after the household retires pays their own saving and, in brackets mode, payroll tax out of
//   their pay, and their pre-tax saving is not taxed (critic-law 4);
// - incomePaysTaxFirst: income pays the tax first in retired years (critic-engine F1).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as P from "../modules/retirement/projection/compute.js";
import { project } from "../core/math/retirement.js";
import { federalTax, paramsFor } from "../core/math/tax.js";
import { FEDERAL } from "../modules/taxes/federal/data/federal.js";
import { migrate } from "../core/schema/migrate.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { guessedPlan } from "../qa/fixtures/guessed-plan.mjs";
import { ARCHETYPES, COMMON_PACKS } from "../qa/households/lib/catalog.mjs";

const T = "2026-11-13";
const ON = (k) => ({ today: T, switches: { [k]: true } });
const sum = (b) => b.cash + b.taxable + b.deferred + b.free;

/** critic-law case 3d: Ana 61 works to 65 (the household retires in 2030); Bo 75, retired, with a $3,000 pension and $2,900 of
 * Social Security a month on the Income page (paid today) and a $300,000 old 401(k); brackets mode. */
function retiredPartnerWithRmd() {
  const p = migrate(familyPlan(T));
  p.household.people.find((x) => x.id === "p-ana").birthDate = "1965-05-20";
  const bo = p.household.people.find((x) => x.id === "p-bo"); bo.birthDate = "1951-11-02"; bo.retirementAge = 62;
  p.income = p.income.filter((x) => x.personId !== "p-bo");
  p.income.push({ id: "i-bo-pen", name: "Bo's pension", type: "pension", personId: "p-bo", amount: 3000, period: "monthly", growth: 0, taxable: true });
  p.income.push({ id: "i-bo-ss", name: "Bo's Social Security", type: "social", personId: "p-bo", amount: 2900, period: "monthly", growth: 0, taxable: true });
  p.accounts.find((a) => a.id === "a-bk401").balance = 300000;
  p.retirement.contributions = p.retirement.contributions.filter((c) => c.id !== "c-bo");
  p.retirement.taxMode = "brackets";
  return p;
}

test("defect A in a working year with a required withdrawal: it pays only the tax it adds; the pension and Social Security pay their own", () => {
  const d = P.compute(retiredPartnerWithRmd(), { today: T });
  const I = d.inputs;
  assert.equal(I.retireYear, 2030);
  let taxableStart = I.balances.taxable;
  const back = [];
  for (const r of d.rows.filter((x) => !x.retired)) {
    // the tax on the income alone (the pension and Social Security, no withdrawal), from the tax tables directly
    const alone = federalTax({ filingStatus: I.tax.filingStatus, otherOrdinary: r.taxInfo.ordinary - r.rmd, qualifiedIncome: 0, socialSecurity: r.taxInfo.socialSecurity, itemized: 0, ages65plus: r.ages.slice(0, 2).filter((a) => a >= 65).length }, I.tax.paramsFor(r.year)).totalTax;
    const put = r.balances.taxable / (1 + r.portfolioReturn) - taxableStart;
    assert.ok(Math.abs(put - (r.rmd - (r.taxes - alone))) < 0.01, `${r.year}: put back ${put}, the withdrawal less its own tax ${r.rmd - (r.taxes - alone)}`);
    assert.ok(r.withdrawn.cash + r.withdrawn.taxable + r.withdrawn.free < 0.005, `${r.year}: nothing else drawn`);
    back.push(put);
    taxableStart = r.balances.taxable;
  }
  // by hand (critic-law case 3b, 2026): RMD 300,000 x 0.7772 (Bo's share) / 24.6 = $12,195.12 at 75; with it, taxable income
  // $32,700.98 and tax $3,428.12; without it $10,140 and $1,014.00, so the withdrawal's own tax is $2,414.12 and $9,781.00 goes
  // back (it was 12,195.12 - 3,428.12 = $8,767.00: the pension's and Social Security's own $1,014 came out of savings)
  const r0 = d.rows[0];
  assert.equal(r0.rmd.toFixed(2), "12195.12");
  assert.equal(r0.taxes.toFixed(2), "3428.12");
  assert.equal(back[0].toFixed(2), "9781.00");
});

/** critic-law case 4: Ana 58 works to 66 (the household retires in 2035); Bo 63 stopped work at 62 and claims Social Security
 * (the Social Security page's figure, $2,900 a month at full age) at `claimAge`. */
function waitingToClaim(claimAge, mode = "flat") {
  const p = migrate(familyPlan(T));
  const ana = p.household.people.find((x) => x.id === "p-ana"), bo = p.household.people.find((x) => x.id === "p-bo");
  ana.birthDate = "1968-05-20"; ana.retirementAge = 67;
  bo.birthDate = "1963-11-02"; bo.retirementAge = 62;
  p.income = p.income.filter((x) => x.personId !== "p-bo");
  p.retirement.contributions = p.retirement.contributions.filter((c) => c.id !== "c-bo");
  p.retirement.socialSecurity["p-bo"].claimAge = claimAge;
  p.retirement.taxMode = mode;
  return p;
}

test("switch newIncomeSaved: Social Security a retired partner claims before the household retires goes into savings (today's month does not hold it)", () => {
  // off (the default): dropped with the month's income, as before
  const off = P.compute(waitingToClaim(64), { today: T });
  assert.ok(off.inputs.incomes.every((x) => !x.notInMonth) && off.rows.every((r) => !r.incomeSaved));
  const d = P.compute(waitingToClaim(64), ON("newIncomeSaved"));
  const I = d.inputs;
  const ss = I.incomes.find((x) => x.name === "Bo's Social Security");
  assert.equal(ss.notInMonth, true, "on the Social Security page only: not in today's month");
  assert.equal(I.retireYear, 2035);
  // by hand: $27,840 a year from 2027 (64), raised with prices (3%): 27,840 x 1.03 = $28,675.20 in 2027, saved whole in flat mode
  const saved = d.rows.filter((r) => r.incomeSaved > 0);
  assert.deepEqual(saved.map((r) => r.year), [2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034]);
  assert.equal(saved[0].incomeSaved.toFixed(2), "28675.20");
  // the same plan with the line counted as the month's (the code before): dropped, so the plan ran out earlier and could pay for less
  const J = { ...I, incomes: I.incomes.map((x) => (x === ss ? { ...x, notInMonth: undefined } : x)) };
  const before = project(J);
  assert.ok(!before.success && !d.result.success && d.result.failYear > before.failYear, `${before.failYear} -> ${d.result.failYear}`);
  assert.equal(before.failYear, off.result.failYear);
  // brackets mode: what goes in is the benefit less the tax it adds on top of the month's income (here Bo's alone: none)
  const b = P.compute(waitingToClaim(64, "brackets"), ON("newIncomeSaved"));
  for (const r of b.rows.filter((x) => x.incomeSaved > 0)) {
    const line = r.incomeLines.find((l) => l.name === "Bo's Social Security").amount;
    const base = { filingStatus: b.inputs.tax.filingStatus, qualifiedIncome: 0, itemized: 0, ages65plus: r.ages.slice(0, 2).filter((a) => a >= 65).length };
    const params = b.inputs.tax.paramsFor(r.year);
    const added = federalTax({ ...base, otherOrdinary: r.taxInfo.ordinary, socialSecurity: r.taxInfo.socialSecurity }, params).totalTax - federalTax({ ...base, otherOrdinary: r.taxInfo.ordinary, socialSecurity: r.taxInfo.socialSecurity - line }, params).totalTax;
    assert.ok(Math.abs(r.incomeSaved - (line - added)) < 0.01, `${r.year}`);
  }
});

test("switch newIncomeSaved: a pension starting later is saved after the tax it adds; a claimant still at work is not counted; today's lines are the month's", () => {
  // Bo still at work to 70 and claiming at 64: while he works the earnings test holds much of it back, and it is not counted (as
  // before); from 70 (2033), stopped, it is new money until the household retires in 2035
  const w = waitingToClaim(64); w.household.people.find((x) => x.id === "p-bo").retirementAge = 70;
  assert.deepEqual(P.compute(w, ON("newIncomeSaved")).rows.filter((r) => r.incomeSaved > 0).map((r) => r.year), [2033, 2034]);
  // a pension on the Income page starting in 2028 for Bo (stopped work): new money, taxed in brackets mode on top of nothing else
  const p = waitingToClaim(70, "brackets");
  p.income.push({ id: "i-bo-pen2", name: "Bo's pension", type: "pension", personId: "p-bo", amount: 6000, period: "monthly", growth: 0, taxable: true, startDate: "2028-01-01" });
  const d = P.compute(p, ON("newIncomeSaved"));
  assert.equal(d.inputs.incomes.find((x) => x.name === "Bo's pension").notInMonth, true);
  const r = d.rows.find((x) => x.year === 2028);
  const base = { filingStatus: d.inputs.tax.filingStatus, qualifiedIncome: 0, socialSecurity: 0, itemized: 0, ages65plus: r.ages.slice(0, 2).filter((a) => a >= 65).length };
  const tax = federalTax({ ...base, otherOrdinary: 72000 }, d.inputs.tax.paramsFor(2028)).totalTax;
  assert.ok(tax > 3000, `${tax}`);
  assert.ok(Math.abs(r.incomeSaved - (72000 - tax)) < 0.01, `${r.incomeSaved} vs ${72000 - tax}`);
  // lines on the Income page paid today are in today's month: never marked (case 3d's pension and Social Security)
  const today = P.buildInputs(retiredPartnerWithRmd(), ON("newIncomeSaved")).inputs.incomes.filter((x) => /^Bo's/.test(x.name));
  assert.ok(today.length === 2 && today.every((x) => !x.notInMonth), JSON.stringify(today));
  // a Pensions-page entry the Income page also holds today (same person and amount) is the month's too
  const q = retiredPartnerWithRmd(); q.retirement.pensions = [{ name: "Old job", monthly: 3000, personId: "p-bo", startAge: 60, cola: false }];
  assert.ok(!P.buildInputs(q, ON("newIncomeSaved")).inputs.incomes.find((x) => x.name === "Old job").notInMonth);
});

/** critic-law case 5: the family with Bo working to 75 (the household retires with Ana in 2055); his saving pre-tax if asked. */
function partnerWorksOn(mode, pretax = false) {
  const p = migrate(familyPlan(T));
  p.household.people.find((x) => x.id === "p-bo").retirementAge = 75;
  if (pretax) p.retirement.contributions.find((c) => c.id === "c-bo").accountId = "a-bk401";
  p.retirement.taxMode = mode;
  return p;
}

test("switch partnerPayNet: a partner at work after the household retires pays their own saving and payroll tax out of their pay; pre-tax saving is not taxed", () => {
  const rate = (62400 * 0.0765 + 7200 * 0.153 * 0.9235) / 69600;   // $5,200 a month of pay and $600 of business, by hand
  for (const [mode, pretax] of [["flat", false], ["brackets", false], ["brackets", true]]) {
    const off = P.compute(partnerWorksOn(mode, pretax), { today: T });
    assert.ok(off.inputs.incomes.every((x) => !x.ownSaving) && off.inputs.contributions.every((c) => c.own === undefined), "off: as before");
    const d = P.compute(partnerWorksOn(mode, pretax), ON("partnerPayNet"));
    const I = d.inputs;
    assert.equal(I.retireYear, 2055);
    const pay = I.incomes.find((x) => x.name === "Bo's pay");
    assert.equal(pay.ownSaving, true);
    assert.ok(Math.abs(pay.payrollRate - rate) < 1e-12);
    assert.deepEqual(I.contributions.filter((c) => c.own !== undefined).map((c) => c.own), [3600], "his $300 a month, not Ana's");
    const r = d.rows.find((x) => x.year === 2055);
    // by hand: $69,600 x 1.03^29 of pay in 2055 and $3,600 x 1.03^29 of his own saving
    const gross = 69600 * r.priceLevel, own = 3600 * Math.pow(1.03, 29);
    const line = r.incomeLines.find((l) => l.name === "Bo's pay").amount;
    assert.ok(Math.abs(line - (gross - (mode === "brackets" ? gross * rate : 0) - own)) < 0.01, `${mode}: ${line}`);
    if (mode === "brackets") assert.ok(Math.abs(r.taxInfo.ordinary - (pretax ? gross - own : gross)) < 0.01, "pre-tax saving is not taxed");
    // in his working years before 2055 nothing changes: his pay is today's month (no line amount is counted for spending)
    assert.equal(d.rows.find((x) => x.year === 2040).incomeLines.find((l) => l.name === "Bo's pay").amount.toFixed(2), (69600 * d.rows.find((x) => x.year === 2040).priceLevel).toFixed(2));
  }
  // a plan with no partner at work after the household retires carries none of it
  const plain = P.buildInputs(migrate(familyPlan(T)), ON("partnerPayNet")).inputs;
  assert.ok(plain.incomes.every((x) => !x.ownSaving) && plain.contributions.every((c) => c.own === undefined));
});

test("a required withdrawal is worked on last year-end's balance, not on money put in this year", () => {
  // by hand: one person of 75 (Uniform Lifetime Table: 24.6) with $100,000 pre-tax at the end of last year who puts in $10,000
  // this year: 100,000 / 24.6 = $4,065.04 (it was 110,000 / 24.6 = $4,471.54); nothing grows, nothing is spent
  const I = { startYear: 2026, endYear: 2027, people: [{ name: "A", birthYear: 1951, retireAge: 80, endAge: 76 }], balances: { cash: 0, taxable: 0, deferred: 100000, free: 0 },
    contributions: [{ bucket: "deferred", yearly: 10000, personIndex: 0 }], incomes: [], spending: { yearly: 0 }, retireYear: 2031,
    rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0, stocksNow: 0.5, stocksRetired: 0.5 }, returns: { stocks: 0, bonds: 0 }, rmd: { birthYear: 1951, startAge: 73 } };
  const r = project(I).rows;
  assert.equal(r[0].rmd.toFixed(2), "4065.04");
  // next year: (100,000 + 10,000 - 4,065.04) / 23.7 at 76
  assert.equal(r[1].rmd.toFixed(2), ((110000 - 100000 / 24.6) / 23.7).toFixed(2));
});

test("a figure typed just above the loans Get started's figure holds: a dollar less never leaves less money at the end", () => {
  const p0 = migrate(guessedPlan(T));
  const d0 = P.compute(structuredClone(p0), { today: T });
  const loans = P.setupLoans(p0, T).reduce((t, x) => t + x.pay, 0);
  assert.ok(loans > 1000 && d0.figureMonthly > loans, `${loans} of loans in ${d0.figureMonthly}`);
  const end = (v) => { const p = structuredClone(p0); P.saveSpendingFigure(p, v, d0.figureMonthly); assert.equal(p.guide.setup.retireHeld, true); return P.compute(p, { today: T }); };
  const figures = [d0.figureMonthly + 1, Math.round(d0.figureMonthly * 0.9), Math.round(loans) + 2, Math.round(loans) - 1, Math.round(loans / 2)];
  let last = null;
  for (const v of figures) {
    const d = end(v), money = d.rows.at(-1).totalReal;
    if (last) assert.ok(money >= last.money - 0.01, `${v} a month leaves ${money}, ${last.v} left ${last.money}`);
    last = { v, money };
  }
  // by hand: $2 a month less is about $2 x 12 x the years of retirement less spent, never $2,020 less at the end (critic-engine F6)
  const a = end(Math.round(loans) + 1).rows.at(-1).totalReal, b = end(Math.round(loans) - 1).rows.at(-1).totalReal;
  assert.ok(b >= a && b - a < 2000, `${a} -> ${b}`);
  // from twice the payments up the loans are held whole, as before; under the payments none is (fix round 1, D1)
  assert.equal(end(Math.round(loans * 2) + 1).inputs.loans[0].inBase, end(d0.figureMonthly + 1).inputs.loans[0].inBase);
  assert.equal(end(Math.round(loans) - 1).inputs.loans, undefined);
});

test("switch incomePaysTaxFirst: income pays the tax first in retired years; off by default, it leaves every answer as it was", () => {
  assert.deepEqual(P.SWITCHES, { incomePaysTaxFirst: false, newIncomeSaved: false, partnerPayNet: false });
  // qa archetype 08-retired with every kind of account: $67,200 a year coming in, $34,560 of spending, brackets mode
  const a = ARCHETYPES.find((x) => x.id.startsWith("08")), plan = structuredClone(a.build());
  COMMON_PACKS.accounts.find((v) => v.slug === "every-account-type").apply(plan);
  const p = migrate(plan); p.retirement.taxMode = "brackets";
  const d = P.compute(p, { today: T });
  assert.equal("incomePaysTaxFirst" in d.inputs, false);
  assert.equal(d.verdict, "short", "as before: the tax on income above spending comes out of savings");
  const on = project({ ...d.inputs, incomePaysTaxFirst: true });
  assert.equal(on.success, true);
  const viaPlan = P.compute(p, ON("incomePaysTaxFirst"));
  assert.equal(viaPlan.inputs.incomePaysTaxFirst, true); assert.notEqual(viaPlan.verdict, "short");
  for (const r of on.rows.filter((x) => x.retired)) {
    if (r.income < r.spending + r.eventSpending + r.taxes + 0.01) continue;
    assert.ok(r.withdrawn.cash + r.withdrawn.taxable + r.withdrawn.deferred + r.withdrawn.free - r.rmd < 0.005 || r.eventOut > r.eventSpending, `${r.year}: income pays it all`);
  }
  assert.ok(sum(on.rows.at(-1).balances) > sum(d.rows.at(-1).balances));
});
