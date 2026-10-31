import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, vestSchedule, supplementalWithholding, LIMIT, SUPPLEMENTAL, STRESS_DROP } from "./compute.js";
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

test("vests in the next year: taxed as pay, 22% withheld; the gap at a higher rate", () => {
  const d = compute(acme(), { today: TODAY });
  assert.deepEqual(d.vests.map((v) => v.date), ["2026-12-01", "2027-03-01", "2027-06-01", "2027-09-01"]);
  for (const v of d.vests) { near(v.withheld, v.value * SUPPLEMENTAL.rate); near(v.gap, v.value * (d.rates.marginal - SUPPLEMENTAL.rate)); }
  const rich = acme(); rich.income.push({ id: "big", type: "bonus", name: "Big bonus", personId: "p-ana", amount: 400000, period: "yearly" });
  const r = compute(rich, { today: TODAY });
  assert.ok(r.rates.marginal > 0.22); assert.ok(r.vestGap > 0);
});

test("getting under 10%: the retirement plan's shares first (no tax), then the brokerage's with gains tax", () => {
  const d = compute(acme(), { today: TODAY });
  const x = d.diversify;
  near(x.sell, 30000, 0.01); near(x.fromPlans, 18000); near(x.fromTaxable, 12000);
  near(x.tax, 12000 * (6000 / 12000) * d.rates.gains);
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
