import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, FICA, HIGH_RATE } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const step = (d, id) => d.steps.find((s) => s.id === id);
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("no income or expenses: says what is missing", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.missing.length, 2);
});

test("the spare money: pay less federal and payroll tax, spending, retirement and goal saving", () => {
  const d = compute(familyPlan(), { today: TODAY });
  near(d.spare.gross, (3900 * 26 + 5200 * 12 + 600 * 12) / 12, 0.01);
  const payroll = (3900 * 26) * (FICA.ss + FICA.medicare) + (5200 * 12) * (FICA.ss + FICA.medicare) + 600 * 12 * FICA.seBase * FICA.selfEmployed;
  near(d.spare.payrollTax, payroll / 12, 0.01);
  near(d.spare.retirementSaving, (470 * 26 + 300 * 12) / 12, 0.01);   // the employer's match is not from pay
  near(d.spare.goalSaving, 400 + 300 + 250, 0.01);
  near(d.spare.monthly, d.spare.gross - d.spare.federalTax - d.spare.payrollTax - d.spare.spending - d.spare.retirementSaving - d.spare.goalSaving, 0.01);
  assert.ok(d.spare.monthly > 3000 && d.spare.monthly < 5000, String(d.spare.monthly));
});

test("the order for the family, the next step, and the dates the spare money reaches", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.deepEqual(d.steps.map((s) => s.id), ["bills", "starter", "match", "high-debt", "full-fund", "ira", "mid-debt", "max-401k", "goals", "rest"]);
  assert.equal(d.next.id, "starter");
  assert.equal(step(d, "bills").status, "done");
  assert.equal(step(d, "match").status, "check", "Bo has a 401(k) and pay but no contribution");
  near(step(d, "high-debt").gap, 6400); assert.ok(step(d, "high-debt").detail.includes("23.9%"));
  assert.ok(step(d, "mid-debt").detail.includes("Car loan"), "5.9% is middling"); assert.equal(step(d, "mid-debt").detail.includes("Mortgage"), false);
  // the gaps fill in order: starter, then the card, then the full fund
  assert.ok(step(d, "starter").doneDate <= step(d, "high-debt").doneDate && step(d, "high-debt").doneDate <= step(d, "full-fund").doneDate);
  near(step(d, "ira").roomYearly, 7500 + (7500 - 3600));
  near(step(d, "max-401k").roomYearly, 24500 - 470 * 26, 1);   // the match does not use the employee's limit
  assert.ok(step(d, "ira").startDate >= step(d, "full-fund").doneDate.slice(0, 7) || step(d, "ira").startDate <= step(d, "full-fund").doneDate);
});

test("spending more than comes in makes the bills the next step and stops the dates", () => {
  const p = familyPlan(); p.expenses.push({ id: "big", name: "Boat", category: "fun", amount: 9000, period: "monthly", essential: false });
  const d = compute(p, { today: TODAY });
  assert.ok(d.spare.monthly < 0); assert.equal(d.next.id, "bills");
  assert.ok(d.steps.every((s) => !s.doneDate && !s.startDate));
});

test("no expensive debt, no HSA, no 401(k): those steps are done or left out", () => {
  const p = familyPlan();
  p.debts = p.debts.filter((x) => x.accountId !== "a-visa"); p.accounts = p.accounts.filter((a) => a.id !== "a-visa" && a.type !== "401k");
  p.retirement.contributions = p.retirement.contributions.filter((c) => c.accountId !== "a-401");
  const d = compute(p, { today: TODAY });
  assert.equal(step(d, "high-debt").status, "done");
  assert.equal(step(d, "match"), undefined); assert.equal(step(d, "max-401k"), undefined); assert.equal(step(d, "hsa"), undefined);
  assert.ok(HIGH_RATE === 0.10);
});

test("an HSA account but no high-deductible plan this year: no HSA step (IRC 223(c)(1))", () => {
  const p = familyPlan();
  if (!p.accounts.some((a) => a.type === "hsa")) p.accounts.push({ id: "a-hsa-test", name: "HSA", type: "hsa", balance: 1000, ownerId: p.household.people[0].id });
  assert.ok(step(compute(p, { today: TODAY }), "hsa"), "with self-only cover the step is there");
  p.taxes.hsa = { ...p.taxes.hsa, coverage: "none" };
  assert.equal(step(compute(p, { today: TODAY }), "hsa"), undefined);
});
