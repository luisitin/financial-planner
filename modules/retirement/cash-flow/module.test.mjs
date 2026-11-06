// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("cash-flow: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("Review 2026-11-06 (round 7): the year's income lines say 'your Social Security' for the first adult Get started left unnamed", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-06";
  const lines = (plan) => [...new Set(compute(plan, { today: T }).rows.flatMap((r) => r.in.lines.map((l) => l.name)))];
  assert.deepEqual(lines(familyPlan(T)), ["Bo's Social Security", "Ana's Social Security"], "typed names read as before");
  for (const [partner, theirs] of [["My spouse", "your spouse's"], ["Bo", "Bo's"]]) {
    const p = familyPlan(T); p.household.people[0].name = "Me"; p.household.people[1].name = partner;
    assert.deepEqual(lines(p), [`${theirs} Social Security`, "your Social Security"], "was: Me's Social Security, My spouse's Social Security");
  }
});
