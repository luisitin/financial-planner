// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("longevity: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("Review 2026-11-06 (round 7): the couple's age is 'your age' for the first adult Get started left unnamed ('Me')", () => {
  const T = "2026-09-16";
  assert.equal(compute(retirementPlan(), { today: T }).suggestion, "Plan for at least one of you being alive to about 99 (Sam's age): that is when the chance drops under 1 in 10.", "a typed name reads as before");
  for (const partner of ["My spouse", "Lee"]) {
    const p = retirementPlan(); p.household.people[0].name = "Me"; p.household.people[1].name = partner;
    const d = compute(p, { today: T });
    assert.equal(d.suggestion, "Plan for at least one of you being alive to about 99 (your age): that is when the chance drops under 1 in 10.", "was: (Me's age)");
    assert.deepEqual([d.either.first, d.either.second], ["Me", partner], "the names themselves stay as stored");
  }
});
