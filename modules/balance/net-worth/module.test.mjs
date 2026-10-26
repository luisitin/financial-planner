import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

function plan() {
  const p = emptyPlan();
  p.accounts.push(
    { id: "1", name: "Checking", type: "checking", balance: 1000 },
    { id: "2", name: "401k", type: "401k", balance: 20000 },
    { id: "3", name: "Roth", type: "roth", balance: 5000 },
    { id: "4", name: "Car", type: "vehicle", balance: 8000 },
    { id: "5", name: "Visa", type: "credit", balance: 500 },
    { id: "6", name: "Car loan", type: "loan", balance: -3000 },   // sign is ignored for debts
  );
  return p;
}
test("net worth totals", () => {
  const d = compute(plan());
  assert.equal(d.assets, 34000);
  assert.equal(d.liabilities, 3500);
  assert.equal(d.netWorth, 30500);
  assert.equal(d.liquid, 1000);
  assert.equal(d.cash, 1000);
  assert.equal(d.investable, 25000, "checking is not invested (F-003)");
  assert.deepEqual(d.byTaxBucket, { taxable: 0, deferred: 20000, free: 5000, none: 9000 });
  assert.equal(d.count, 6);
});
test("an overdrawn checking account lowers what you own instead of adding to it (F-001)", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "1", name: "Checking", type: "checking", balance: -500 }, { id: "2", name: "Savings", type: "savings", balance: 2000 }, { id: "3", name: "Brokerage", type: "brokerage", balance: 1000 });
  const d = compute(p);
  assert.equal(d.assets, 2500);
  assert.equal(d.netWorth, 2500);
  assert.equal(d.liquid, 2500);
  assert.equal(d.cash, 1500);
  assert.equal(d.investable, 1000);
  assert.deepEqual(d.byTaxBucket, { taxable: 1000, deferred: 0, free: 0, none: 1500 }, "cash is not invested, so it sits in none");
});
test("change vs last snapshot", () => {
  const p = plan();
  p.netWorthHistory.push({ date: "2026-01-01", assets: 30000, liabilities: 4000, netWorth: 26000 });
  const d = compute(p);
  assert.equal(d.change.sinceLast, 4500);
  assert.ok(Math.abs(d.change.sinceLastPct - 4500 / 26000) < 1e-9);
});
test("empty plan", () => {
  const d = compute(emptyPlan());
  assert.equal(d.netWorth, 0);
  assert.equal(d.change, null);
});
