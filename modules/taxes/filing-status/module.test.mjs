import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, separatePlan } from "./compute.js";
import { taxInputs } from "../federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const taxOf = (p) => { const b = taxInputs(p, { today: TODAY }); return federalTax(b.inputs, b.params).totalTax; };

test("a separate return: the person's own pay and saving, half of what is shared, the children only on one", () => {
  const p = familyPlan(TODAY); p.income.push({ id: "j", name: "Joint interest", type: "investment", amount: 1000, period: "annual" }); p.taxes = { itemized: { mortgageInterest: 10000 } };
  const bo = separatePlan(p, "p-bo", { kids: false });
  assert.deepEqual(bo.household.people.map((q) => q.id), ["p-bo"]); assert.equal(bo.household.people[0].role, "self"); assert.equal(bo.household.filingStatus, "married_separate");
  assert.ok(bo.income.every((x) => x.personId === "p-bo" || !x.personId)); assert.equal(bo.income.find((x) => x.id === "j").amount, 500);
  assert.ok(bo.retirement.contributions.every((c) => c.personId === "p-bo")); assert.equal(bo.taxes.itemized.mortgageInterest, 5000);
  assert.ok(separatePlan(p, "p-ana", { kids: true }).household.people.some((q) => q.id === "p-cy"));
});

test("the couple: jointly against two separate returns, each a real return", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  assert.equal(d.kind, "couple"); assert.equal(d.current, "married_joint");
  const joint = d.options.find((o) => o.status === "married_joint"), sep = d.options.find((o) => o.status === "married_separate");
  near(joint.tax, taxOf(p));
  near(sep.parts.find((x) => x.name === "Ana").tax, taxOf(separatePlan(p, "p-ana", { kids: true })));   // Ana earns more in a year: Cy is on her return
  near(sep.tax, sep.parts.reduce((t, x) => t + x.tax, 0));
  assert.equal(d.best, joint.tax <= sep.tax + 0.5 ? "married_joint" : "married_separate"); assert.equal(d.limits.length, 4);
});

test("a single parent: head of household against single", () => {
  const p = familyPlan(TODAY); p.household.people = p.household.people.filter((q) => q.id !== "p-bo"); p.household.filingStatus = "single";
  const d = compute(p, { today: TODAY });
  assert.equal(d.kind, "single-parent"); assert.equal(d.best, "head_of_household"); assert.ok(d.saving > 0);
  near(d.saving, taxOf(p) - taxOf({ ...p, household: { ...p.household, filingStatus: "head_of_household" } }));
});

test("one adult, no children: one way only; nobody: nothing", () => {
  const p = familyPlan(TODAY); p.household.people = p.household.people.filter((q) => q.id === "p-ana"); p.household.filingStatus = "single";
  const d = compute(p, { today: TODAY });
  assert.equal(d.kind, "single"); assert.equal(d.options.length, 1); assert.equal(d.saving, 0);
  assert.equal(compute(emptyPlan(), { today: TODAY }).options.length, 0);
});
