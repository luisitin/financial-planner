// tests/retirement-ways.test.mjs -- core/math/retirement.js: the ways that set their own withdrawal count guaranteed income first
// (round 8, widow-1). The owner answered on 2026-11-06: "You can do as you please. Just make sure a layman can easily understand
// and use the page". Each case is worked by hand in its comment; nothing here is read back from the engine to set an expectation.
//   percent:    the year's withdrawal from savings = savings at the start of the year x the rate
//   vpw:        the year's withdrawal = pmt(real return, years left, savings), paid at the start of the year
//   guardrails: the first year's withdrawal = max(0, planned spending + health cover + tax - guaranteed income); later years test
//               that withdrawal against savings (cut the spending target 10% above 1.2 x the rate; back up 10% below 0.8 x the
//               rate (also when nothing is drawn: 5b R3, 2026-11-07), never past the plan's own figure grown with inflation; else inflation)
//   spending = guaranteed income + withdrawal - tax - health cover (never below 0; guardrails never below its target)
//   "fixed-real" is unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { project } from "../core/math/retirement.js";

const near = (a, b, tol = 0.01, why = "") => assert.ok(Math.abs(a - b) <= tol, `${why} ${a} != ${b}`);
/** One retired person (70 in 2026), no returns, no inflation, no required withdrawals unless said. */
const retiree = (over = {}) => ({
  startYear: 2026, endYear: 2035,
  people: [{ name: "Example", birthYear: 1956, retireAge: 65, endAge: 79 }],
  balances: { cash: 0, taxable: 0, deferred: 0, free: 0 },
  contributions: [], incomes: [], spending: { yearly: 50000 }, retireYear: 2026,
  rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0.15, stocksNow: 0.5, stocksRetired: 0.5 },
  returns: { stocks: 0, bonds: 0 }, rmd: null, strategy: "fixed-real", withdrawalRate: 0.04, ...over,
});
const pension = (yearly) => ({ name: "Pension", yearly, personIndex: 0, startAge: 60, cola: true, taxable: true });
const out = (row) => row.withdrawn.cash + row.withdrawn.taxable + row.withdrawn.deferred + row.withdrawn.free;

test("a share of what is left: the rate sets the withdrawal; income comes on top of it, tax comes off", () => {
  // $500,000 in a taxable account (no tax on taking it), $30,000 of pension: 4% = $20,000 taken, $50,000 to spend (was $20,000)
  const r = project(retiree({ balances: { cash: 0, taxable: 500000, deferred: 0, free: 0 }, incomes: [pension(30000)], strategy: "percent" }));
  near(out(r.rows[0]), 20000); near(r.rows[0].spending, 50000); near(r.rows[0].taxes, 0);
  // year 2: 4% of the $480,000 left = $19,200, so $49,200
  near(out(r.rows[1]), 19200); near(r.rows[1].spending, 49200);
  // the same from a pre-tax IRA at the flat 15%: $20,000 taken, $3,000 of tax on it, $47,000 to spend
  const d = project(retiree({ balances: { cash: 0, taxable: 0, deferred: 500000, free: 0 }, incomes: [pension(30000)], strategy: "percent" }));
  near(out(d.rows[0]), 20000); near(d.rows[0].taxes, 3000); near(d.rows[0].spending, 47000);
});

test("spend what the years left can afford: the payment over the years left, with income on top", () => {
  // $100,000, 10 years left (2026 to 2035), 0% real return: a tenth, $10,000 a year taken; with $30,000 of pension, $40,000
  const r = project(retiree({ balances: { cash: 0, taxable: 100000, deferred: 0, free: 0 }, incomes: [pension(30000)], strategy: "vpw" }));
  near(out(r.rows[0]), 10000); near(r.rows[0].spending, 40000);
  near(out(r.rows[9]), 10000); near(r.rows[9].spending, 40000); assert.equal(r.success, true);
});

test("guardrails start from what the plan spends less income, and never cut while income covers the spending", () => {
  // $50,000 planned, $45,000 of pension, flat 15% on the IRA: the first withdrawal is grossed up, 5,000 / 0.85 = $5,882.35, its
  // tax is $882.35, and spending is exactly $50,000 (was: all $50,000 tested against savings, then cuts below the pension)
  const r = project(retiree({ balances: { cash: 0, taxable: 0, deferred: 500000, free: 0 }, incomes: [pension(45000)], strategy: "guardrails" }));
  near(out(r.rows[0]), 5000 / 0.85); near(r.rows[0].taxes, 0.15 * 5000 / 0.85); near(r.rows[0].spending, 50000);
  // every year: 1.2% of savings, under the 3.2% line, but nothing lifts spending past the plan's $50,000; never a cut
  for (const x of r.rows) { near(x.spending, 50000, 0.01, String(x.year)); near(out(x), 5000 / 0.85, 0.01, String(x.year)); }
  // income above what she spends and its tax: nothing is drawn and the whole income is spent, whatever markets do
  const rich = project(retiree({ balances: { cash: 0, taxable: 500000, deferred: 0, free: 0 }, incomes: [pension(60000)], strategy: "guardrails" }),
    { sequence: Array.from({ length: 10 }, (_, k) => ({ stocks: k < 3 ? -0.3 : 0, bonds: k < 3 ? -0.3 : 0, inflation: 0 })) });
  for (const x of rich.rows) { near(out(x), 0, 0.01, String(x.year)); near(x.spending, 60000, 0.01, String(x.year)); }
});

test("guardrails: a small draw cannot compound up (round 8 review D8: $1,000 on $500,000 reaching about $16,000 in 29 years)", () => {
  // $49,000 of pension, $50,000 planned, $500,000 that pays no tax: $1,000 a year is drawn, 0.2% of savings. A 10% raise on the
  // draw every year would reach 1,000 x 1.1^29 = $15,863 by the 30th year; spending stays at the plan's $50,000 and the draw at $1,000
  const I = retiree({ endYear: 2055, people: [{ name: "Example", birthYear: 1956, retireAge: 65, endAge: 99 }], balances: { cash: 0, taxable: 500000, deferred: 0, free: 0 }, incomes: [pension(49000)], strategy: "guardrails" });
  const r = project(I);
  assert.equal(r.rows.length, 30);
  for (const x of r.rows) { near(x.spending, 50000, 0.01, String(x.year)); near(out(x), 1000, 0.01, String(x.year)); }
  // with 3% inflation and a 7% return the same holds in today's dollars: never above the plan's figure grown with inflation
  const g = project({ ...I, rates: { ...I.rates, inflation: 0.03 }, returns: { stocks: 0.07, bonds: 0.07 } });
  for (const x of g.rows) assert.ok(x.spendingReal <= 50000 + 0.01, `${x.year}: ${x.spendingReal}`);
  assert.ok(Math.max(...g.rows.map((x) => out(x) / x.priceLevel)) < 1000 + 0.01);
});

test("guardrails: a cut comes after a fall, and the raise back stops at the plan's own figure", () => {
  // no income: $100,000 planned on $2,000,000: in year 2 it is 100,000 / 1,900,000 = 5.3% of the pot, above 4.8%: cut to $90,000
  const r = project(retiree({ balances: { cash: 0, taxable: 2000000, deferred: 0, free: 0 }, spending: { yearly: 100000 }, strategy: "guardrails" }));
  near(r.rows[0].spending, 100000); near(r.rows[1].spending, 90000);
  // a rich year: $40,000 planned on $2,000,000 (2%, under 3.2%): the old rule raised it 10% a year to $64,420 by year 6; it stays at $40,000
  const rich = project(retiree({ balances: { cash: 0, taxable: 2000000, deferred: 0, free: 0 }, spending: { yearly: 40000 }, strategy: "guardrails" }));
  for (const x of rich.rows) near(x.spending, 40000, 0.01, String(x.year));
  // cut in a crash, then back to the plan (and no further) once markets recover: -40% in year 1, then +30% a year. By hand:
  // 36,000 (6.9%), 32,400 (5.1%), 32,400 (3.7%), 35,640 (3.0%), 39,204 (2.6%), then 40,000, not 43,124
  const seq = [{ stocks: -0.4, bonds: -0.4, inflation: 0 }, ...Array.from({ length: 9 }, () => ({ stocks: 0.3, bonds: 0.3, inflation: 0 }))];
  const c = project(retiree({ balances: { cash: 0, taxable: 1000000, deferred: 0, free: 0 }, spending: { yearly: 40000 }, strategy: "guardrails" }), { sequence: seq });
  near(c.rows[0].spending, 40000);
  near(c.rows[1].spending, 36000, 0.01, "40,000 on 576,000 = 6.9%: cut 10%");
  assert.ok(Math.max(...c.rows.map((x) => x.spending)) <= 40000 + 0.01);
  near(c.rows[9].spending, 40000, 0.01, "raised back to the plan's figure");
});

test("no way leaves guaranteed income unspent: spending, health cover and tax add up to at least the year's income", () => {
  const I = retiree({ endYear: 2050, people: [{ name: "Example", birthYear: 1956, retireAge: 65, endAge: 94 }], balances: { cash: 10000, taxable: 50000, deferred: 400000, free: 0 },
    incomes: [pension(30000), { name: "Social Security", yearly: 20000, personIndex: 0, startAge: 72, cola: true, taxable: true }],
    rates: { inflation: 0.03, cash: 0.02, salaryGrowth: 0, taxRate: 0.15, stocksNow: 0.5, stocksRetired: 0.5 }, returns: { stocks: 0.07, bonds: 0.04 },
    rmd: { birthYear: 1956, startAge: 75 }, events: [{ year: 2028, amount: 6000, spending: true }], spending: { yearly: 45000 } });
  for (const key of ["percent", "vpw", "guardrails"]) {
    const r = project({ ...I, strategy: key });
    for (const x of r.rows.filter((y) => y.retired)) assert.ok(x.spending + x.eventSpending + x.taxes >= x.income - 0.005, `${key} ${x.year}: ${x.spending} + ${x.eventSpending} + ${x.taxes} < ${x.income}`);
  }
});

test("a required withdrawal above the way's own draw: the rest goes back into savings, and spending is income plus the draw less tax", () => {
  // 75 in 2026 with $246,000 in an IRA: the law requires 246,000 / 24.6 = $10,000. 2% of the $246,000 is $4,920. Flat 15% on the
  // $10,000 = $1,500. Spending = 30,000 + 4,920 - 1,500 = $33,420; $10,000 - $4,920 = $5,080 goes into the taxable account
  const r = project(retiree({ people: [{ name: "Example", birthYear: 1951, retireAge: 65, endAge: 84 }], balances: { cash: 0, taxable: 0, deferred: 246000, free: 0 },
    incomes: [pension(30000)], rmd: { birthYear: 1951, startAge: 73 }, strategy: "percent", withdrawalRate: 0.02 }));
  const y = r.rows[0];
  near(y.rmd, 10000); near(out(y), 10000); near(y.taxes, 1500); near(y.spending, 33420); near(y.balances.taxable, 5080);
});

test("a share of what is left with health cover and a one-off cost: the cover is paid from income and the draw, the one-off on top", () => {
  // $400,000 taxable, 5% = $20,000; $30,000 of pension; $8,000 of health cover that year and a $5,000 one-off: $25,000 comes
  // out of savings; spending = 30,000 + 20,000 - 0 tax - 8,000 = $42,000
  const r = project(retiree({ balances: { cash: 0, taxable: 400000, deferred: 0, free: 0 }, incomes: [pension(30000)], strategy: "percent", withdrawalRate: 0.05,
    events: [{ year: 2026, amount: 8000, spending: true }, { year: 2026, amount: 5000 }] }));
  const y = r.rows[0];
  near(out(y), 25000); near(y.spending, 42000); near(y.eventSpending, 8000);
});

test("the same spending every year is unchanged: income above the need is not spent, the tax on a required withdrawal still comes from it", () => {
  // 75 in 2026, $246,000 IRA ($10,000 required, $1,500 tax), $60,000 of pension, $40,000 planned: spending stays $40,000 and
  // $10,000 - $1,500 = $8,500 goes into the taxable account (the $20,000 of income over the plan is not counted)
  const r = project(retiree({ people: [{ name: "Example", birthYear: 1951, retireAge: 65, endAge: 84 }], balances: { cash: 0, taxable: 0, deferred: 246000, free: 0 },
    incomes: [pension(60000)], rmd: { birthYear: 1951, startAge: 73 }, spending: { yearly: 40000 } }));
  near(r.rows[0].spending, 40000); near(r.rows[0].taxes, 1500); near(r.rows[0].balances.taxable, 8500);
});

// ---- Batch 5b review fixes (2026-11-06) ------------------------------------------------------------------------------------------
test("review D1: with no guaranteed income, tax and health cover come on top of the share, as before the owner's change", () => {
  // $1,000,000 in a pre-tax IRA at a flat 20%, no income, 4%: the share is $40,000 to spend. The tax on what comes out is paid on
  // top: W = 40,000 + 0.2 W, so W = $50,000 and the tax is $10,000 (bc7f3ca: the same 40,000 / 50,000). It was $32,000 spent.
  const r = project(retiree({ balances: { cash: 0, taxable: 0, deferred: 1000000, free: 0 }, rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0.2, stocksNow: 0.5, stocksRetired: 0.5 }, strategy: "percent" }));
  near(out(r.rows[0]), 50000); near(r.rows[0].taxes, 10000); near(r.rows[0].spending, 40000);
  // the same household on years left: 10 years, 0% real, $100,000 a year to spend, $125,000 out with $25,000 of tax
  const v = project(retiree({ balances: { cash: 0, taxable: 0, deferred: 1000000, free: 0 }, rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0.2, stocksNow: 0.5, stocksRetired: 0.5 }, strategy: "vpw" }));
  near(out(v.rows[0]), 125000); near(v.rows[0].taxes, 25000); near(v.rows[0].spending, 100000);
  // $1,000,000 untaxed with $12,000 of health cover: $40,000 to spend, $52,000 out (it was $28,000 to spend)
  const h = project(retiree({ balances: { cash: 0, taxable: 1000000, deferred: 0, free: 0 }, strategy: "percent", events: [{ year: 2026, amount: 12000, spending: true }] }));
  near(out(h.rows[0]), 52000); near(h.rows[0].spending, 40000); near(h.rows[0].eventSpending, 12000);
  // a $5,000 pension pays the first $5,000 of that health cover: $40,000 to spend, $47,000 out
  const p = project(retiree({ balances: { cash: 0, taxable: 1000000, deferred: 0, free: 0 }, incomes: [pension(5000)], strategy: "percent", events: [{ year: 2026, amount: 12000, spending: true }] }));
  near(out(p.rows[0]), 47000); near(p.rows[0].spending, 40000);
  // once income pays the tax and health cover, the rest of it is spent on top of the share: a $20,000 pension, $12,000 of cover,
  // $40,000 share untaxed: 40,000 + (20,000 - 12,000) = $48,000 spent, $40,000 out
  const q = project(retiree({ balances: { cash: 0, taxable: 1000000, deferred: 0, free: 0 }, incomes: [pension(20000)], strategy: "percent", events: [{ year: 2026, amount: 12000, spending: true }] }));
  near(out(q.rows[0]), 40000); near(q.rows[0].spending, 48000);
  // and in every case spending + health cover + tax = income + what comes out of savings
  for (const x of [r, v, h, p, q].map((z) => z.rows[0])) near(x.spending + x.eventSpending + x.taxes, x.income + out(x));
});

test("review D4: after a losing year with falling prices, guardrails' target still falls with prices (never past the plan)", () => {
  // $1,500,000 untaxed, $50,000 planned, no income. 2026: -20% with prices -10% (a real loss of 11%); 2027: prices -10% again.
  // 2027: 50,000 / (1,450,000 x 0.8 = 1,160,000) = 4.3%, inside the guardrails, after a losing year: no rise with prices, but the
  // fall still applies: 50,000 x 0.9 = $45,000, which is $50,000 at 2027's prices (0.9). The old rule kept $50,000 nominal: $55,556.
  const seq = [{ stocks: -0.2, bonds: -0.2, inflation: -0.1 }, { stocks: 0, bonds: 0, inflation: -0.1 }, ...Array.from({ length: 8 }, () => ({ stocks: 0, bonds: 0, inflation: 0 }))];
  const r = project(retiree({ balances: { cash: 0, taxable: 1500000, deferred: 0, free: 0 }, strategy: "guardrails" }), { sequence: seq });
  near(r.rows[1].priceLevel, 0.9, 1e-9); near(r.rows[1].spending, 45000); near(r.rows[1].spendingReal, 50000);
  for (const x of r.rows) assert.ok(x.spendingReal <= 50000 + 0.01, `${x.year}: ${x.spendingReal}`);
  // a losing year with rising prices still skips the rise: -20% with prices +3%, then 4.3%: $50,000 stays $50,000
  const up = project(retiree({ balances: { cash: 0, taxable: 1500000, deferred: 0, free: 0 }, strategy: "guardrails" }),
    { sequence: [{ stocks: -0.2, bonds: -0.2, inflation: 0.03 }, { stocks: 0, bonds: 0, inflation: 0.03 }, ...Array.from({ length: 8 }, () => ({ stocks: 0, bonds: 0, inflation: 0 }))] });
  near(up.rows[1].spending, 50000);
  // a cut in a year prices fall by more than a tenth (the 1930s): $1,000,000, $50,000 planned, -50% with prices -20%, then
  // 50,000 / 475,000 = 10.5%: cut. A tenth off is $45,000, which at 2027's prices (0.8) is $56,250 of today's money, more than
  // the plan; the target is held at the plan: $40,000, $50,000 in today's dollars (key rows page-spending-summaries-006 and the like)
  const deep = project(retiree({ balances: { cash: 0, taxable: 1000000, deferred: 0, free: 0 }, strategy: "guardrails" }),
    { sequence: [{ stocks: -0.5, bonds: -0.5, inflation: -0.2 }, { stocks: 0, bonds: 0, inflation: -0.2 }, ...Array.from({ length: 8 }, () => ({ stocks: 0, bonds: 0, inflation: 0 }))] });
  near(deep.rows[1].spending, 40000); near(deep.rows[1].spendingReal, 50000);
});

test("UX review 14: years left pays at the expected return, not that year's market (no $0 years in a crash)", () => {
  // $100,000, 10 years, expected 0% real (returns 0, prices flat). A -50% first year: the old rule priced the payment at that
  // year's own -50%, 100,000 / (1 + 2 + 4 + ... + 512) = $97.75; at the expected 0% it is a tenth, $10,000
  const seq = [{ stocks: -0.5, bonds: -0.5, inflation: 0 }, ...Array.from({ length: 9 }, () => ({ stocks: 0.3, bonds: 0.3, inflation: 0 }))];
  const r = project(retiree({ balances: { cash: 0, taxable: 100000, deferred: 0, free: 0 }, spending: { yearly: 0 }, strategy: "vpw" }), { sequence: seq });
  near(out(r.rows[0]), 10000); near(r.rows[0].spending, 10000);
  // year 2: (100,000 - 10,000) x 0.5 = 45,000 over 9 years = $5,000 (the old rule: 45,000 at +30% over 9 years, about $3,185)
  near(out(r.rows[1]), 5000);
  // the expected run (no sequence) is unchanged: the expected return is the one it always used
  const e = project(retiree({ balances: { cash: 0, taxable: 100000, deferred: 0, free: 0 }, returns: { stocks: 0.05, bonds: 0.05 }, strategy: "vpw" }));
  near(out(e.rows[0]), 100000 * 0.05 / (1 - Math.pow(1.05, -10)) / 1.05);
});

test("verify R1: while income pays for everything, guardrails' target follows prices after a losing year (it does not sink unseen)", () => {
  // $500,000 untaxed, $50,000 planned, a $60,000 pension with no raise for prices. Three years of stocks and bonds -20% with prices
  // +10% (losing years), then flat. 2026: the pension pays the $50,000 target, nothing is drawn, $60,000 is spent.
  // 2027 (prices 1.1): the target needs nothing, so it follows prices: $55,000 ($50,000 today). Spent: the pension, $60,000.
  // 2028 (prices 1.21): $55,000 needs nothing, so it follows prices again: $60,500 = the plan at these prices; the pension pays
  // $60,000 and savings $500: $60,500 spent, $50,000 in today's dollars. The rule before froze the target at $50,000 a year at a
  // time with nothing drawn ($41,322 today), so 2028 spent only the pension: $60,000 = $49,587 today, with $320,000 untouched.
  // 2029 (prices flat from here, 1.21): the $60,500 target needs $500 of $255,600 (0.2%, under 3.2%): up, but capped at the plan,
  // so $60,500 again, $500 drawn. Every year from 2028 spends the plan's $50,000 in today's dollars.
  const seq = [...Array.from({ length: 3 }, () => ({ stocks: -0.2, bonds: -0.2, inflation: 0.1 })), ...Array.from({ length: 7 }, () => ({ stocks: 0, bonds: 0, inflation: 0 }))];
  const r = project(retiree({ balances: { cash: 0, taxable: 500000, deferred: 0, free: 0 }, incomes: [{ ...pension(60000), cola: false }], strategy: "guardrails" }), { sequence: seq });
  near(r.rows[0].spending, 60000); near(out(r.rows[0]), 0);
  near(r.rows[1].spending, 60000); near(out(r.rows[1]), 0);
  near(r.rows[2].spending, 60500); near(r.rows[2].spendingReal, 50000); near(out(r.rows[2]), 500);
  for (const x of r.rows.slice(3)) { near(x.spending, 60500, 0.01, String(x.year)); near(x.spendingReal, 50000, 0.01, String(x.year)); near(out(x), 500, 0.01, String(x.year)); }
  // and while savings pay toward the target a losing year still holds it (review D4's rule is unchanged): see the D4 test above
});

test("5b R3 (follow-up 2026-11-07): a trimmed guardrails target is raised back once Social Security covers it, never past the plan", async () => {
  // Pat and Jo retire at 62 on a $60,000 plan. Health cover before 65 pushes the withdrawal past 1.2 x the rate, so the target is
  // trimmed in 2029-2032 (savings paying). From 2033 Social Security and the pension cover it, so nothing is drawn. Before this change
  // the raise needed a draw above $0: the target sat at $43,539 and then $38,000 for 29 years and they ended with $1,273,219.
  // Now the way's own raise rule (strictly below 0.8 x the rate: +10% a year) applies with a draw of $0 too, up to the plan.
  const { bridgeCouple } = await import("../qa/fixtures/retiree-cases.mjs");
  const { migrate } = await import("../core/schema/migrate.js");
  const WS = await import("../modules/retirement/withdrawal-strategy/compute.js");
  const I = WS.inputsByWay(migrate(bridgeCouple()), { today: "2026-11-06" }).guardrails;
  const P = I.spending.yearly;
  const r = project({ ...I, strategy: "guardrails" });
  const ret = r.rows.filter((x) => x.retired);
  near(P, 60000);
  const at = (y) => ret.find((x) => x.year === y);
  // trimmed while savings paid (unchanged), held at $43,539 while the draw is still above $0
  near(at(2032).spendingReal, 34976.0, 1); near(at(2033).spendingReal, 43539, 1);
  // then raised back by a tenth a year of the target ($43,539 x 1.1 = $47,893 in 2036's prices: $45,498 here with prices), reaching the plan
  for (const y of [2036, 2037, 2038, 2039, 2040]) assert.ok(at(y).spendingReal > at(y - 1).spendingReal + 1, `${y} rises`);
  near(at(2041).spendingReal, 60000, 0.01);
  // never above the plan, from then on every year
  for (const x of ret.filter((x) => x.year >= 2041)) near(x.spendingReal, 60000, 0.01, String(x.year));
  assert.ok(ret.every((x) => x.spendingReal <= P + 0.01), "never above the plan in today's dollars");
  // 12 years under the plan, not 33; and the cost is told: $577,371 is left at the end, not $1,273,219
  assert.equal(ret.filter((x) => x.spendingReal < P - 1).length, 12);
  assert.ok(r.success); near(r.endBalanceReal, 577371, 1);
});

test("money review M1: with nothing drawn the target is raised back only if savings could pay the raised one without a trim", () => {
  // A 70-year-old with $5,000 saved, a $40,000 pension raised with prices, a $44,000 plan, 5% returns, 3% prices.
  // 2026 draws $4,000 ($1,050 left); 2027 the $44,000 target needs 267% of savings, so it is trimmed to $39,600 and the pension pays it
  // (draw $0). 2028: raising to $43,560 would need $1,124 of the $1,102.50 left, far over the trim line, so it follows prices instead
  // and the money lasts at $40,000 a year in today's dollars. Before the fix it raised anyway, came up short and swung year to year.
  const I = { startYear: 2026, endYear: 2033, people: [{ name: "A", birthYear: 1956, retireAge: 70, endAge: 77 }], balances: { cash: 0, taxable: 5000, deferred: 0, free: 0 },
    contributions: [], incomes: [{ name: "Pension", yearly: 40000, personIndex: 0, startAge: 60, cola: true, taxable: true }], spending: { yearly: 44000 }, retireYear: 2026,
    rates: { inflation: 0.03, cash: 0.02, salaryGrowth: 0, taxRate: 0, stocksNow: 0.5, stocksRetired: 0.5 }, returns: { stocks: 0.05, bonds: 0.05 }, strategy: "guardrails", withdrawalRate: 0.04, withdrawalOrder: ["taxable", "deferred", "free"], tax: { mode: "flat" } };
  const r = project(I);
  assert.ok(r.success, "lasts");
  assert.ok(r.rows.every((x) => x.shortfall < 0.005), "no short year");
  near(r.rows[0].spending, 44000, 0.01); near(r.rows[1].spendingReal, 40000, 1); near(r.rows[2].spending, 42436, 1);
  // and savings that could pay it do get the raise: the same pension with $500,000 saved goes back to the plan at once after a trim
  const rich = project({ ...I, balances: { cash: 0, taxable: 500000, deferred: 0, free: 0 }, spending: { yearly: 60000 } });
  assert.ok(rich.rows.every((x) => x.spendingReal <= 60000 + 0.01));
});
