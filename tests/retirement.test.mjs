// tests/retirement.test.mjs -- core/math/retirement.js and core/math/rmd.js on hand-checked cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { project, affordableSpending, STRATEGIES } from "../core/math/retirement.js";
import { rmdFactor, rmdStartAge, rmdStartYear, rmdAmount } from "../core/math/rmd.js";

const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const base = () => ({
  startYear: 2026, endYear: 2030,
  people: [{ name: "Ana", birthYear: 1966, retireAge: 62, endAge: 95 }],   // 60 in 2026, retires 2028
  balances: { cash: 10000, taxable: 100000, deferred: 200000, free: 50000 },
  contributions: [{ bucket: "deferred", yearly: 12000, personIndex: 0 }],
  incomes: [{ name: "Social Security", yearly: 24000, personIndex: 0, startAge: 67, cola: true, taxable: true }],
  spending: { yearly: 50000 }, retireYear: 2028,
  rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0.2, stocksNow: 0.6, stocksRetired: 0.6 },
  returns: { stocks: 0, bonds: 0 }, rmd: null, strategy: "fixed-real", withdrawalRate: 0.04,
});

test("RMD table and start age", () => {
  assert.equal(rmdFactor(73), 26.5); assert.equal(rmdFactor(90), 12.2); assert.equal(rmdFactor(130), 2.0); assert.equal(rmdFactor(60), Infinity);
  assert.equal(rmdStartAge(1955), 73); assert.equal(rmdStartAge(1960), 75); assert.equal(rmdStartAge(1950), 72);
  assert.equal(rmdStartAge("1949-06-30"), 70.5); assert.equal(rmdStartAge("1949-07-01"), 72); assert.equal(rmdStartAge(1948), 70.5, "a year alone counts as January 1");
  assert.equal(rmdStartYear("1948-06-30"), 2018); assert.equal(rmdStartYear("1948-07-01"), 2019); assert.equal(rmdStartYear("1955-03-01"), 2028);
  near(rmdAmount(265000, 73), 10000, 0.01); assert.equal(rmdAmount(265000, 65), 0);
});
test("zero returns, zero inflation: contributions while working, then spending from cash, taxable, deferred (grossed up)", () => {
  const r = project(base());
  assert.equal(r.rows.length, 5); assert.equal(r.success, true);
  // 2026, 2027: +12,000 deferred each year, no spending
  near(r.rows[1].balances.deferred, 224000); assert.equal(r.rows[1].spending, 0);
  // 2028: retired at 62, no SS yet: 50,000 from cash (10,000) then taxable (40,000)
  const y3 = r.rows[2];
  assert.equal(y3.retired, true); near(y3.withdrawn.cash, 10000); near(y3.withdrawn.taxable, 40000); near(y3.taxes, 0);
  // 2029: 50,000 from taxable (60,000 left) ; 2030: 10,000 taxable then 40,000 net from deferred = 50,000 gross, 10,000 tax
  const y5 = r.rows[4];
  near(y5.withdrawn.taxable, 10000); near(y5.withdrawn.deferred, 50000); near(y5.taxes, 10000);
  near(r.endBalance, 224000 - 50000 + 50000, 1);
  assert.equal(r.rows[4].ages[0], 64);
});
test("income with a start age offsets spending; ends when the money is gone", () => {
  const i = base(); i.endYear = 2045; i.balances = { cash: 0, taxable: 100000, deferred: 0, free: 0 }; i.contributions = [];
  const r = project(i);
  assert.equal(r.success, false); assert.equal(r.failYear, 2030, "100k covers 2028 and 2029, fails in 2030");
  assert.equal(r.failAge, 64);
  const i2 = base(); i2.endYear = 2045; i2.balances = { cash: 0, taxable: 120000, deferred: 0, free: 0 }; i2.contributions = []; i2.spending = { yearly: 24000 };
  const r2 = project(i2);
  assert.equal(r2.success, true, "from 67 Social Security covers the whole 24,000");
  near(r2.rows.find((x) => x.year === 2033).income, 24000);
  near(r2.endBalanceReal, 120000 - 24000 * 5, 1);
});
test("inflation raises spending and COLA income; real values stay flat; returns grow the pot", () => {
  const i = base(); i.rates.inflation = 0.03; i.returns = { stocks: 0.07, bonds: 0.04 }; i.endYear = 2030;
  const r = project(i);
  near(r.rows[4].priceLevel, Math.pow(1.03, 4), 1e-6);
  near(r.rows[4].spendingReal, 50000, 0.01);
  near(r.rows[0].portfolioReturn, 0.6 * 0.07 + 0.4 * 0.04, 1e-9);
  assert.ok(r.rows[0].total > 360000 + 12000);
});
test("a return sequence overrides the expected returns year by year", () => {
  const i = base(); i.contributions = []; i.spending = { yearly: 0 }; i.balances = { cash: 0, taxable: 100000, deferred: 0, free: 0 }; i.endYear = 2027;
  const r = project(i, { sequence: [{ stocks: -0.5, bonds: -0.5 }, { stocks: 1, bonds: 1 }] });
  near(r.rows[0].total, 50000); near(r.rows[1].total, 100000);
});
test("RMD forces deferred money out; the excess lands in taxable", () => {
  const i = base(); i.people[0].birthYear = 1953; i.startYear = 2026; i.endYear = 2026; i.retireYear = 2020; i.contributions = []; i.incomes = [];
  i.balances = { cash: 0, taxable: 0, deferred: 265000, free: 0 }; i.spending = { yearly: 5000 }; i.rmd = { birthYear: 1953, startAge: 73 };
  const r = project(i);   // age 73 in 2026: RMD = 265,000 / 26.5 = 10,000; tax 2,000; net 8,000 covers 5,000, 3,000 to taxable
  near(r.rows[0].rmd, 10000, 0.01); near(r.rows[0].withdrawn.deferred, 10000, 0.01); near(r.rows[0].taxes, 2000, 0.01); near(r.rows[0].balances.taxable, 3000, 0.01);
});
test("strategies: percent, vpw and guardrails spend from the pot; affordable spending finds the ceiling", () => {
  const i = base(); i.endYear = 2035; i.contributions = []; i.incomes = []; i.retireYear = 2026;
  i.balances = { cash: 0, taxable: 1000000, deferred: 0, free: 0 };
  const pct = project({ ...i, strategy: "percent", withdrawalRate: 0.04 });
  near(pct.rows[0].spending, 40000); near(pct.rows[1].spending, 38400, 1, "4% of 960,000");
  const vpw = project({ ...i, strategy: "vpw" });
  near(vpw.rows[0].spending, 100000, 1, "0% real return, 10 years left: a tenth each year");
  const g = project({ ...i, strategy: "guardrails", withdrawalRate: 0.04 });
  near(g.rows[0].spending, 50000); assert.ok(g.rows[1].spending < 50000, "5% of the pot is above the 4.8% guardrail: cut 10%");
  assert.ok(Object.keys(STRATEGIES).length === 4);
  const aff = affordableSpending({ ...i, strategy: "fixed-real" });
  near(aff, 100000, 60, "1,000,000 over 10 years with zero returns");
});

// ---- brackets mode: the federal engine inside the projection ----
import { FEDERAL } from "../modules/taxes/federal/data/federal.js";
const P25 = () => FEDERAL[2025];
const bracketsInputs = () => ({
  ...base(), startYear: 2025, endYear: 2027, retireYear: 2025,
  people: [{ name: "Bo", birthYear: 1965, retireAge: 60, endAge: 95 }],   // 60 in 2025
  balances: { cash: 0, taxable: 0, deferred: 1000000, free: 0 }, contributions: [], incomes: [], spending: { yearly: 60000 },
  tax: { mode: "brackets", filingStatus: "single", paramsFor: P25, gainShare: 0.5, dividendYield: 0 },
});

test("brackets: a pre-tax withdrawal is grossed up through the real brackets (60,000 to spend costs 65,960 in 2025)", () => {
  const r = project(bracketsInputs());
  const y = r.rows[0];
  near(y.withdrawn.deferred, 65960.26, 0.05); near(y.taxes, 5960.26, 0.05);
  assert.equal(y.taxInfo.bracketRate, 0.22); near(y.taxInfo.taxableIncome, 50210.26, 0.05);
  assert.equal(r.taxMode, "brackets"); assert.equal(r.success, true);
});

test("brackets: Social Security goes through the benefits worksheet, and the tax is paid from cash", () => {
  const i = bracketsInputs();
  i.people = [{ name: "Cy", birthYear: 1959, retireAge: 60, endAge: 95 }];   // 66 in 2025: age allowance and the senior deduction
  i.balances = { cash: 20000, taxable: 0, deferred: 0, free: 0 };
  i.incomes = [{ name: "Pension", yearly: 20000, personIndex: 0, startAge: 60, cola: false, taxable: true }, { name: "Social Security", yearly: 30000, personIndex: 0, startAge: 60, cola: false, taxable: true, kind: "social" }];
  i.spending = { yearly: 50000 };
  const y = project(i).rows[0];
  near(y.taxInfo.taxableSocialSecurity, 5350); near(y.taxes, 160); near(y.withdrawn.cash, 160); assert.equal(y.shortfall, 0);
});

test("brackets: Roth conversions fill the chosen bracket before RMDs and stop at the until-age; the order of withdrawals can be changed", () => {
  const i = bracketsInputs();
  i.balances = { cash: 0, taxable: 500000, deferred: 400000, free: 0 }; i.spending = { yearly: 30000 };
  i.tax.dividendYield = 0.02; i.rothConversion = { fillRate: 0.12, untilAge: 62 };
  const r = project(i);
  const y0 = r.rows[0];
  near(y0.taxInfo.taxableIncome, 48475, 5);                 // filled to the top of the 12% bracket, gains and dividends from the taxable bucket included
  assert.ok(y0.conversion > 35000 && y0.conversion < 40000, String(y0.conversion));   // 48,475 + 15,750 less 10,000 of dividends and the gains on what was sold to spend and pay the tax
  near(y0.balances.free, y0.conversion, 0.01); near(y0.withdrawn.taxable, 30000 + y0.taxes, 0.01);
  assert.equal(y0.taxInfo.bracketRate, 0.12);
  assert.ok(r.rows[1].conversion > 0); assert.equal(r.rows[2].conversion, 0);   // 62 in 2027: stopped
  near(r.totalConverted, y0.conversion + r.rows[1].conversion, 0.01);
  const j = bracketsInputs(); j.balances = { cash: 0, taxable: 100000, deferred: 100000, free: 100000 }; j.withdrawalOrder = ["free", "taxable", "deferred"];
  const z = project(j).rows[0];
  near(z.withdrawn.free, 60000, 0.01); assert.equal(z.withdrawn.taxable, 0); assert.equal(z.taxes, 0);
  const k = bracketsInputs(); k.balances = { cash: 0, taxable: 100000, deferred: 100000, free: 100000 }; k.rmd = { birthYear: 1965, startAge: 60 };
  const w = project(k).rows[0];                             // an RMD at 60 (forced for the test): 100,000 / 27.4 factor floor... rmdFactor(60) is Infinity, so no RMD
  assert.equal(w.rmd, 0);
});
test("what-if hooks: one-off money out and in, a spending change, calendar bounds on contributions and incomes", () => {
  // money out in a working year comes from cash first, then taxable; money in lands in taxable
  const out = base(); out.events = [{ year: 2026, amount: 15000, label: "six months without pay" }, { year: 2027, amount: -40000, label: "inheritance" }];
  const r = project(out);
  near(r.rows[0].eventOut, 15000); near(r.rows[0].withdrawn.cash, 10000); near(r.rows[0].withdrawn.taxable, 5000);
  near(r.rows[1].balances.taxable, 100000 - 5000 + 40000);
  // spending times 0.75 from 2029
  const sc = base(); sc.spendingChanges = [{ fromYear: 2029, factor: 0.75 }];
  const s = project(sc);
  near(s.rows[2].spending, 50000); near(s.rows[3].spending, 37500); near(s.rows[4].spending, 37500);
  // contributions: skipped in 2026, stopped after 2026 -> one year of 12,000 in each case
  const sk = base(); sk.contributions[0].skipYears = [2026];
  near(project(sk).rows[0].contributions, 0); near(project(sk).rows[1].contributions, 12000);
  const un = base(); un.contributions[0].untilYear = 2026;
  near(project(un).rows[0].contributions, 12000); near(project(un).rows[1].contributions, 0);
  // incomes bounded by calendar years on top of the start age
  const inc = base(); inc.endYear = 2035; inc.incomes = [{ name: "Survivor", yearly: 30000, personIndex: 0, startAge: 60, cola: true, taxable: true, fromYear: 2029, untilYear: 2030 }];
  const ri = project(inc);
  assert.deepEqual(ri.rows.map((x) => x.income), [0, 0, 0, 30000, 30000, 0, 0, 0, 0, 0]);
  // money out that savings cannot cover fails the plan in that year
  const big = base(); big.events = [{ year: 2027, amount: 1e6 }];
  const rb = project(big); assert.equal(rb.success, false); assert.equal(rb.failYear, 2027);
});
