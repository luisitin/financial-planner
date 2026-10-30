import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, principalWithin, PENALTY, SELL_HOME } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("principalWithin: twelve payments' worth of principal; a card-like payment that only covers interest pays none", () => {
  near(principalWithin(1200, 0, 100), 1200);
  near(principalWithin(12000, 0.12, 100), 0);
  const b = 10000, r = 0.06, pay = 500;
  let x = b; for (let m = 0; m < 12; m++) x = x * (1 + r / 12) - pay;
  near(principalWithin(b, r, pay), b - x);
  assert.equal(principalWithin(5000, 0.1, 0), 0);
});

test("no accounts: nothing to show", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family: four tiers, most liquid first, adding up to what they own", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.deepEqual(d.tiers.map((t) => [t.id, t.total]), [["now", 15700], ["days", 18000], ["later", 159000], ["months", 380000]]);
  assert.equal(d.assets, 572700); assert.equal(d.liabilities, 285600); assert.equal(d.netWorth, 287100);
  assert.deepEqual(d.owners, ["Ana", "Bo", "Joint"]);
});

test("cashed in: pre-tax accounts lose tax and the early penalty, a home its selling costs", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.taxRate, 0.22, "Texas: the federal 22% alone");
  const later = d.tiers.find((t) => t.id === "later").accounts;
  near(later.find((a) => a.name === "Ana's 401(k)").cashIn, 86000 * (1 - 0.22 - PENALTY));
  near(later.find((a) => a.name === "Bo's Roth IRA").cashIn, 31000);
  near(d.tiers.find((t) => t.id === "months").accounts[0].cashIn, 380000 * (1 - SELL_HOME));
  near(d.netWorthCashed, d.cashIn - d.liabilities);
});

test("the penalty stops at 59½, to the month", () => {
  const p = familyPlan(TODAY);
  p.household.people[0].birthDate = "1967-04-30";   // 59½ on 2026-10-30
  const at = compute(p, { today: TODAY }).tiers.find((t) => t.id === "later").accounts.find((a) => a.name === "Ana's 401(k)");
  near(at.cashIn, 86000 * (1 - 0.22));
  const before = compute(p, { today: "2026-10-29" }).tiers.find((t) => t.id === "later").accounts.find((a) => a.name === "Ana's 401(k)");
  near(before.cashIn, 86000 * (1 - 0.22 - PENALTY));
});

test("a state's income tax adds to the rate on pre-tax money", () => {
  const p = familyPlan(TODAY); p.household.state = "PA";
  const d = compute(p, { today: TODAY });
  near(d.taxRate, 0.22 + 0.0307, 1e-9);
});

test("what you owe: a card is all due now, a loan the next year's principal", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  const visa = d.debts.find((x) => x.name === "Visa card"), car = d.debts.find((x) => x.name === "Car loan");
  assert.equal(visa.dueSoon, 6400); assert.equal(visa.dueLater, 0);
  assert.ok(car.dueSoon > 0 && car.dueSoon < car.owed); near(car.dueSoon + car.dueLater, car.owed);
  near(d.dueSoon + d.dueLater, d.liabilities);
});

test("by owner and the ratios", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.deepEqual(d.byOwner.map((o) => [o.name, o.netWorth]), [["Ana", 86000], ["Bo", 73000], ["Joint", 128100]]);
  near(d.byOwner.reduce((s, o) => s + o.netWorth, 0), d.netWorth);
  const r = d.ratios;
  near(r.monthsOfCash, 15700 / r.monthlySpending);
  near(r.quick, (15700 + 18000) / d.dueSoon);
  near(r.debtToAssets, 285600 / 572700);
  near(r.investedShare, (18000 + 86000 + 42000 + 31000) / 287100);
});
