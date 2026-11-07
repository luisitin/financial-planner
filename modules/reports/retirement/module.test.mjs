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

test("batch 5b review D3: with a way that sets its own withdrawal, the report's spending is that way's first year, beside its own share", async () => {
  // the widow on "A share of what is left" (what "Use this one" saves): she plans on 50,400 + 16,880 - 2,411.76 = $64,868.24 in
  // 2026, about $5,406 a month, and income covers 50,400 / 64,868.24 = 78% of it. The report said "$3,000 a month" (the settings
  // figure) beside that 78%
  const { widowPlan } = await import("../../../qa/fixtures/widow-plan.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const p = migrate(widowPlan()); p.retirement.strategy = "percent";
  const d = compute(p, { today: "2026-11-06", maxPaths: 50 });
  assert.ok(Math.abs(d.plan.spendingMonthly - 64868.24 / 12) < 0.01, String(d.plan.spendingMonthly));
  assert.ok(Math.abs(d.plan.plannedMonthly - 3000) < 0.01, String(d.plan.plannedMonthly));
  assert.ok(Math.abs(d.plan.coverage - 50400 / 64868.24) < 1e-6);
  // on the same spending every year nothing changes: the plan's own $3,000
  const f = compute(migrate(widowPlan()), { today: "2026-11-06", maxPaths: 50 });
  assert.ok(Math.abs(f.plan.spendingMonthly - 3000) < 0.01 && Math.abs(f.plan.plannedMonthly - 3000) < 0.01);
});

test("batch 5b UX review 8: the report says guardrails in the words the retirement pages use, not 'cut 10% after a bad stretch'", async () => {
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { widowPlan } = await import("../../../qa/fixtures/widow-plan.mjs");
  const p = migrate(widowPlan()); p.retirement.strategy = "guardrails";
  const d = compute(p, { today: "2026-11-06", maxPaths: 50 });
  assert.equal(d.plan.strategy, "What you plan, trimmed by a tenth after bad years and raised back after good ones");
  assert.ok(!/cut 10%|bad stretch/.test(d.plan.strategy));
});
