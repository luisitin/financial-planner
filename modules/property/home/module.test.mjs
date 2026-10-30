import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, growthRate, DEFAULTS, EXCLUSION } from "./compute.js";
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
  assert.ok(big.sale.rate >= 0.15); near(big.sale.tax, big.sale.taxable * big.sale.rate);
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
