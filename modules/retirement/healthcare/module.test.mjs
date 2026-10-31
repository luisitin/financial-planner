import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, ageFactor, povertyLine, expectedShare, credit, countedAges } from "./compute.js";
import { FPL, BENCHMARK_40 } from "./data/aca.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the age curve, the poverty line, the expected share and the cliff", () => {
  // the federal default standard age curve, one factor for each age (CMS, December 16, 2016, Appendix I)
  assert.equal(ageFactor(21), 1); assert.equal(ageFactor(40), 1.278); assert.equal(ageFactor(64), 3); assert.equal(ageFactor(70), 3);
  assert.equal(ageFactor(62), 2.873); assert.equal(ageFactor(45), 1.444); assert.equal(ageFactor(34), 1.214); assert.equal(ageFactor(45.9), 1.444);
  assert.equal(ageFactor(5), 0.765); assert.equal(ageFactor(14), 0.765); assert.equal(ageFactor(15), 0.833);
  // coverage in 2026 uses the 2025 guidelines (the default); 2027 the 2026 ones; later years hold the newest
  assert.equal(povertyLine(1), FPL.base); assert.equal(povertyLine(2), 21150); assert.equal(povertyLine(4), 32150);
  assert.equal(povertyLine(2, 2027), 21640); assert.equal(povertyLine(1, 2040), 15960); assert.equal(povertyLine(1, 2020), 15650);
  // straight-line in its band, rounded to the nearest one-hundredth of one percent (26 CFR 1.36B-3(g)(1))
  assert.equal(expectedShare(1.2), 0.021); assert.equal(expectedShare(1.75), 0.054); assert.equal(expectedShare(3.5), 0.0996);
  assert.equal(expectedShare(1.75, "law", 2027), 0.0554); assert.equal(expectedShare(1.2, "law", 2027), 0.0215);
  assert.equal(expectedShare(1.33), 0.0314, "exactly 133%: at least 133% is the upper band (Rev. Proc. 2025-25)");
  assert.equal(expectedShare(4), 0.0996, "exactly 400% still has a credit"); assert.equal(expectedShare(4.01), null, "over the cliff, no credit");
  assert.equal(expectedShare(0.99), null, "under 100% of the poverty line: no credit (36B(c)(1)(A))"); assert.equal(expectedShare(0.99, "enhanced"), null);
  assert.equal(expectedShare(4.01, "enhanced"), 0.085); assert.equal(expectedShare(1.4, "enhanced"), 0);
  // a family's premium counts only the three oldest children under 21 (45 CFR 147.102(c)(1))
  assert.deepEqual(countedAges([45, 43, 17, 15, 12, 9, 22]), [45, 43, 22, 17, 15, 12]);
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
  assert.equal(d.size, 2); assert.equal(d.cliffIncome, 4 * povertyLine(2, 2027), "2048 holds the newest figures (2027 coverage)");
  const over = d.years.filter((y) => y.overCliff > 0);
  assert.ok(over.length > 0); for (const y of over) { assert.equal(y.credit, 0); assert.ok(y.lostCredit > 0); }
  near(d.total, d.years.reduce((s, y) => s + y.cost, 0));
  p.retirement.aca = { rules: "enhanced", benchmarkMonthly: 2000 };
  const e = compute(p, { today: TODAY });
  assert.ok(e.total < d.total); assert.equal(e.cliffYears, 0); assert.equal(e.cliffIncome, null);
  near(e.years[0].benchmark, 12 * 2000 / (ageFactor(36) / ageFactor(40) + ageFactor(38) / ageFactor(40)) / ageFactor(40) * (ageFactor(58) + ageFactor(60)), 1e-6);
});
