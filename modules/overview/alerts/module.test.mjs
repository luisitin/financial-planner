import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const ids = (d) => d.alerts.map((a) => a.id);

test("empty plan: the four setup alerts, all informational, then the assumptions as a chore; nothing to fix", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.deepEqual(ids(d), ["no-people", "no-accounts", "no-income", "no-expenses", "assumptions-unreviewed"]);
  assert.deepEqual(d.counts, { bad: 0, warn: 0, info: 4 }, "a chore is not counted");
  assert.equal(d.total, 4); assert.equal(d.chores, 1);
  assert.equal(d.alerts.at(-1).chore, true);
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

test("overspending is judged after tax and saving, like the Dashboard: pay above spending can still be short", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "me", name: "Ana", birthDate: "1990-01-01", role: "self" });
  p.household.filingStatus = "single";
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 6000, period: "monthly", personId: "me" });
  p.expenses.push({ id: "e", name: "Everything", category: "housing", amount: 5500, period: "monthly" });
  const d = compute(p, { today: TODAY });
  const o = d.alerts.find((a) => a.id === "overspend");
  assert.ok(o, "$6,000 before tax, $5,500 spent: short once tax is taken out");
  assert.match(o.detail, /after tax and saving/);
  const q = emptyPlan();
  q.household.people.push({ id: "me", name: "Ana", birthDate: "1990-01-01", role: "self" });
  q.household.filingStatus = "single";
  q.income.push({ id: "i", name: "Pay", type: "salary", amount: 6000, period: "monthly", personId: "me" });
  q.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  assert.ok(!compute(q, { today: TODAY }).alerts.some((a) => a.id === "overspend"), "room left after tax: no alert");
});
test("old balances open Update my balances", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 1000, asOf: "2026-01-01" });
  assert.deepEqual(compute(p, { today: TODAY }).alerts.find((a) => a.id === "stale-balances").go, ["balance", "update"]);
});

test("chores (assumptions, today's totals) come last and leave the count and all-clear alone", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: "2026-09-01" });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  const d = compute(p, { today: TODAY });
  assert.deepEqual(ids(d), ["assumptions-unreviewed", "history"]);
  assert.ok(d.alerts.every((a) => a.chore));
  assert.equal(d.total, 0); assert.equal(d.chores, 2); assert.equal(d.allClear, true, "nothing needs a look; two chores wait");
});
test("two or more goals behind are one alert with the extra they need in all; a goal with nothing going in is named first (F-015)", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: "2026-09-01" });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 9000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  p.goals.push({ id: "t", name: "Trip", target: 6000, targetDate: "2027-09-15", monthly: 100 }, { id: "c", name: "Car", target: 12000, targetDate: "2028-09-15" });
  const d = compute(p, { today: TODAY });
  const g = d.alerts.find((a) => a.id === "goals-behind");
  assert.ok(g, "one goals alert");
  assert.ok(!ids(d).some((x) => x.startsWith("goal-behind-")), "not one per goal");
  assert.equal(g.title, "2 goals are behind");
  assert.ok(g.detail.startsWith("Car and Trip need about"), g.detail);
  assert.ok(g.detail.includes("nothing is going in to Car yet"));
  assert.ok(/You have about \$[\d,]+ left over each month\./.test(g.detail), g.detail);
  p.goals.pop();
  assert.ok(ids(compute(p, { today: TODAY })).includes("goal-behind-t"), "a single goal keeps its own alert");
});
test("goalsBehind: the monthly need counts goals behind their pace, never a goal past its date; idle goals are named; no duplicate for a late goal", async () => {
  const { goalsBehind } = await import("./compute.js");
  const { compute: goals } = await import("../../goals/goals/compute.js");
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: "2026-09-01" });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 9000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  p.goals.push({ id: "t", name: "Trip", target: 6000, targetDate: "2027-09-15" }, { id: "c", name: "Car", target: 12000, targetDate: "2028-09-15" },
    { id: "s2", name: "Sofa", target: 3000, targetDate: "2026-09-01", saved: 500, monthly: 100 });
  const gl = goals(p, { today: TODAY });
  const gb = goalsBehind(gl);
  assert.deepEqual(gb.behind.map((g) => g.id).sort(), ["c", "t"]);
  assert.deepEqual(gb.pastDue.map((g) => g.id), ["s2"]);
  const want = gl.goals.filter((g) => g.status === "behind").reduce((t, g) => t + g.neededMonthly - (g.monthly || 0), 0);
  assert.ok(Math.abs(gb.need - want) < 0.01, "the Sofa's $2,500 to go is not added as a month");
  const d = compute(p, { today: TODAY });
  const g = d.alerts.find((a) => a.id === "goals-behind");
  assert.ok(g.detail.includes("nothing is going in to either of them yet"), g.detail);
  assert.ok(ids(d).includes("goal-late-s2"));
  assert.ok(!d.alerts.some((a) => a.id.startsWith("goals-") && a.id !== "goals-behind" && /Sofa/.test(a.detail)), "the late goal is said once");
});
