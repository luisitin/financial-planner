// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("tax-lots: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

import { lotsOf, longOn, carryover, washSales } from "./compute.js";

const oneLot = (date) => ({ price: 10, shares: 1, costBasis: 5, lots: [{ id: "l1", date, shares: 1, cost: 5 }] });

test("tax-lots: long-term means held more than one year by the calendar (IRS Pub 550), leap years included", () => {
  // counting starts the day after the buy, so the first long-term day is the day after the first anniversary
  assert.equal(longOn("2026-03-15"), "2027-03-16");
  assert.equal(longOn("2027-03-15"), "2028-03-16");   // a February 29 in between: day 366 is still short-term
  assert.equal(longOn("2024-02-29"), "2025-03-01");   // no February 29 next year: the anniversary is February 28
  assert.equal(longOn("2025-12-31"), "2027-01-01");
  // bought February 28 before a leap year: the holding period starts March 1, its year ends February 29, so long-term from
  // March 1 (Rev. Rul. 66-7; the answer key's term-0014 and term-0288)
  assert.equal(longOn("2023-02-28"), "2024-03-01"); assert.equal(longOn("2027-02-28"), "2028-03-01");
  assert.deepEqual([lotsOf(oneLot("2023-02-28"), "2024-02-29")[0].term, lotsOf(oneLot("2023-02-28"), "2024-02-29")[0].daysToLong], ["short", 1]);
  const at = (date, today) => { const l = lotsOf(oneLot(date), today)[0]; return [l.term, l.daysToLong]; };
  assert.deepEqual(at("2027-03-15", "2028-03-15"), ["short", 1]);   // the anniversary itself (366 days held)
  assert.deepEqual(at("2027-03-15", "2028-03-16"), ["long", 0]);
  assert.deepEqual(at("2026-03-15", "2027-03-15"), ["short", 1]);   // 365 days held
  assert.deepEqual(at("2026-03-15", "2027-03-16"), ["long", 0]);
  assert.deepEqual(at("2024-02-29", "2025-02-28"), ["short", 1]);
  assert.deepEqual(at("2024-02-29", "2025-03-01"), ["long", 0]);
  assert.deepEqual(at("2026-10-31", "2026-10-31"), ["short", 366]);  // bought today: 2027-11-01 is 366 days away
  assert.equal(lotsOf(oneLot(null), "2026-10-31")[0].term, "long");  // no date: counted as long-term
});

test("tax-lots: the rates on a gain include the 3.8% on investment income, and a true 0% stays 0%", () => {
  const nothing = compute(emptyPlan(), { today: "2026-10-31" });
  assert.equal(nothing.marginal, 0);   // no income: a short-term gain is under the standard deduction
  assert.equal(nothing.gainsRate, 0);
  const p = emptyPlan();
  p.household.people = [{ id: "p1", name: "Adult A", birthDate: "1980-01-01", role: "self" }];
  p.income = [{ id: "i1", name: "Pay", type: "salary", personId: "p1", amount: 400000, period: "annual", taxable: true }];
  // single, $400,000 of pay: taxable income $383,900 is in the 35% bracket and under the 20% gains line; over the
  // $200,000 line for the 3.8% on investment income (IRC 1411)
  const d = compute(p, { today: "2026-10-31" });
  assert.ok(Math.abs(d.marginal - (0.35 + 0.038)) < 1e-9, String(d.marginal));
  assert.ok(Math.abs(d.gainsRate - (0.15 + 0.038)) < 1e-9, String(d.gainsRate));
});

// a household for the harvest examples of the answer key (tests/golden/tax-lots/RULES.md section 10), worked by hand there
function household({ status, today, interest, dividends = 0, longRealized = 0, holdings }) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult A", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = status; p.taxes.year = Number(today.slice(0, 4));
  p.income = [{ id: "int", name: "Interest", type: "investment", amount: interest, period: "annual", taxable: true }];
  p.taxes.thisYear.qualifiedIncome = dividends;
  p.taxes.gains = longRealized ? [{ id: "lt", name: "sales", proceeds: longRealized, basis: 0, held: "long" }] : [];
  p.accounts = [{ id: "brk", name: "Brokerage", type: "brokerage", balance: 0 }, { id: "ira", name: "IRA", type: "ira", balance: 0 }];
  p.holdings = holdings.map((h, i) => ({ id: `h${i}`, accountId: h.ira ? "ira" : "brk", symbol: h.symbol, name: "", shares: h.lots.reduce((s, l) => s + l.shares, 0), price: h.price, priceAsOf: today, costBasis: h.lots.reduce((s, l) => s + l.cost, 0), lots: h.lots.map((l, j) => ({ id: `h${i}l${j}`, ...l })) }));
  return p;
}

test("tax-lots: what a harvest saves this year: a net loss takes at most $3,000 off other income, the rest carries (IRC 1211(b), 1212(b))", () => {
  // RULES.md 10.1: single, $240,000 of interest, a $40,000 long-term loss and no gains: $3,000 at 32% + 3.8% saves $1,074
  // (not 40,000 x the 18.8% gains rate = $7,520), and $37,000 carries to next year as long-term
  const d = compute(household({ status: "single", today: "2026-11-16", interest: 240000, holdings: [{ symbol: "ZZTOT", price: 60, lots: [{ date: "2022-03-14", shares: 1000, cost: 100000 }] }] }), { today: "2026-11-16" });
  assert.equal(d.harvestTotal, 40000); assert.ok(Math.abs(d.taxSavedTotal - 1074) < 0.01, String(d.taxSavedTotal));
  assert.deepEqual([d.carry.short, d.carry.long, d.carryAdded.long], [0, 37000, 37000]);
  assert.equal(d.capLimit, 3000);
  // RULES.md 10.2: married jointly, $25,000 of long-term gains: the $8,000 short-term loss cancels long-term gain taxed at
  // 15%, not pay at the 27% the page's rate shows: $3,000 saved in all, nothing carried
  const j = compute(household({ status: "married_joint", today: "2025-12-15", interest: 120000, dividends: 5000, longRealized: 25000, holdings: [{ symbol: "ZZTEC", price: 40, lots: [{ date: "2025-06-02", shares: 400, cost: 24000 }, { date: "2021-09-20", shares: 300, cost: 24000 }] }] }), { today: "2025-12-15" });
  assert.ok(Math.abs(j.taxSavedTotal - 3000) < 0.01, String(j.taxSavedTotal)); assert.equal(j.carry.total, 0);
  assert.ok(Math.abs(j.marginal - 0.27) < 1e-9);
});

test("tax-lots: the carryover worksheet (Pub. 550 Worksheet 4-1), with taxable income below zero carrying more", () => {
  // Pub. 550's example: a $7,000 loss, $26,000 of taxable income: $3,000 deducted, $4,000 carried
  assert.deepEqual(carryover({ taxableIncome: 26000, allowed: 3000, shortNet: 0, longNet: -7000 }), { short: 0, long: 4000, total: 4000 });
  // short-term loss is used first: -5,000 short and -4,000 long carry 2,000 short and 4,000 long
  assert.deepEqual(carryover({ taxableIncome: 50000, allowed: 3000, shortNet: -5000, longNet: -4000 }), { short: 2000, long: 4000, total: 6000 });
  // RULES.md K1: single 2026, $5,000 of interest and a $10,000 long-term loss: taxable income -14,100, so all $10,000 carries
  assert.deepEqual(carryover({ taxableIncome: 5000 - 3000 - 16100, allowed: 3000, shortNet: 0, longNet: -10000 }), { short: 0, long: 10000, total: 10000 });
  // a long-term gain absorbs short-term loss first
  assert.deepEqual(carryover({ taxableIncome: 40000, allowed: 3000, shortNet: -10000, longNet: 4000 }), { short: 3000, long: 0, total: 3000 });
});

test("tax-lots: wash sales: the same fund bought in the 30 days before today cancels the loss on as many shares, an IRA's for good (IRC 1091(a); Rev. Rul. 2008-5)", () => {
  // RULES.md 10.4: 200 shares at a $4,000 loss, 50 bought 12 days ago in the IRA: $1,000 disallowed, $520 saved, not $740
  const p = household({ status: "head_of_household", today: "2026-11-20", interest: 95000, dividends: 1500, longRealized: 2000, holdings: [
    { symbol: "ZZTOT", price: 100, lots: [{ date: "2023-05-10", shares: 200, cost: 24000 }] },
    { symbol: "ZZTOT", price: 100, ira: true, lots: [{ date: "2026-11-08", shares: 50, cost: 5100 }] }] });
  const d = compute(p, { today: "2026-11-20" });
  const c = d.harvest[0];
  assert.equal(c.disallowed, 1000); assert.equal(c.allowed, 3000); assert.equal(c.washedBy.length, 1);
  assert.equal(c.washedBy[0].bucket, "deferred"); assert.equal(c.washedBy[0].shares, 50); assert.equal(c.washedBy[0].date, "2026-11-08");
  assert.ok(Math.abs(d.taxSavedTotal - 520) < 0.01, String(d.taxSavedTotal));
  // 31 days ago is outside the window: the whole loss counts
  p.holdings[1].lots[0].date = "2026-10-20";
  assert.equal(compute(p, { today: "2026-11-20" }).harvest[0].disallowed, 0);
  // a lot sold in the same harvest is never a replacement; an undated lot never is either (the key's W3, W4)
  const two = [{ loss: 100, lot: { shares: 10, date: "2026-11-10" } }, { loss: 100, lot: { shares: 10, date: null } }];
  const hs = [{ symbol: "X", account: "B", bucket: "taxable", lots: [two[0].lot, two[1].lot, { shares: 4, date: "2026-11-15" }] }];
  washSales(two, hs, "2026-11-20");
  assert.equal(two[1].disallowed, 40); assert.equal(two[0].disallowed, 0);   // the undated lot counts as sold first and takes the 4 shares
});
