// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("brackets: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("brackets: filing separately, the ladder is the return of the adult marked Me, and more income lands on it", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30"); p.household.filingStatus = "married_separate";
  const d = compute(p, { today: "2026-10-30", extra: 10000 });
  assert.equal(d.whose, "Ana"); assert.equal(d.separate.length, 2);
  const ana = d.separate.find((x) => x.shown);
  assert.equal(ana.name, "Ana"); assert.equal(d.taxableIncome, ana.taxableIncome);
  assert.equal(d.ladder.reduce((s, l) => s + l.filled, 0), d.ordinaryTaxable);   // one return's ladder fills to its own taxable income
  assert.ok(Math.abs(d.totalTax - d.separate.reduce((s, x) => s + x.totalTax, 0)) < 0.011);   // the household's tax is both
  assert.ok(d.extra.taxableIncome - ana.taxableIncome > 9999);   // the extra 10,000 is on Ana's return
  p.household.filingStatus = "married_joint";
  assert.equal(compute(p, { today: "2026-10-30" }).separate, null);
});
