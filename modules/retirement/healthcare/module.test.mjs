import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, ageFactor, povertyLine, expectedShare, credit } from "./compute.js";
import { FPL, BENCHMARK_40 } from "./data/aca.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the age curve, the poverty line, the expected share and the cliff", () => {
  assert.equal(ageFactor(21), 1); assert.equal(ageFactor(40), 1.278); assert.equal(ageFactor(64), 3); assert.equal(ageFactor(70), 3);
  near(ageFactor(62), 2.714 + 2 / 4 * (3 - 2.714)); assert.equal(ageFactor(5), 0.765);
  assert.equal(povertyLine(1), FPL.base); assert.equal(povertyLine(2), 21150); assert.equal(povertyLine(4), 32150);
  assert.equal(expectedShare(1.2), 0.021); near(expectedShare(1.75), 0.0419 + 0.5 * (0.066 - 0.0419)); assert.equal(expectedShare(3.5), 0.0996);
  assert.equal(expectedShare(4.01), null, "over the cliff, no credit"); assert.equal(expectedShare(4.01, "enhanced"), 0.085); assert.equal(expectedShare(1.4, "enhanced"), 0);
});

test("the credit: the benchmark less the expected contribution, never below zero; nothing over the cliff", () => {
  const c = credit({ magi: 60000, size: 2, benchmarkYearly: 30000 });
  near(c.multiple, 60000 / 21150); near(c.credit, 30000 - c.share * 60000); near(c.cost, c.share * 60000);
  const over = credit({ magi: 4.01 * 21150, size: 2, benchmarkYearly: 30000 });
  assert.equal(over.credit, 0); assert.equal(over.cost, 30000);
  assert.equal(credit({ magi: 200000, size: 2, benchmarkYearly: 5000, rules: "enhanced" }).credit, 0, "the benchmark is under 8.5% of income");
});

test("the family as planned: no marketplace years (Ana's job covers Bo's gap)", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.noBridge, true); assert.deepEqual(d.onWorkPlan.map((y) => y.year), [2050, 2051, 2052]);
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("both retiring at 58: the marketplace years, the national benchmark by age, over the cliff, and the larger credits", () => {
  const p = familyPlan(TODAY); for (const q of p.household.people) if (q.role !== "dependent") q.retirementAge = 58;
  const d = compute(p, { today: TODAY });
  assert.equal(d.years[0].year, 2048); assert.deepEqual(d.years[0].covered, ["Ana", "Bo"]);
  near(d.years[0].benchmark, 12 * BENCHMARK_40 / ageFactor(40) * (ageFactor(58) + ageFactor(60)));
  assert.equal(d.size, 2); assert.equal(d.cliffIncome, 4 * 21150);
  const over = d.years.filter((y) => y.overCliff > 0);
  assert.ok(over.length > 0); for (const y of over) { assert.equal(y.credit, 0); assert.ok(y.lostCredit > 0); }
  near(d.total, d.years.reduce((s, y) => s + y.cost, 0));
  p.retirement.aca = { rules: "enhanced", benchmarkMonthly: 2000 };
  const e = compute(p, { today: TODAY });
  assert.ok(e.total < d.total); assert.equal(e.cliffYears, 0); assert.equal(e.cliffIncome, null);
  near(e.years[0].benchmark, 12 * 2000 / (ageFactor(36) / ageFactor(40) + ageFactor(38) / ageFactor(40)) / ageFactor(40) * (ageFactor(58) + ageFactor(60)), 1e-6);
});
