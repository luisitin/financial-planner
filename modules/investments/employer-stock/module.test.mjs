import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, vestSchedule, LIMIT, SUPPLEMENTAL, STRESS_DROP } from "./compute.js";
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
