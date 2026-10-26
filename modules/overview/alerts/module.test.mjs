import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const ids = (d) => d.alerts.map((a) => a.id);

test("empty plan: the five setup alerts, all informational, nothing to fix", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.deepEqual(ids(d), ["no-people", "no-accounts", "no-income", "no-expenses", "assumptions-unreviewed"]);
  assert.deepEqual(d.counts, { bad: 0, warn: 0, info: 5 });
  assert.equal(d.allClear, false);
});
test("a complete, healthy plan is all clear", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: "2026-09-01" });
  p.netWorthHistory.push({ date: "2026-09-01", assets: 20000, liabilities: 0, netWorth: 20000 });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  p.assumptions.reviewedAt = "2026-09-01";
  const d = compute(p, { today: TODAY });
  assert.deepEqual(ids(d), []);
  assert.equal(d.allClear, true);
});
test("problems are ranked worst first and link to their pages", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 1000, asOf: "2026-01-01" }, { id: "c", name: "Visa", type: "credit", balance: 5000, asOf: "2026-09-01" });
  p.debts.push({ id: "d", accountId: "c", rate: 0.25, minPayment: 50 });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 3000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 3500, period: "monthly" });
  p.goals.push({ id: "g", name: "Trip", target: 2000, targetDate: "2026-01-01" });
  p.assumptions.reviewedAt = "2024-01-01";
  const d = compute(p, { today: TODAY });
  const levels = d.alerts.map((a) => a.level);
  assert.deepEqual([...levels].sort((x, y) => ({ bad: 0, warn: 1, info: 2 })[x] - ({ bad: 0, warn: 1, info: 2 })[y]), levels, "sorted worst first");
  assert.ok(ids(d).includes("overspend"));
  assert.ok(ids(d).includes("emergency-bad"));
  assert.ok(ids(d).includes("debt-never-c"));
  assert.ok(ids(d).includes("stale-balances"));
  assert.ok(ids(d).includes("history"));
  assert.ok(ids(d).includes("goal-late-g"));
  assert.ok(ids(d).includes("assumptions-stale"));
  assert.equal(d.counts.bad, 3);
  assert.deepEqual(d.alerts.find((a) => a.id === "overspend").go, ["cashflow", "expenses"]);
  assert.deepEqual(d.alerts.find((a) => a.id === "debt-never-c").go, ["balance", "liabilities"]);
});
test("expensive debt and a behind goal are check/to-do, not fix; missing debt detail is a to-do", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Visa", type: "credit", balance: 5000, asOf: TODAY }, { id: "l", name: "Car loan", type: "loan", balance: 9000, asOf: TODAY });
  p.debts.push({ id: "d", accountId: "c", rate: 0.25, minPayment: 300 });
  p.goals.push({ id: "g", name: "House", target: 50000, targetDate: "2030-01-01", monthly: 100 });
  const d = compute(p, { today: TODAY });
  assert.equal(d.alerts.find((a) => a.id === "debt-expensive-c").level, "warn");
  assert.equal(d.alerts.find((a) => a.id === "goal-behind-g").level, "info");
  assert.equal(d.alerts.find((a) => a.id === "debt-details").level, "info");
  assert.equal(d.counts.bad, 0);
});
test("without today, date checks are skipped", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 100 });
  const d = compute(p);
  assert.ok(!ids(d).includes("stale-balances") && !ids(d).includes("history"));
});
