import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, monthlyCost, priceFor, priceForCash, solveMonths, DEFAULTS, FRONT, BACK, isHouseGoal, houseGoalRank, findHouseGoal } from "./compute.js";
import { pmt, pmtToReach } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withHouse = (h, goals) => { const p = familyPlan(TODAY); p.whatIfs = { house: h }; if (goals) p.goals = goals; return p; };

test("the monthly cost and the price a budget buys are inverses", () => {
  const x = { ...DEFAULTS };
  near(monthlyCost(400000, x), pmt(0.065 / 12, 360, 320000) + 400000 * (0.011 + 0.0035) / 12);
  near(monthlyCost(priceFor(3000, x), x), 3000, 1e-6);
  near(monthlyCost(priceFor(3000, { ...x, hoaMonthly: 200 }), { ...x, hoaMonthly: 200 }), 3000, 1e-6);
});

test("months to save: deposits plus growth, none needed when already there, never without saving", () => {
  assert.equal(solveMonths(0, 0, 100, 1000), 10); assert.equal(solveMonths(0.01, 5000, 0, 1000), 0); assert.equal(solveMonths(0, 0, 0, 1000), Infinity);
});

test("the family: the lenders' limits on their income and other debts, the cash needed, the monthly to buy by a date", () => {
  const d = compute(withHouse({ price: 450000, targetDate: "2029-06-01" }), { today: TODAY });
  assert.equal(d.grossMonthly, 14250); near(d.maxFront, 14250 * FRONT);
  assert.equal(d.otherDebtMonthly, 400 + 410, "the card and the car, not the mortgage");
  near(d.maxBack, 14250 * BACK - 810); assert.equal(d.rule, "front");
  near(monthlyCost(d.maxPrice, d.inputs), d.maxFront, 1e-6);
  near(d.cash.down, 90000); near(d.cash.closing, 13500); near(d.cash.reserves, d.monthly * 2);
  near(d.neededMonthly, pmtToReach(0.02 / 12, 31, d.cash.total, 0), 1e-6);
  assert.equal(d.monthsToGo, null);
});

test("the house goal is a down payment or a home, never work on a home you have (Make it a goal must not overwrite it)", () => {
  for (const n of ["House down payment", "Down-payment fund", "New home fund", "Saving for a house", "Home", "Down payment", "Townhouse fund", "Townhome savings", "Homebuying fund", "Homeownership fund", "Farmhouse", "Condo fund", "Buy a house"]) assert.equal(isHouseGoal({ name: n }), true, n);
  for (const n of ["Home repairs", "Home-repairs", "Repairs on the house", "Home office", "Homeschool", "Home insurance", "House renovation", "Home remodel", "Paint the house", "Pay off the house early", "Mortgage-free home", "Trip home for Christmas", "Home for the holidays", "Home gym", "Beach house rental", "Housewarming party", "Warehouse", "Greenhouse", "Homecoming", "Car down payment", "Car", ""]) assert.equal(isHouseGoal({ name: n }), false, n);
  assert.equal(isHouseGoal({ name: "Nest", icon: "🏠" }), true, "the icon Make it a goal uses");
  assert.equal(isHouseGoal({ name: "Home repairs", icon: "🏠" }), false, "the icon does not rescue a repairs goal");
  const d = compute(withHouse({ price: 400000 }, [{ id: "r", name: "Home repairs", target: 5000, targetDate: "2027-01-01", saved: 1000, monthly: 100, priority: 2, fundedBy: [] }]), { today: TODAY });
  assert.equal(d.goal, null, "a repairs goal is not offered for update");
});
test("with several house goals the clearest wins: a down payment, then the icon or buying, then a name", () => {
  assert.deepEqual(["House down payment", "Homebuying fund", "Our home", "Pay off the house"].map((name) => houseGoalRank({ name })), [3, 2, 1, 0]);
  assert.equal(findHouseGoal([{ name: "Our home" }, { name: "House down payment" }]).name, "House down payment");
  assert.equal(findHouseGoal([{ name: "Our home" }, { name: "Townhouse fund" }]).name, "Our home", "the first of equals");
  assert.equal(findHouseGoal([{ name: "Home remodel" }, { name: "Car" }]), null);
  const g = (id, name, saved) => ({ id, name, target: 100000, targetDate: "2030-01-01", saved, monthly: 100, priority: 2, fundedBy: [] });
  const d = compute(withHouse({ price: 400000 }, [g("a", "Home remodel", 2000), g("b", "Our home", 9000), g("c", "House down payment", 30000)]), { today: TODAY });
  assert.equal(d.goal.id, "c", "the down payment, not the remodel listed first");
});
test("a house goal on Goals supplies what is set aside and saved; entered figures win; warnings", () => {
  const goals = [{ id: "g", name: "New home fund", target: 100000, targetDate: "2030-01-01", saved: 20000, monthly: 2000, priority: 2, fundedBy: [] }];
  const d = compute(withHouse({ price: 400000 }, goals), { today: TODAY });
  assert.equal(d.goal.id, "g"); assert.equal(d.saved, 20000); assert.equal(d.monthlySaving, 2000); assert.equal(d.target, "2030-01-01");
  assert.equal(d.monthsToGo, solveMonths(0.02 / 12, 20000, 2000, d.cash.total));
  assert.ok(/^\d{4}-\d{2}$/.test(d.readyDate));
  const e = compute(withHouse({ price: 400000, saved: 200000 }, goals), { today: TODAY });
  assert.equal(e.monthsToGo, 0);
  const w = compute(withHouse({ price: 2000000, downShare: 0.1 }), { today: TODAY });
  assert.equal(w.warnings.length, 2);
  assert.equal(compute(emptyPlan(), { today: TODAY }).maxPrice, null);
});
test("priceForCash: the price whose down payment, closing costs and reserves add up to the cash", () => {
  const x = { ...DEFAULTS, hoaMonthly: 150 };
  const price = priceForCash(60000, x);
  const cash = price * x.downShare + price * x.closingShare + monthlyCost(price, x) * x.reserveMonths;
  assert.ok(Math.abs(cash - 60000) < 0.01, `${cash}`);
  assert.equal(priceForCash(0, { ...DEFAULTS }), 0);
});
test("never saved here, with a house goal: the page opens on the home the goal buys, and quotes the Goals page's monthly figure", async () => {
  const { compute: goals } = await import("../goals/compute.js");
  const p = familyPlan(TODAY);
  p.goals.push({ id: "gh", name: "House down payment", icon: "🏠", target: 50000, targetDate: "2029-11-01", saved: 0, monthly: 0, fundedBy: [], priority: 2 });
  delete p.whatIfs?.house;
  const d = compute(p, { today: TODAY });
  assert.equal(d.fromGoal, true); assert.equal(d.goalTarget, 50000);
  assert.equal(d.inputs.price, Math.round(priceForCash(50000, d.inputs) / 1000) * 1000);
  assert.ok(Math.abs(d.cash.total - 50000) < 500, "about the goal's amount (the price is rounded to $1,000)");
  assert.equal(d.neededMonthly, goals(p, { today: TODAY }).goals.find((g) => g.id === "gh").neededMonthly);
  p.whatIfs = { ...(p.whatIfs ?? {}), house: { price: 300000 } };
  const own = compute(p, { today: TODAY });
  assert.equal(own.fromGoal, false); assert.equal(own.inputs.price, 300000, "the person's own figures win once saved");
});
test("a house goal with no date: no monthly figure (not $0 a month)", () => {
  const p = familyPlan(TODAY);
  p.goals.push({ id: "gh", name: "House down payment", icon: "🏠", target: 50000, targetDate: "", saved: 0, monthly: 0, fundedBy: [], priority: 2 });
  delete p.whatIfs?.house;
  const d = compute(p, { today: TODAY });
  assert.equal(d.fromGoal, true);
  assert.equal(d.neededMonthly, null);
});
