import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("empty plan: nothing to show, status unknown", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.accounts.length, 0); assert.equal(d.now, 0); assert.equal(d.status, "unknown"); assert.equal(d.expenses, null);
});
test("tiers: cash now, brokerage within a week, retirement later; liabilities ignored", () => {
  const p = emptyPlan();
  p.accounts.push(
    { id: "1", name: "Checking", type: "checking", balance: 3000 },
    { id: "2", name: "Savings", type: "savings", balance: 9000 },
    { id: "3", name: "Brokerage", type: "brokerage", balance: 20000 },
    { id: "4", name: "401k", type: "401k", balance: 100000 },
    { id: "5", name: "Visa", type: "credit", balance: 2000 },
    { id: "6", name: "Wallet", type: "cash", balance: -50 },
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.now, 11950, "signed: a negative wallet lowers usable cash; liabilities excluded");
  assert.equal(d.week, 20000);
  assert.equal(d.later, 100000);
  assert.equal(d.accounts.length, 5);
  assert.equal(d.accounts[0].name, "401k", "largest first");
  assert.ok(d.warnings.some((w) => w.includes("Add your expenses")));
});
test("runway and the emergency-fund target use must-pay expenses and the months assumption", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "1", name: "Savings", type: "savings", balance: 9000 });
  p.expenses.push({ id: "e1", name: "Rent", category: "housing", amount: 2000, period: "monthly" }, { id: "e2", name: "Fun", category: "fun", amount: 1000, period: "monthly" });
  let d = compute(p, { today: TODAY });
  assert.equal(d.expenses.essentialMonthly, 2000);
  near(d.runwayMonths, 4.5);
  near(d.fullRunwayMonths, 3);
  assert.equal(d.targetMonths, 6);
  assert.equal(d.target, 12000);
  assert.equal(d.gap, 3000);
  near(d.fundedShare, 0.75);
  assert.equal(d.status, "warn");
  p.assumptions.emergencyMonths = 3;
  d = compute(p, { today: TODAY });
  assert.equal(d.target, 6000); assert.equal(d.gap, 0); assert.equal(d.status, "ok"); assert.equal(d.fundedShare, 1);
  p.accounts[0].balance = 2000;
  d = compute(p, { today: TODAY });
  assert.equal(d.status, "bad");
});
test("no must-pay expenses: target zero, a warning explains", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "1", name: "Savings", type: "savings", balance: 9000 });
  p.expenses.push({ id: "e", name: "Fun", category: "fun", amount: 1000, period: "monthly" });
  const d = compute(p, { today: TODAY });
  assert.equal(d.target, 0); assert.equal(d.runwayMonths, null); assert.equal(d.status, "unknown");
  assert.ok(d.warnings.some((w) => w.includes("must-pay")));
});
