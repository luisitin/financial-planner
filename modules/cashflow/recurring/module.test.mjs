import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, detectRecurring, nextAfter, addDays } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const tx = (id, date, amount, payee, accountId = "chk", category = "") => ({ id, date, amount, payee, rawPayee: payee.toUpperCase(), accountId, category });
export function recurringPlan() {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 4000 });
  p.transactions.push(
    tx("n1", "2026-06-05", -15.49, "Netflix", "chk", "subscriptions"), tx("n2", "2026-07-05", -15.49, "Netflix", "chk", "subscriptions"), tx("n3", "2026-08-05", -15.49, "Netflix", "chk", "subscriptions"), tx("n4", "2026-09-05", -15.49, "Netflix", "chk", "subscriptions"),
    tx("p1", "2026-07-03", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p2", "2026-07-17", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p3", "2026-07-31", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p4", "2026-08-14", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p5", "2026-08-28", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p6", "2026-09-11", 1950, "Acme Corp Payroll", "chk", "income-salary"),
    tx("k1", "2026-08-02", -86.40, "Kroger", "chk", "groceries"), tx("k2", "2026-08-05", -12.10, "Kroger", "chk", "groceries"), tx("k3", "2026-08-19", -140.00, "Kroger", "chk", "groceries"), tx("k4", "2026-09-01", -54.12, "Kroger", "chk", "groceries"),
    tx("i1", "2025-09-10", -540, "Allstate Insurance", "chk", "insurance"), tx("i2", "2026-09-10", -540, "Allstate Insurance", "chk", "insurance"),
    tx("g1", "2026-05-20", -49, "Gym Membership", "chk", "fun"), tx("g2", "2026-06-20", -49, "Gym Membership", "chk", "fun"), tx("g3", "2026-07-20", -49, "Gym Membership", "chk", "fun"),
    tx("x1", "2026-09-06", -500, "Online Transfer To Sav", "chk", "transfer", ), tx("x2", "2026-08-06", -500, "Online Transfer To Sav", "chk", "transfer"), tx("x3", "2026-07-06", -500, "Online Transfer To Sav", "chk", "transfer"),
  );
  p.expenses.push({ id: "e1", name: "Rent", category: "housing", amount: 1500, period: "monthly" });
  p.income.push({ id: "in1", name: "Pay", type: "salary", amount: 1950, period: "biweekly" });
  return p;
}

test("date helpers", () => {
  assert.equal(addDays("2026-01-30", 3), "2026-02-02");
  assert.equal(nextAfter("2026-09-05", "monthly", "2026-09-15"), "2026-10-05");
  assert.equal(nextAfter("2026-09-11", "biweekly", "2026-09-15"), "2026-09-25");
  assert.equal(nextAfter("2026-09-10", "annual", "2026-09-15"), "2027-09-10");
  assert.equal(nextAfter("2026-09-30", "monthly", "2026-10-15"), "2026-10-30");
});
test("finds monthly, biweekly and yearly items; not a grocery store; not transfers; flags the missed gym", () => {
  const p = recurringPlan();
  const d = compute(p, { today: TODAY });
  const by = (name) => d.detected.find((r) => r.payee === name);
  assert.equal(by("Netflix").cadence, "monthly"); assert.equal(by("Netflix").amount, -15.49); assert.equal(by("Netflix").next, "2026-10-05"); assert.equal(by("Netflix").missed, false); assert.equal(by("Netflix").count, 4);
  assert.equal(by("Acme Corp Payroll").cadence, "biweekly"); assert.equal(by("Acme Corp Payroll").amount, 1950); assert.equal(by("Acme Corp Payroll").next, "2026-09-25");
  assert.equal(by("Allstate Insurance").cadence, "annual", "two identical yearly lines are enough"); assert.equal(by("Allstate Insurance").next, "2027-09-10");
  assert.equal(by("Kroger"), undefined, "uneven amounts and gaps: a shop, not a bill");
  assert.equal(by("Online Transfer To Sav"), undefined, "transfers are not bills");
  const gym = by("Gym Membership");
  assert.equal(gym.missed, true); assert.equal(gym.next, "2026-08-20", "the expected date that never came");
  assert.equal(d.missed.length, 1);
  assert.ok(Math.abs(d.monthlyOut - (15.49 + 540 / 12 + 49)) < 0.01);
  assert.ok(Math.abs(d.monthlyIn - 1950 * 26 / 12) < 0.01);
  assert.equal(d.planned.length, 2); assert.equal(d.planned[0].amount, -1500); assert.equal(d.planned[1].kind, "income"); assert.equal(d.planned[0].state, "active");
  assert.deepEqual(d.dueSoon.map((r) => r.payee), ["Acme Corp Payroll"], "payroll on the 25th is within 14 days; Netflix on Oct 5 is 20 days out");
});
test("F-026: ended and not-yet-started typed items are flagged, not expected", () => {
  const p = recurringPlan();
  p.expenses.push({ id: "old", name: "Old mortgage", category: "housing", amount: 900, period: "monthly", endDate: "2024-06-30" }, { id: "soon", name: "New car", category: "transport", amount: 400, period: "monthly", startDate: "2027-01-01" });
  const d = compute(p, { today: TODAY });
  assert.equal(d.planned.find((x) => x.name === "Old mortgage").state, "ended");
  assert.equal(d.planned.find((x) => x.name === "New car").state, "upcoming");
  assert.equal(d.planned.filter((x) => x.state === "active").length, 2);
});
test("dismissed items stay out", () => {
  const p = recurringPlan();
  const all = detectRecurring(p.transactions, { today: TODAY, plan: p });
  p.recurringIgnored = [all.find((r) => r.payee === "Netflix").key];
  const d = compute(p, { today: TODAY });
  assert.equal(d.detected.find((r) => r.payee === "Netflix"), undefined); assert.equal(d.dismissed, 1);
});
test("empty plan", () => { const d = compute(emptyPlan(), { today: TODAY }); assert.deepEqual(d.detected, []); assert.equal(d.monthlyOut, 0); });
