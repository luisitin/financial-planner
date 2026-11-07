import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("an empty plan: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the balance sheet adds up, groups most liquid first, splits by owner", () => {
  const d = compute(familyPlan(), { today: TODAY });
  const b = d.balance;
  assert.deepEqual(b.groups.map((g) => g.id), ["cash", "investments", "retirement", "property"]);
  near(b.groups.reduce((s, g) => s + g.total, 0), b.assets);
  near(b.short.total + b.long.total, b.liabilities); near(b.assets - b.liabilities, b.netWorth);
  near(b.short.total, 6400);
  near(b.byOwner.reduce((s, o) => s + o.netWorth, 0), b.netWorth);
  assert.deepEqual(b.byOwner.map((o) => o.name), ["Ana", "Bo", "Joint"]);
});

test("the income and cash-flow statements close: income less tax, spending and saving is what is left", () => {
  const d = compute(familyPlan(), { today: TODAY });
  const i = d.income;
  near(i.total - i.federalTax - i.payrollTax - i.expensesTotal - i.retirementSaving - i.goalSaving, i.net, 0.5);
  near(i.lines.reduce((s, l) => s + l.yearly, 0), i.total, 0.5);
  const c = d.cashflow;
  near(c.fromLiving - c.saving, c.net, 0.5);
  near(c.debt.interest + c.debt.principal, c.debt.payments, 0.01);
  assert.equal(d.actual, null, "no transactions");
});

test("the bank files: complete months only", () => {
  const d = compute(samplePlan(), { today: TODAY });
  assert.equal(d.actual.months, 2); near(d.actual.in - d.actual.out, d.actual.net);
});

test("verify: net worth grows by the year's saving (core/math/leftover.js) plus the debt paid down: a saved debt plan's extra is counted once", async () => {
  const { renterDebtPlan, renterPayingExtraPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { compute: nextBest } = await import("../../overview/next-best-action/compute.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  let extra = 0;
  for (const mk of [renterDebtPlan, renterPayingExtraPlan, familyPlan]) {
    const p = migrate(mk()), s = nextBest(p, { today: TODAY }).spare, c = compute(p, { today: TODAY }).cashflow;
    if (s.debtExtra > 0) extra++;
    assert.ok(Math.abs(c.netWorthGrowth - (s.year.total + c.debt.principal)) < 0.01, `${mk.name}: ${c.netWorthGrowth} vs ${s.year.total + c.debt.principal}`);
  }
  assert.ok(extra > 0, "a plan with a saved debt plan's extra was checked");
});
