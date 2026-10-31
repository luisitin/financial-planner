import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, growthRate, twoYearTest, fullMonths, addMonthsEnd, DEFAULTS, EXCLUSION } from "./compute.js";
import { compute as computeMortgage } from "../../debt/mortgage/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withDetails = (extra = {}) => { const p = familyPlan(TODAY); p.property = [{ id: "h1", kind: "home", accountId: "a-home", purchasePrice: 310000, purchaseDate: "2022-06-01", improvements: 15000, propertyTax: 4800, insurance: 1900, ...extra }]; return p; };

test("growthRate: compounded a year; nothing under a year", () => {
  near(growthRate(100, 121, 24), 0.1, 1e-9);
  assert.equal(growthRate(100, 120, 6), null); assert.equal(growthRate(0, 120, 24), null);
});

test("no home: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family's house: worth, owed, yours, and growth since 2022", () => {
  const d = compute(withDetails(), { today: TODAY });
  assert.equal(d.value, 380000); assert.equal(d.owed, 265000); assert.equal(d.equity, 115000);
  near(d.equityShare, 115000 / 380000); near(d.ltv, 265000 / 380000);
  near(d.bought.growth, Math.pow(380000 / 310000, 12 / 52) - 1, 1e-9);
});

test("a year of keeping it: tax, insurance, upkeep at 1% and the mortgage's interest", () => {
  const p = withDetails();
  const d = compute(p, { today: TODAY });
  const pay = yearOfPayments(265000, 0.0625, 1980);
  near(d.costs.total, 4800 + 1900 + 380000 * DEFAULTS.maintenance + pay.interest);
  near(d.costs.principal, pay.principal);
  const noTax = compute(familyPlan(TODAY), { today: TODAY });
  assert.ok(!noTax.costs.lines.some((l) => l.key === "tax"), "no property tax typed anywhere");
});

test("selling today: costs, the mortgage, and no tax under the joint exclusion", () => {
  const d = compute(withDetails(), { today: TODAY });
  near(d.sale.costs, 380000 * 0.06); near(d.sale.gain, 380000 - 22800 - 325000);
  assert.equal(d.sale.exclusion, EXCLUSION.married_joint); assert.equal(d.sale.tax, 0);
  near(d.sale.net, 380000 - 22800 - 265000);
});

test("a big gain above the exclusion is taxed at the gains rate", () => {
  const d = compute(withDetails({ purchasePrice: 100000, improvements: 0, purchaseDate: "1990-01-01" }), { today: TODAY });   // a 257,200 gain: still under 500,000
  const p = withDetails({ purchasePrice: 50000, improvements: 0, purchaseDate: "1985-01-01" });
  p.accounts.find((a) => a.id === "a-home").balance = 1200000;
  const big = compute(p, { today: TODAY });
  near(big.sale.taxable, 1200000 * 0.94 - 50000 - 500000);
  assert.ok(big.sale.rate >= 0.15); near(big.sale.tax, big.sale.taxable * big.sale.rate); assert.equal(big.sale.term, "long");
  assert.equal(d.sale.tax, 0);
});

test("ahead: the value growing, the mortgage on the mortgage page's schedule", () => {
  const p = withDetails();
  const d = compute(p, { today: TODAY });
  const sch = computeMortgage(p, { today: TODAY }).schedule;
  const five = d.ahead.find((a) => a.years === 5);
  near(five.value, 380000 * Math.pow(1.035, 5)); near(five.owed, sch.find((r) => r.year === 5).endBalance);
  near(five.equity, five.value - five.owed);
  assert.equal(d.ahead.find((a) => a.years === 20).owed, 0, "paid off by then");
});

// one adult filing single, typed wages, a home account and its details (the answer key's household, RULES.md 9.5-9.6)
function keyHome(wages, home, value, loan) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = "single"; p.household.state = "";
  p.taxes.year = 2026; p.taxes.thisYear.wages = wages;
  p.accounts = [{ id: "home", name: "Home", type: "property", balance: value }];
  if (loan) { p.accounts.push({ id: "mtg", name: "Mortgage", type: "mortgage", balance: loan.balance }); p.debts = [{ id: "d1", accountId: "mtg", rate: loan.rate, minPayment: loan.payment, extra: 0 }]; }
  p.property = [{ id: "h1", kind: "home", accountId: "home", name: "Home", ...home }];
  return p;
}

test("the two-year test: 730 days or 24 full months, whichever comes first; a month-end purchase counts month ends (26 CFR 1.121-1(c)(1))", () => {
  assert.deepEqual(twoYearTest("2025-05-16", "2026-11-16"), { days: 549, months: 18, meets: false, from: "2027-05-16" });
  // a February 29 inside: 730 days a day before 24 full months
  const t = twoYearTest("2023-11-02", "2025-11-01"); assert.equal(t.days, 730); assert.equal(t.months, 23); assert.equal(t.meets, true);
  assert.equal(fullMonths("2024-02-29", "2026-02-28"), 24); assert.equal(addMonthsEnd("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsEnd("2024-01-15", 1), "2024-02-15");
});

test("Pat's home, bought 18 months ago: no exclusion, the 27,400 gain at 15% is 4,110; bought 10 months ago it is taxed like pay, 6,040 (IRC 121(a), 1222; RULES.md 9.5)", () => {
  const pat = { purchasePrice: 400000, purchaseDate: "2025-05-16", improvements: 5000, propertyTax: 5500, insurance: 1600 };
  const d = compute(keyHome(95000, pat, 460000, { balance: 360000, rate: 0.06, payment: 2200 }), { today: "2026-11-16" });
  near(d.sale.gain, 27400); assert.equal(d.sale.exclusion, 0); near(d.sale.taxable, 27400);
  assert.equal(d.sale.term, "long"); assert.equal(d.sale.longOn, "2026-05-17");
  near(d.sale.tax, 4110); near(d.sale.net, 68290);
  const recent = compute(keyHome(95000, { ...pat, purchaseDate: "2026-01-16" }, 460000, { balance: 360000, rate: 0.06, payment: 2200 }), { today: "2026-11-16" });
  assert.equal(recent.sale.term, "short"); near(recent.sale.tax, 6040);   // 22% x 26,800 + 24% x 600
  // selling early for a new job: 549/730 of 250,000 (more than 18/24 by months) covers the gain (121(c); 1.121-3(g))
  const moved = compute(keyHome(95000, { ...pat, reducedReason: true }, 460000, { balance: 360000, rate: 0.06, payment: 2200 }), { today: "2026-11-16" });
  near(moved.sale.exclusion, 188013.70); near(moved.sale.tax, 0); near(moved.sale.net, 72400);
});

test("Quinn's long-held home: 450,000 taxable, stacked through 15% and 20%, the 3.8% only on income over 200,000: 87,260 (IRC 1(h), 1411; RULES.md 9.6)", () => {
  const d = compute(keyHome(180000, { purchasePrice: 380000, purchaseDate: "2004-06-15", improvements: 48000 }, 1200000, { balance: 150000, rate: 0.04, payment: 1600 }), { today: "2026-11-16" });
  near(d.sale.gain, 700000); assert.equal(d.sale.test.meets, true); near(d.sale.taxable, 450000);
  near(d.sale.incomeTax, 70920); near(d.sale.niit, 16340); near(d.sale.tax, 87260); near(d.sale.net, 890740);
});
