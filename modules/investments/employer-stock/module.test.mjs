import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, vestSchedule, supplementalWithholding, addIncome, stateExtra, LIMIT, SUPPLEMENTAL, STRESS_DROP } from "./compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

function acme() {
  const p = familyPlan(TODAY);
  p.equity = { symbol: "acme", price: 120, priceAsOf: "2026-10-29", personId: "p-ana", grants: [
    { id: "g1", kind: "rsu", name: "RSUs", granted: "2025-03-01", vestStart: "2025-03-01", shares: 800 },
    { id: "g2", kind: "option", name: "Options", granted: "2017-06-01", vestStart: "2017-06-01", shares: 2000, strike: 40 },
  ] };
  p.holdings = [
    { id: "h1", accountId: "a-brk", symbol: "ACME", shares: 100, price: 118, priceAsOf: "2026-10-20", costBasis: 6000, lots: [] },
    { id: "h2", accountId: "a-401", symbol: "ACME", shares: 150, price: 118, priceAsOf: "2026-10-20", costBasis: 9000, lots: [] },
  ];
  return p;
}

test("vestSchedule: a quarter at the one-year cliff, then quarterly, whole shares adding up to the grant", () => {
  const s = vestSchedule({ shares: 1000, vestStart: "2025-03-01" });
  assert.equal(s[0].date, "2026-03-01"); assert.equal(s[0].shares, 250);
  assert.equal(s[1].date, "2026-06-01");
  assert.equal(s[s.length - 1].date, "2029-03-01"); assert.equal(s[s.length - 1].cumulative, 1000);
  assert.equal(s.length, 13); assert.equal(s.reduce((t, e) => t + e.shares, 0), 1000);
  const monthly = vestSchedule({ shares: 100, vestStart: "2025-01-01", cliffMonths: 0, every: 1, vestMonths: 12 });
  assert.equal(monthly.length, 12); assert.equal(monthly.reduce((t, e) => t + e.shares, 0), 100);
  const odd = vestSchedule({ shares: 10, vestStart: "2025-01-01", cliffMonths: 12, every: 5, vestMonths: 24 });
  assert.deepEqual(odd.map((e) => e.date), ["2026-01-01", "2026-06-01", "2026-11-01", "2027-01-01"], "the last vest lands on the end date");
  assert.deepEqual(vestSchedule({ shares: 0, vestStart: "2025-01-01" }), []);
});

test("nothing entered: not ready", () => {
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).ready, false);
});

test("the stake: shares held at the newest price, vested options at their spread, units still to vest", () => {
  const d = compute(acme(), { today: TODAY });
  assert.equal(d.symbol, "ACME"); assert.equal(d.price, 120, "the typed price is newer than the holdings'");
  near(d.heldValue, 250 * 120);
  const rsu = d.grants.find((g) => g.kind === "rsu"), opt = d.grants.find((g) => g.kind === "option");
  assert.equal(rsu.vested, 300); assert.equal(rsu.unvested, 500); near(rsu.unvestedValue, 500 * 120);
  assert.equal(opt.vested, 2000); near(opt.vestedValue, 2000 * 80); assert.equal(opt.expires, "2027-06-01");
  near(d.owned, 30000 + 160000); near(d.unvested, 60000); near(d.exposure, 250000);
  const nw = computeNetWorth(acme(), { today: TODAY });
  near(d.invested, nw.investable + 160000 + 60000); near(d.share, 250000 / d.invested);
  assert.equal(d.level, "large");
  assert.equal(d.expiringSoon.length, 1);
});

test("a halving: shares and units lose half, options lose their spread's fall", () => {
  const d = compute(acme(), { today: TODAY });
  near(d.stress.loss, (30000 + 60000) * STRESS_DROP + 2000 * (80 - 20));
  assert.equal(d.person, "Ana"); assert.ok(d.pay > 0);
});

test("vests in the next year: taxed as pay, 22% withheld; each vest its share of its year's tax by value", () => {
  const d = compute(acme(), { today: TODAY });
  assert.deepEqual(d.vests.map((v) => v.date), ["2026-12-01", "2027-03-01", "2027-06-01", "2027-09-01"]);
  assert.deepEqual(d.vestYears.map((y) => y.year), [2026, 2027]);
  for (const v of d.vests) {
    const y = d.vestYears.find((x) => x.year === Number(v.date.slice(0, 4)));
    near(v.withheld, v.value * SUPPLEMENTAL.rate); near(v.owed, y.owed * v.value / y.value); near(v.gap, v.owed - v.withheld);
  }
  near(d.vestYears[0].earlier, 300 * 120, 0.01, "this year's March, June and September vests (200 at the cliff, then 50 and 50 units) come first");
  const rich = acme(); rich.income.push({ id: "big", type: "bonus", name: "Big bonus", personId: "p-ana", amount: 400000, period: "yearly" });
  const r = compute(rich, { today: TODAY });
  assert.ok(r.rates.marginal > 0.22); assert.ok(r.vestGap > 0);
});

test("getting under 10%: the retirement plan's shares first (no tax), then the brokerage's with gains tax", () => {
  const d = compute(acme(), { today: TODAY });
  const x = d.diversify;
  near(x.sell, 30000, 0.01); near(x.fromPlans, 18000); near(x.fromTaxable, 12000);
  near(x.gain, 6000); assert.ok(x.tax > 0 && x.tax < x.gain * 0.25);   // hand-worked stacking: the tests below
  assert.ok(x.stillOver, "options and units keep it above the ceiling");
  near(x.after, (250000 - 30000) / d.invested);
});

test("a small stake needs no selling", () => {
  const p = acme(); p.equity.grants = []; p.holdings = [{ id: "h1", accountId: "a-brk", symbol: "ACME", shares: 50, price: 120, priceAsOf: "2026-10-29", costBasis: 5000, lots: [] }];
  const d = compute(p, { today: TODAY });
  assert.ok(d.share <= LIMIT.ok); assert.equal(d.level, "ok"); assert.equal(d.diversify, null);
});

// one adult filing single in 2026, paid `pay` by the company, one RSU grant vesting all at once on `vestOn` (price 100)
function single(pay, units, vestOn = "2026-12-01", more = {}) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = "single"; p.household.state = "";
  p.income = [{ id: "pay", name: "Pay", type: "salary", personId: "a1", amount: pay, period: "annual", taxable: true }];
  const start = `${Number(vestOn.slice(0, 4)) - 1}${vestOn.slice(4)}`;
  p.equity = { symbol: "ZZCO", price: 100, priceAsOf: TODAY, personId: "a1", grants: [{ id: "g", kind: "rsu", name: "Units", granted: start, vestStart: start, shares: units, vestMonths: 12, cliffMonths: 12, every: 3 }], ...more };
  return p;
}

test("withholding on supplemental wages: 22%, and 37% on the part of the year's past $1 million (IRS Pub. 15)", () => {
  near(supplementalWithholding(100000), 22000);
  near(supplementalWithholding(500000, 800000), 200000 * 0.22 + 300000 * 0.37);
  near(supplementalWithholding(100000, 1200000), 37000);
});

test("a $100,000 vest on $90,000 of pay crosses from 22% into 24%: 23,364 owed against 22,000 withheld (Rev. Proc. 2025-32)", () => {
  // 2026 single: taxable income 73,900 -> 173,900; tax 10,970 -> 34,334 (5,800 + 22% to 105,700 + 24% above)
  const d = compute(single(90000, 1000), { today: TODAY });
  assert.equal(d.vests.length, 1); near(d.vests[0].value, 100000);
  near(d.vests[0].owed, 23364); near(d.vests[0].withheld, 22000); near(d.vestGap, 1364);
});

test("the 0.9% Medicare tax on pay past $200,000: owed and withheld by the employer (IRC 3101(b)(2), 3102(f))", () => {
  // pay 180,000 + a 100,000 vest: 80,000 past 200,000, 720 withheld and 720 owed (single); income tax at 24%, then 32% past
  // 201,775 and 35% past 256,225 (2026 single)
  const d = compute(single(180000, 1000), { today: TODAY });
  const v = d.vests[0];
  near(v.withheld, 22000 + 720);
  const incomeTax = (r) => 5800 + 0.22 * 55300 + 0.24 * (Math.min(r, 201775) - 105700) + 0.32 * Math.max(0, Math.min(r, 256225) - 201775) + 0.35 * Math.max(0, r - 256225);
  near(v.owed, incomeTax(280000 - 16100) - incomeTax(180000 - 16100) + 720);
});

test("vests of $1.2 million in a year: 37% withheld on the part past $1 million", () => {
  const d = compute(single(150000, 12000), { today: TODAY });
  near(d.vests[0].withheld, 1000000 * 0.22 + 200000 * 0.37 + 0.009 * (150000 + 1200000 - 200000));
  assert.equal(d.vestYears[0].over1m, true);
});

test("vests in two calendar years are worked in their own years", () => {
  const p = single(90000, 1000);
  p.equity.grants.push({ id: "g2", kind: "rsu", name: "More", granted: "2026-03-01", vestStart: "2026-03-01", shares: 400, vestMonths: 12, cliffMonths: 12, every: 3 });
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.vestYears.map((y) => [y.year, y.value]), [[2026, 100000], [2027, 40000]]);
});

test("a diversifying sale is stacked through the gains bands: part at 0%, the rest at 15% (IRC 1(h))", () => {
  // single, pay 40,000 in 2026: taxable income 23,900; 0% band to 49,450, so of a 50,000 gain 25,550 is at 0% and 24,450 at 15%
  const p = single(40000, 0, "2026-12-01", { grants: [] });
  p.accounts = [{ id: "brk", name: "Brokerage", type: "brokerage", balance: 100000 }];
  p.holdings = [{ id: "h", accountId: "brk", symbol: "ZZCO", shares: 1000, price: 100, priceAsOf: TODAY, costBasis: 50000, lots: [] }];
  const d = compute(p, { today: TODAY });
  // the whole stake is in the brokerage and is the only investment: selling down to 10% sells 90,000 (gain 45,000)
  near(d.diversify.fromTaxable, 90000); near(d.diversify.gain, 45000);
  near(d.diversify.tax, (45000 - 25550) * 0.15);
});

test("this year's earlier vests come first: a December vest after $300,000 of them is taxed at 35% and withheld with the 0.9% (IRC 83(a), 3102(f))", () => {
  // single, pay 90,000; 100,000 vests on Mar 1, Jun 1, Sep 1 and Dec 1 2026; today Oct 31: the Dec vest moves wages 390,000 -> 490,000,
  // taxable 373,900 -> 473,900, all in the 35% band (256,225 to 640,600): 35,000, plus 0.9% of 100,000 = 900 (Rev. Proc. 2025-32)
  const p = single(90000, 4000); p.equity.grants[0] = { ...p.equity.grants[0], vestStart: "2025-12-01", granted: "2025-12-01", vestMonths: 12, cliffMonths: 3, every: 3 };
  const d = compute(p, { today: "2026-10-31" });
  assert.equal(d.vests.length, 1); near(d.vestYears[0].earlier, 300000);
  near(d.vests[0].owed, 35900); near(d.vests[0].withheld, 22000 + 900); near(d.vestYears[0].gap, 13000);
  // four 300,000 vests: 900,000 came first, so of December's 300,000, 100,000 is withheld at 22% and 200,000 at 37% (Pub. 15, section 7)
  const q = single(90000, 12000); q.equity.grants[0] = { ...p.equity.grants[0], shares: 12000 };
  const e = compute(q, { today: "2026-10-31" });
  near(e.vests[0].withheld, 22000 + 74000 + 2700); near(e.vests[0].owed, 0.37 * 300000 + 2700); near(e.vestYears[0].gap, 15000);
  assert.equal(e.vestYears[0].over1m, true);
});

test("each year's gap stands alone: 2026 short, 2027 over-withheld (IRC 31(a), 6513(b))", () => {
  // single, pay 30,000: a 300,000 vest on Dec 1 2026 (taxable 13,900 -> 313,900: 77,214.25, plus 0.9% of 130,000 = 1,170) and 60,000 on Mar 1 2027
  const p = single(30000, 3000);
  p.equity.grants.push({ id: "g2", kind: "rsu", name: "More", granted: "2026-03-01", vestStart: "2026-03-01", shares: 600, vestMonths: 12, cliffMonths: 12, every: 3 });
  const d = compute(p, { today: TODAY });
  const [a, b] = d.vestYears;
  near(a.owed, 78384.25); near(a.withheld, 66000 + 1170); near(a.gap, 11214.25);
  assert.ok(b.gap < 0, "2027's withholding is more than its tax");
  // 2027 by hand from the 2027 tables the estimate indexes: 30,000 - the standard deduction, then 60,000 more
  const P = taxInputs({ ...p, taxes: { ...p.taxes, year: 2027 } }, { today: TODAY }).params, S = P.status.single;
  const tax = (x) => P.rates.reduce((s, r, i) => s + r * Math.max(0, Math.min(x, S.brackets[i] ?? Infinity) - (i ? S.brackets[i - 1] : 0)), 0);
  near(b.owed, tax(90000 - S.standardDeduction) - tax(30000 - S.standardDeduction));
  near(b.withheld, 13200);
});

test("filing separately: the vest is on the employee's return, the sale on the account owner's (Pub. 501)", () => {
  // A (Me) earns 40,000; B earns 300,000 and works at the company; 1,000 shares at 100 (cost 50,000) in A's own brokerage
  const p = emptyPlan();
  p.household.people = [{ id: "a", name: "A", role: "self", birthDate: "1980-01-01" }, { id: "b", name: "B", role: "spouse", birthDate: "1980-01-01" }];
  p.household.filingStatus = "married_separate"; p.household.state = "";
  p.income = [{ id: "pa", type: "salary", name: "A pay", personId: "a", amount: 40000, period: "annual", taxable: true }, { id: "pb", type: "salary", name: "B pay", personId: "b", amount: 300000, period: "annual", taxable: true }];
  p.accounts = [{ id: "brk", name: "A brokerage", type: "brokerage", ownerId: "a", balance: 100000 }];
  p.holdings = [{ id: "h", accountId: "brk", symbol: "ZZCO", shares: 1000, price: 100, priceAsOf: TODAY, costBasis: 50000, lots: [] }];
  p.equity = { symbol: "ZZCO", price: 100, priceAsOf: TODAY, personId: "b", grants: [] };
  const d = compute(p, { today: TODAY });
  // the 45,000 gain on A's return: taxable 23,900, 25,550 of room at 0% (2026: 49,450), the other 19,450 at 15%
  near(d.diversify.gain, 45000); near(d.diversify.tax, 19450 * 0.15);
  // the account in neither name: half the gain on each return
  p.accounts[0].ownerId = "";
  const e = compute(p, { today: TODAY });
  assert.ok(e.diversify.tax > d.diversify.tax, "B's half is taxed at 15% plus the 3.8%");
});

test("who works there is an adult: a child named or listed first falls back to the adult marked Me", () => {
  const p = single(250000, 1000);
  p.household.people.push({ id: "k", name: "Kid", role: "dependent", birthDate: "2008-01-01" });
  p.income.unshift({ id: "kp", name: "Kid's job", type: "salary", personId: "k", amount: 10000, period: "annual", taxable: true });
  p.equity.personId = "";
  const d = compute(p, { today: TODAY });
  assert.equal(d.person, "Adult 1"); near(d.pay, 260000, 0.01, "the child's pay names no adult, so it counts as Me's, as on the federal estimate");
  near(d.vests[0].withheld, 22000 + 900);
  p.equity.personId = "k";
  assert.equal(compute(p, { today: TODAY }).person, "Adult 1");
});

test("the employer's 0.9% from the wages typed on the Federal estimate, or from pay with no one named", () => {
  const typed = single(0, 1000); typed.income = []; typed.taxes.thisYear.wages = 250000;
  near(compute(typed, { today: TODAY }).vests[0].withheld, 22000 + 900);
  const joint = single(250000, 1000); joint.income[0].personId = "";
  near(compute(joint, { today: TODAY }).vests[0].withheld, 22000 + 900);
});

test("the state's share at its rate on the vests above today's income, in every case (Illinois 4.95%, $2,850 a person)", () => {
  const il = single(40000, 500); il.household.state = "IL";
  near(compute(il, { today: TODAY }).vests[0].stateOwed, 0.0495 * 50000);
  const none = single(0, 3000); none.income = []; none.household.state = "IL";
  near(compute(none, { today: TODAY }).vests[0].stateOwed, 0.0495 * (300000 - 2850));
  assert.equal(stateExtra({ method: "prior", rate: 0.05, agi: 0, allowance: 0 }, 1000), 50);
  assert.equal(stateExtra({ method: "none", rate: 0 }, 1000), 0);
});

test("a diversifying sale this year is stacked on this year's vests too (IRC 1(h), 83(a))", () => {
  // single, pay 40,000, a 100,000 vest on Dec 1: taxable ordinary income 123,900 is past the 0% band, so all of the 45,000 gain is at 15%
  const p = single(40000, 1000);
  p.accounts = [{ id: "brk", name: "Brokerage", type: "brokerage", balance: 100000 }];
  p.holdings = [{ id: "h", accountId: "brk", symbol: "ZZCO", shares: 1000, price: 100, priceAsOf: TODAY, costBasis: 50000, lots: [] }];
  const d = compute(p, { today: TODAY });
  near(d.diversify.tax, d.diversify.gain * 0.15);
});

test("with the Federal estimate set to the vest's year, that year's typed sales count", () => {
  const p = single(150000, 1000, "2027-03-01");
  const without = compute(p, { today: TODAY }).vests[0].owed;
  p.taxes.year = 2027; p.taxes.gains = [{ id: "s", description: "Fund", proceeds: 300000, basis: 100000, acquired: "2015-01-01", sold: "2027-02-01" }];
  const withSale = compute(p, { today: TODAY }).vests[0].owed;
  assert.ok(withSale > without + 1000, `${withSale} vs ${without}: the vest takes income past 200,000, so the 3.8% reaches more of the gain`);
});

test("addIncome puts an amount on one spouse's return and keeps the total in step", () => {
  const inputs = { wages: 100, medicareWages: 100, separate: [{ personId: "a", wages: 60, medicareWages: 60 }, { personId: "b", wages: 40, medicareWages: 40 }] };
  const x = addIncome(inputs, "b", { wages: 10, medicareWages: 10 });
  assert.equal(x.wages, 110); assert.equal(x.separate[1].wages, 50); assert.equal(x.separate[0].wages, 60);
  assert.equal(addIncome(inputs, "z", { wages: 5 }).separate, inputs.separate, "no such return: the engine's separateTo takes it");
});
