import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, STEP } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { compute as projection } from "../../retirement/projection/compute.js";

const TODAY = "2026-10-30";

test("not ready without the plan basics", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.ok(d.missing.length);
});

test("the family's report carries the retirement pages' own figures", () => {
  const d = compute(familyPlan(), { today: TODAY, maxPaths: 200 });
  const pr = projection(familyPlan(), { today: TODAY });
  assert.equal(d.plan.retireYear, 2055); assert.equal(d.plan.lastsTo, 2085);
  assert.ok(Math.abs(d.plan.affordableMonthly - pr.affordable / 12) < 1e-9);
  assert.equal(d.chance.paths, 200); assert.equal(d.chance.bands.length, 2085 - 2026 + 1);
  assert.ok(d.history.windows > 0 && d.history.rate >= 0 && d.history.rate <= 1);
  assert.deepEqual(d.socialSecurity.people.map((p) => p.name), ["Ana", "Bo"]);
  assert.deepEqual(d.rmd.map((r) => [r.name, r.startYear]), [["Ana", 2065], ["Bo", 2063]]);
  assert.equal(d.roth, null, "flat tax: no conversion section");
  assert.equal(d.market.length, 6);
});

test("the table: the first year, the retirement year, every five years, the last", () => {
  const d = compute(familyPlan(), { today: TODAY, maxPaths: 100 });
  const ys = d.years.map((r) => r.year);
  assert.equal(ys[0], 2026); assert.equal(ys.at(-1), 2085); assert.ok(ys.includes(2055));
  for (const y of ys) assert.ok(y === 2026 || y === 2055 || y === 2085 || (y - 2026) % STEP === 0, String(y));
});
