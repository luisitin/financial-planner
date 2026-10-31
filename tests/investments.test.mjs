// tests/investments.test.mjs -- the Phase 7 pages on qa/fixtures/investments-plan.mjs (Sam and
// Lee with eight holdings in four accounts) and the three brokerage positions files.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { investmentsPlan } from "../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute as holdings, parsePositions, mergePositions, classify, targetDateMix } from "../modules/investments/holdings/compute.js";
import { compute as allocation, targetMix } from "../modules/investments/allocation/compute.js";
import { compute as rebalance, allocateNewMoney } from "../modules/investments/rebalance/compute.js";
import { compute as fees, growWithFees } from "../modules/investments/fees/compute.js";
import { compute as performance, benchmarkOver } from "../modules/investments/performance/compute.js";
import { compute as dividends } from "../modules/investments/dividends/compute.js";
import { compute as location } from "../modules/investments/asset-location/compute.js";
import { compute as glide } from "../modules/investments/glide-path/compute.js";
import { compute as risk } from "../modules/investments/risk/compute.js";
import { compute as backtest, runMix, HISTORY, toHistoryWeights } from "../modules/investments/backtest/compute.js";
import { compute as limits } from "../modules/investments/limits/compute.js";
import { compute as taxLots } from "../modules/investments/tax-lots/compute.js";

const TODAY = "2026-09-16";
const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const fixture = (name) => fs.readFileSync(new URL(`../qa/fixtures/${name}`, import.meta.url), "utf8");

test("positions files: Fidelity (two accounts, a money-market line, a pending row), Schwab (title line, cash line, account total), Vanguard (trailing commas, no cost)", () => {
  const f = parsePositions(fixture("positions-fidelity.csv"));
  assert.equal(f.rows.length, 4); assert.deepEqual(f.rows.map((r) => r.symbol), ["FXAIX", "SPAXX", "VXUS", "FZROX"]);
  assert.equal(f.rows[0].shares, 120.5); assert.equal(f.rows[0].price, 212.34); assert.equal(f.rows[0].costBasis, 20000); assert.equal(f.rows[0].account, "Individual");
  assert.equal(f.rows[1].cash, true); assert.equal(f.rows[1].value, 3120.5); assert.equal(f.rows[3].account, "ROTH IRA");
  const s = parsePositions(fixture("positions-schwab.csv"));
  assert.equal(s.skipped, 1); assert.deepEqual(s.rows.map((r) => r.symbol), ["SWTSX", "SCHD", "VFFVX", "CASH"]);
  assert.equal(s.rows[0].value, 39018.22); assert.equal(s.rows[0].costBasis, 30100); assert.equal(s.rows[3].name, "Cash & Cash Investments"); assert.equal(s.rows[3].value, 1250.33);
  const v = parsePositions(fixture("positions-vanguard.csv"));
  assert.equal(v.rows.length, 3); assert.equal(v.rows[0].symbol, "VTSAX"); assert.equal(v.rows[0].shares, 412.334); assert.equal(v.rows[0].costBasis, null);
  assert.ok(v.warnings.some((w) => w.includes("cost")));
  assert.equal(parsePositions("nothing here").rows.length, 0);
});

test("merging positions updates matching symbols in the account and adds the rest; classification knows common funds, target-date names and cash", () => {
  const existing = [{ id: "a", accountId: "x", symbol: "VTI", shares: 10, price: 200, costBasis: 1500, lots: [{ id: "l", date: "2020-01-01", shares: 10, cost: 1500 }] }];
  const r = mergePositions(existing, [{ symbol: "VTI", shares: 12, price: 290, costBasis: 2000 }, { symbol: "BND", name: "BOND", shares: 5, price: 73, costBasis: 380 }], "x", { today: TODAY, uid: () => "new" });
  assert.equal(r.updated, 1); assert.equal(r.added, 1); assert.equal(r.holdings[0].shares, 12); assert.equal(r.holdings[0].lots.length, 1); assert.equal(r.holdings[1].id, "new"); assert.equal(r.holdings[1].symbol, "BND");
  assert.equal(classify("vti").cls, "us_stocks"); assert.equal(classify("BND").er, 0.0003); assert.equal(classify("ZZZZ", "Some Stock").cls, "unknown");
  assert.equal(classify("VFFVX", "Vanguard Target Retirement 2055", 2026).cls, "balanced");
  assert.deepEqual(targetDateMix(2055, 2026), { us_stocks: 0.54, intl_stocks: 0.36, bonds: 0.1 });
  assert.deepEqual(targetDateMix(2030, 2030), { us_stocks: 0.3, intl_stocks: 0.2, bonds: 0.5 });
  assert.equal(classify("XYZ", "Sweep money market").cls, "cash");
  assert.equal(classify("VTI", "", 2026, "bonds").cls, "bonds");   // the owner's class wins
});

test("holdings: values, classes (a target-date fund split up), totals by account and class, the unclassified warning", () => {
  const h = holdings(investmentsPlan(), { today: TODAY });
  assert.equal(h.items.length, 8); assert.equal(h.total, 969500); assert.equal(h.costTotal, 738900);
  assert.equal(h.unknown, 1); assert.ok(h.warnings.some((w) => w.includes("no asset class")));
  const td = h.items.find((x) => x.symbol === "VFFVX"); assert.equal(td.cls, "balanced"); assert.equal(td.mix.us_stocks, 0.54); assert.equal(td.er, 0.0008);
  assert.equal(h.byClass.find((c) => c.cls === "us_stocks").value, 87000 + 318000 + 200000 * 0.54);
  assert.equal(h.byAccount.find((a) => a.accountId === "brk").gap, 0);
  near(h.stockShare, (513000 + 216000 + 66500) / (969500 - 90000), 1e-9);
  assert.equal(holdings(emptyPlan(), { today: TODAY }).hasData, false);
});

test("allocation: the plan's own target, drift per class, the 5/25 flags; the default target follows the projection's stock share", () => {
  const a = allocation(investmentsPlan(), { today: TODAY });
  assert.equal(a.ready, true); assert.equal(a.total, 879500);
  const bonds = a.rows.find((r) => r.cls === "bonds"); near(bonds.actual, 71100 / 879500, 1e-9); assert.equal(bonds.target, 0.25); assert.equal(bonds.flagged, true); near(bonds.move, 0.25 * 879500 - 71100, 0.01);
  const cash = a.rows.find((r) => r.cls === "cash"); assert.equal(cash.flagged, true); assert.ok(cash.reason.includes("quarter"));
  assert.equal(a.rows.find((r) => r.cls === "intl_stocks").flagged, false);
  assert.equal(a.flaggedCount, 4); assert.equal(a.worst.cls, "bonds");
  const p = emptyPlan(); p.retirement.stocksNow = 0.8;
  const tm = targetMix(p); assert.equal(tm.source, "plan"); near(tm.mix.us_stocks, 0.48, 1e-9); near(tm.mix.intl_stocks, 0.32, 1e-9); near(tm.mix.bonds, 0.2, 1e-9);
  assert.equal(allocation(emptyPlan(), { today: TODAY }).ready, false);
});

test("rebalance: new money goes to the most underweight classes first; the full rebalance sells inside retirement accounts and buys with the cash freed there", () => {
  const rows = [{ cls: "bonds", label: "Bonds", move: 10000, target: 0.3 }, { cls: "cash", label: "Cash", move: 2000, target: 0.05 }, { cls: "us_stocks", label: "US", move: -12000, target: 0.65 }];
  assert.deepEqual(allocateNewMoney(rows, 5000), [{ cls: "bonds", label: "Bonds", amount: 5000 }]);
  const spread = allocateNewMoney(rows, 20000); near(spread.reduce((s, b) => s + b.amount, 0), 20000, 0.01);
  const r = rebalance(investmentsPlan(), { today: TODAY });
  assert.equal(r.needed, true); assert.equal(r.taxableSells, 0); assert.equal(r.gainRealised, 0);
  assert.ok(r.sells.every((t) => t.bucket !== "taxable"));
  near(r.sells.reduce((s, t) => s + t.amount, 0), r.buys.reduce((s, t) => s + t.amount, 0), 1);
  assert.equal(r.leftover.length, 0);
  const p = investmentsPlan(); p.investments.newMoney = 200000;
  const n = rebalance(p, { today: TODAY }); assert.ok(n.newMoneyBuys.some((b) => b.cls === "bonds")); near(n.newMoneyBuys.reduce((s, b) => s + b.amount, 0), 200000, 0.01);
});

test("fees: the weighted expense ratio, this year's cost, the lifetime cost compounding, an advisory fee on top", () => {
  const f = fees(investmentsPlan(), { today: TODAY });
  assert.equal(f.ready, true); near(f.fundFees, 87000 * 0.0003 + 51100 * 0.0003 + 12900 * 0.0042 + 318000 * 0.00015 + 200000 * 0.0008 + 144000 * 0.0009 + 66500 * 0.0013, 0.01);
  assert.equal(f.unknownCount, 1); assert.equal(f.years, 95 - 58); assert.equal(f.contributions.years, 7);
  assert.ok(f.lifetimeCost > 100000 && f.lifetimeCost < 400000, String(f.lifetimeCost)); assert.ok(f.withCheap < f.withoutFees);
  near(growWithFees(1000, 2, 0.1, 0), 1210, 1e-9); near(growWithFees(1000, 1, 0.1, 0.01, 100, 1), 1190, 1e-9);
  const p = investmentsPlan(); p.investments.advisoryFee = 0.01;
  const g = fees(p, { today: TODAY }); near(g.advisoryYearly, 9695, 0.01); assert.ok(g.lifetimeCost > f.lifetimeCost * 5);
});

test("performance: time-weighted and money-weighted returns from balance points with contributions between them", () => {
  const p = performance(investmentsPlan(), { today: TODAY });
  assert.equal(p.ready, true); const brk = p.accounts.find((a) => a.name === "Brokerage");
  assert.equal(brk.periods.length, 2); near(brk.deposits, 12000 * 365 / 365.25, 5);
  near(brk.twrAnnual, 0.15, 0.01); near(brk.mwr, 0.15, 0.01); assert.ok(p.overall.gain > 18000 && p.overall.gain < 20000);
  assert.equal(p.benchmark, null);   // no whole calendar year inside the span
  const b = benchmarkOver("2023-12-31", "2025-12-31", 0.6); assert.equal(b.years, 2); assert.equal(b.from, 2024); assert.equal(b.to, 2025);
  assert.equal(performance(emptyPlan(), { today: TODAY }).ready, false);
});

test("dividends: yields from the fund table, the taxable part, coverage of spending", () => {
  const d = dividends(investmentsPlan(), { today: TODAY });
  near(d.total, 87000 * 0.012 + 51100 * 0.04 + 12900 * 0.04 + 318000 * 0.012 + 144000 * 0.03 + 66500 * 0.038, 0.01);
  near(d.taxable, 87000 * 0.012 + 51100 * 0.04 + 12900 * 0.04, 0.01); assert.equal(d.unknownCount, 2);
  assert.ok(d.coversShare > 0.1 && d.coversShare < 0.3);
});

test("asset location: the drag of bonds in the brokerage, the swap that moves them into the 401(k), cash and unclassified holdings stay put", () => {
  const l = location(investmentsPlan(), { today: TODAY });
  assert.equal(l.ready, true); assert.ok(l.dragNow > l.dragIdeal); assert.equal(l.score, "fair");
  assert.ok(l.swaps.some((s) => s.bucket === "taxable" && s.sell === "bonds" && s.buy === "us_stocks" && Math.round(s.amount) === 51100));
  assert.ok(l.swaps.some((s) => s.bucket === "deferred" && s.sell === "us_stocks" && s.buy === "bonds"));
  assert.equal(l.ideal.taxable.cash, 12900); assert.equal(l.ideal.free.unknown, 90000);
  assert.equal(location(emptyPlan(), { today: TODAY }).ready, false);
});

test("glide path: the three paths by age and the verdict against what is held", () => {
  const g = glide(investmentsPlan(), { today: TODAY });
  assert.equal(g.ageNow, 58); assert.equal(g.retireAge, 65); assert.equal(g.rows.length, 95 - 58 + 1);
  near(g.rows[0].plan, 0.7, 1e-9); near(g.rows.find((r) => r.age === 65).plan, 0.5, 1e-9); near(g.rows[0].age110, 0.52, 1e-9);
  assert.equal(g.verdict, "more stocks than the path"); assert.ok(g.gap > 0.15);
  const p = investmentsPlan(); p.investments.glide = "age"; assert.equal(glide(p, { today: TODAY }).suggested, 0.52);
  assert.equal(glide(emptyPlan(), { today: TODAY }).ready, false);
});

test("risk and backtest: history since 1871, the worst year and deepest fall of a mix, growth of 10,000 and the ten-year stretches", () => {
  assert.equal(HISTORY[0].year, 1871); assert.equal(HISTORY[HISTORY.length - 1].year, 2025); assert.equal(HISTORY.length, 155);
  const all = runMix({ stocks: 1, bonds: 0, bills: 0 }, { from: 1928 });
  assert.equal(all.worstYear, 1931); near(all.stats.worst, -0.438375, 1e-6); assert.equal(all.drawdown.peakYear, 1928); assert.equal(all.drawdown.troughYear, 1932);
  assert.ok(all.cagr > 0.09 && all.cagr < 0.11); assert.equal(all.values.length, all.years + 1); assert.equal(all.labels[0], 1927);
  const sixty = runMix({ stocks: 0.6, bonds: 0.4, bills: 0 }, { from: 1928 });
  assert.ok(sixty.stats.stdev < all.stats.stdev); assert.ok(sixty.worstTen.rate > all.worstTen.rate);
  const real = runMix({ stocks: 0.6, bonds: 0.4, bills: 0 }, { from: 1928, real: true }); assert.ok(real.cagr < sixty.cagr);
  assert.deepEqual(toHistoryWeights({ us_stocks: 0.5, intl_stocks: 0.2, bonds: 0.25, cash: 0.05 }), { stocks: 0.7, bonds: 0.25, bills: 0.05 });
  const b = backtest(investmentsPlan(), { today: TODAY, from: 1871, mixA: "held", mixB: "0-100" });
  assert.equal(b.a.from, 1871); assert.equal(b.mixA.label, "What you hold"); assert.equal(b.mixB.label, "All bonds"); assert.ok(b.a.end > b.b.end);
  const r = risk(investmentsPlan(), { today: TODAY });
  assert.equal(r.main.label, "What you hold"); assert.equal(r.verdict, "rough"); assert.ok(r.main.worstYearDollars < -300000); assert.equal(r.comparison.length, 6);
  const e = risk(emptyPlan(), { today: TODAY }); assert.equal(e.main.label, "Your target mix"); assert.equal(e.amount, 0);
});

test("limits: each person's limits with catch-ups against the contributions, the Roth income check, the deadlines", () => {
  const l = limits(investmentsPlan(), { today: TODAY });
  assert.equal(l.limitsYear, 2026);
  const sam = l.people.find((p) => p.name === "Sam");
  assert.deepEqual(sam.rows.map((r) => [r.kind, r.limit, r.used]), [["401k", 32500, 18000], ["ira", 8600, 7000], ["hsa", 9750, 6000]]);   // family HSA limit plus Sam's own 55+ catch-up (Lee's goes in Lee's HSA)
  // the HSA page's 6,000 (5,000 + 1,000 from the employer) is Sam's, the covered adult marked "Me", not each adult's; Lee's
  // share of the family limit is what Sam leaves: 1,000 catch-up + 8,750 - (6,000 - 1,000) (IRC 223(b)(4), (b)(5))
  assert.equal(l.people.find((p) => p.name === "Lee").rows[2].limit, 4750);
  assert.equal(l.totals.used, 38000); assert.equal(l.totals.limit, 91950);
  assert.equal(l.roth.status, "ok"); assert.equal(l.deadlines[0].date, "2027-04-15");
  const p = investmentsPlan(); p.taxes.thisYear.wages = 300000; assert.equal(limits(p, { today: TODAY }).roth.status, "over");
  assert.ok(limits(emptyPlan(), { today: TODAY }).notes.length);
});

test("tax lots: gains per lot, short against long, the losses worth harvesting and the sell-first order", () => {
  const t = taxLots(investmentsPlan(), { today: TODAY });
  const vti = t.holdings.find((h) => h.symbol === "VTI");
  assert.equal(vti.lots.length, 2); assert.equal(vti.lots[0].term, "long"); assert.equal(vti.lots[1].term, "short"); near(vti.lots[1].gain, -3000); assert.equal(vti.unassignedShares, 0);
  const bnd = t.holdings.find((h) => h.symbol === "BND"); assert.equal(bnd.lots.length, 1); assert.equal(bnd.lots[0].assigned, false); near(bnd.lots[0].gain, -4900);
  assert.deepEqual(t.harvest.map((h) => [h.symbol, Math.round(h.loss), h.lot.term]), [["BND", 4900, "long"], ["VTI", 3000, "short"]]);
  near(t.harvestTotal, 7900); near(t.taxSavedTotal, 4900 * t.gainsRate + 3000 * t.marginal, 0.01);
  assert.equal(t.sellFirst[0].symbol, "VTI"); assert.ok(t.notes.some((n) => n.includes("wash")));
  assert.equal(taxLots(emptyPlan(), { today: TODAY }).ready, false);
});
