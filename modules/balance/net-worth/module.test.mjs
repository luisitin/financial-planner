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

// C2 (smart guesses, spec 8.1): additive keys, present only when the plan holds guesses
test("partly our guesses: the guessed share of each side, keys only when a balance is a guess", async () => {
  const { markGuess } = await import("../../../core/estimate/index.js");
  const p = plan();
  const plain = compute(p);
  assert.equal("guessedAssets" in plain || "guessedLiabilities" in plain || "partlyGuessed" in plain, false, "no guesses: the result is as before");
  // the car loan ($3,000 of $3,500 owed, 86%) is our guess: liabilities rest on guesses
  markGuess(p, "accounts[6].balance", { key: "debt.car-loan.owed", value: -3000, unit: "total", sigma: 0.5, today: "2026-11-02" });
  const g = compute(p);
  assert.deepEqual([g.netWorth, g.guessedAssets, g.guessedLiabilities, g.partlyGuessed], [plain.netWorth, 0, 3000, true]);
  // a guessed asset under half of the assets, and a guessed liability under half: not "partly our guesses"
  const q = plan();
  markGuess(q, "accounts[4].balance", { key: "car.value", value: 8000, unit: "total", sigma: 0.3, today: "2026-11-02" });
  markGuess(q, "accounts[5].balance", { key: "debt.credit.owed", value: 500, unit: "total", sigma: 0.8, today: "2026-11-02" });
  const h = compute(q);
  assert.deepEqual([h.guessedAssets, h.guessedLiabilities, h.partlyGuessed], [8000, 500, false], "8,000 of 34,000 and 500 of 3,500");
  // exactly half counts: the guessed $500 card of $1,000 owed
  q.accounts.find((a) => a.id === "6").balance = -500;
  assert.equal(compute(q).partlyGuessed, true, "500 of 1,000 owed");
});
