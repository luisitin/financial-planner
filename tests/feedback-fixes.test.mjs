// tests/feedback-fixes.test.mjs -- one test per tester finding fixed in the computes
// (docs/FEEDBACK.md F-009, 013, 014, 015, 017, 018, 019, 020, 021, 022), so none comes back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { roundShares } from "../core/math/shares.js";
import { compute as expenses } from "../modules/cashflow/expenses/compute.js";
import { compute as goals } from "../modules/goals/goals/compute.js";
import { compute as liquidity } from "../modules/balance/liquidity/compute.js";
import { compute as alerts } from "../modules/overview/alerts/compute.js";
import { compute as netWorth } from "../modules/balance/net-worth/compute.js";
import { emptyPlan } from "../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("F-009: shown percentages add up to 100", () => {
  assert.deepEqual(roundShares([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(roundShares([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]).reduce((s, x) => s + x, 0), 100);
  assert.deepEqual(roundShares([0, 0]), [0, 0]);
  assert.deepEqual(roundShares([100, 0]), [100, 0]);
  const p = emptyPlan();
  for (let i = 0; i < 12; i++) p.expenses.push({ id: `e${i}`, name: `x${i}`, category: ["housing", "groceries", "fun", "pets", "travel", "dining", "utilities", "phone", "health", "giving", "shopping", "personal"][i], amount: 100 + 7 * i, period: "monthly" });
  const d = expenses(p, { today: TODAY });
  assert.equal(d.byCategory.reduce((s, c) => s + c.percent, 0), 100);
});
test("F-013: an account linked to two goals is shared, never counted twice", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "j", name: "Joint savings", type: "savings", balance: 45000 });
  p.goals.push({ id: "a", name: "Goal A", target: 30000, priority: 1, fundedBy: ["j"] }, { id: "b", name: "Goal B", target: 30000, priority: 2, fundedBy: ["j"] });
  const d = goals(p, { today: TODAY });
  assert.equal(d.goals[0].funded, 30000); assert.equal(d.goals[0].status, "done");
  assert.equal(d.goals[1].funded, 15000); assert.equal(d.goals[1].status, "no date");
  assert.equal(d.totalFunded, 45000); assert.equal(d.done, 1);
  assert.deepEqual(d.goals[0].sharedWith, ["Goal B"]);
});
test("F-014: a negative or zero goal amount is left out of the totals and never reached", () => {
  const p = emptyPlan();
  p.goals.push({ id: "n", name: "Oops", target: -500, saved: 100 }, { id: "ok", name: "Fine", target: 1000, saved: 100 });
  const d = goals(p, { today: TODAY });
  assert.equal(d.goals[0].status, "no amount"); assert.equal(d.done, 0);
  assert.equal(d.totalTarget, 1000); assert.equal(d.totalFunded, 100);
  assert.ok(d.warnings.some((w) => w.includes("negative")));
});
test("F-015 and F-022: a behind goal with nothing going in, goal warnings, and a retirement within a year show up", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "s", name: "Sam", role: "self", birthDate: "1957-06-01", retirementAge: 70 });
  p.goals.push({ id: "g", name: "Silent goal", target: 20000, targetDate: "2028-09-15", saved: 0, monthly: 0 }, { id: "h", name: "Roof fund", target: 100, fundedBy: ["gone"] });
  const d = alerts(p, { today: TODAY });
  const ids = d.alerts.map((a) => a.id);
  assert.ok(ids.includes("goal-behind-g"));
  assert.ok(d.alerts.find((a) => a.id === "goal-behind-g").detail.includes("nothing is going in"));
  assert.ok(ids.some((i) => i.startsWith("goals-")), "goal warnings are listed");
  assert.ok(ids.includes("retiring-s"));
  assert.deepEqual(d.alerts.find((a) => a.id === "retiring-s").go, ["cashflow", "income"]);
});
test("F-017 and F-020: one-time costs and money set aside for goals leave the usable cash", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "j", name: "Joint savings", type: "savings", balance: 45000 }, { id: "c", name: "Checking", type: "checking", balance: 8000 });
  p.expenses.push({ id: "r", name: "Rent", category: "housing", amount: 2030, period: "monthly" }, { id: "roof", name: "Roof repair", category: "housing", amount: 8000, period: "once" });
  p.goals.push({ id: "g", name: "Trip", target: 12000, fundedBy: ["j"] });
  const d = liquidity(p, { today: TODAY });
  assert.equal(d.nowAll, 53000); assert.equal(d.earmarked, 12000); assert.equal(d.now, 41000);
  assert.equal(d.oneOffs, 8000); assert.equal(d.nowAfterOneOffs, 33000);
  near(d.runwayMonths, 41000 / 2030); near(d.runwayAfterOneOffs, 33000 / 2030);
});
test("F-018 and F-019: next year's spending, and debt payments from the Debts page counted once", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "v", name: "Visa", type: "credit", balance: 3000 });
  p.debts.push({ id: "d", accountId: "v", rate: 0.2, minPayment: 75, extra: 0 });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly", growth: 0.03 });
  p.expenses.push({ id: "r", name: "Rent", category: "housing", amount: 2000, period: "monthly", inflates: true }, { id: "n", name: "Netflix", category: "subscriptions", amount: 15, period: "monthly", inflates: false });
  let d = expenses(p, { today: TODAY });
  assert.equal(d.debtFromDebts, 75); assert.equal(d.monthly, 2090); assert.equal(d.essentialMonthly, 2075);
  assert.ok(d.byCategory.some((c) => c.category === "debt" && c.virtual));
  near(d.nextYear, 2000 * 12 * 1.03 + 15 * 12 + 75 * 12);
  near(d.leftOverNextYear, 5000 * 12 * 1.03 - d.nextYear);
  assert.deepEqual(d.warnings, []);
  p.expenses.push({ id: "card", name: "Visa payment", category: "debt", amount: 200, period: "monthly" });
  d = expenses(p, { today: TODAY });
  assert.equal(d.debtFromDebts, 0, "a filed debt expense wins");
  assert.ok(d.warnings.some((w) => w.includes("differ from the Debts page")));
});
test("F-021: the change since last time compares with the last point before today", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 1072700 });
  p.netWorthHistory.push({ date: "2026-06-01", assets: 995000, liabilities: 0, netWorth: 995000 }, { date: TODAY, assets: 1072700, liabilities: 0, netWorth: 1072700 });
  const d = netWorth(p, { today: TODAY });
  assert.equal(d.change.sinceLast, 77700); assert.equal(d.change.since, "2026-06-01");
});
