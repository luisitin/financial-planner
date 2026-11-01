import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan: no data, planned figures still offered when entered", () => {
  let d = compute(emptyPlan(), { today: "2026-09-15" });
  assert.equal(d.hasData, false); assert.equal(d.planned, null);
  const p = emptyPlan();
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 4000, period: "monthly" });
  d = compute(p, { today: "2026-09-15" });
  assert.equal(d.planned.in, 4000); assert.equal(d.planned.out, 0);
});
test("months from transactions: transfers out, income by category kind, uncategorised money in counts as income", () => {
  const p = samplePlan();
  const d = compute(p, { today: "2026-09-15" });
  assert.deepEqual(d.rows.map((r) => r.ym), ["2026-09", "2026-08"]);
  const sep = d.rows[0], aug = d.rows[1];
  near(sep.in, 1950 + 1950 + 640.22, "payroll twice plus the card payment received (uncategorised money in)");
  near(sep.out, 1500 + 86.40 + 54.12 + 15.49 + 640.22 + 42.17 + 42.17);
  assert.equal(sep.complete, false, "September is the current month"); assert.equal(aug.complete, true);
  assert.equal(sep.uncategorised, 4);
  near(aug.in, 1950); near(aug.out, 1608); near(aug.net, 342); near(aug.rate, 342 / 1950);
  near(d.totals.in, sep.in + aug.in);
  assert.equal(d.average.months, 1); near(d.average.net, 342);
  assert.equal(d.byCategory.out[0].category, "housing"); near(d.byCategory.out[0].total, 3000);
  assert.equal(d.byCategory.in[0].category, "income-salary"); near(d.byCategory.in[0].total, 5850);
  assert.equal(compute(p, { months: 1 }).rows.length, 1);
});
test("plan versus real compares the bank's money in with take-home pay, and calls it short only beyond 10%", async () => {
  const { takeHome } = await import("../paycheck/compute.js");
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1988-05-01" });
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 5000 });
  p.income.push({ id: "ia", name: "Ana's salary", type: "salary", personId: "a", amount: 6000, period: "monthly", taxable: true });
  const net = takeHome(p, { today: "2026-11-01" }).monthly;
  assert.ok(net < 6000 * 0.9, `take-home is well below pay before tax: ${net}`);
  // the bank shows exactly the take-home in each of three full months: nothing is short
  const months = ["2026-08", "2026-09", "2026-10"];
  months.forEach((m, k) => p.transactions.push({ id: `t${k}`, date: `${m}-15`, amount: Math.round(net * 100) / 100, payee: "Acme payroll", accountId: "c", category: "income-salary" }));
  let d = compute(p, { today: "2026-11-01" });
  near(d.planned.in, 6000); near(d.planned.takeHomeIn, net); assert.equal(d.planned.takeHome, true);
  assert.ok(Math.abs(d.inGap) < 0.01); assert.equal(d.inShort, false, "matching take-home is not a red gap");
  // 8% below: two paychecks in a month of pay every two weeks, not a gap
  p.transactions.forEach((t) => { t.amount = Math.round(net * 0.92 * 100) / 100; });
  assert.equal(compute(p, { today: "2026-11-01" }).inShort, false);
  // 20% below take-home: worth a look
  p.transactions.forEach((t) => { t.amount = Math.round(net * 0.8 * 100) / 100; });
  d = compute(p, { today: "2026-11-01" });
  assert.equal(d.inShort, true); near(d.inGap, Math.round(net * 0.8 * 100) / 100 - net);
});
