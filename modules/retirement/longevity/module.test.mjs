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

// stress test 2026-11-11, RC-6: the suggested age comes with what a tap would set, and setting it makes the plan run to that year
test("apply: the Plan to ages that make the plan run to the suggested year", async () => {
  const { buildInputs } = await import("../projection/compute.js");
  const today = "2026-11-11";
  // one adult: their own 1 in 10 age
  const one = emptyPlan();
  one.household.people = [{ id: "a", name: "Ruth", role: "self", birthDate: "1954-03-01" }];
  const d1 = compute(one, { today });
  assert.ok(d1.apply, "a single adult whose 1 in 10 age is not 95 gets a suggestion to apply");
  assert.equal(d1.apply.ages.a, d1.people[0].planTo);
  assert.equal(d1.apply.from.a, 95);
  assert.equal(d1.apply.year, 1954 + d1.people[0].planTo);
  // a couple: the plan runs to the year the chance either is alive drops under 1 in 10
  const two = retirementPlan(today);
  const d2 = compute(two, { today });
  assert.ok(d2.either && d2.apply);
  assert.equal(d2.apply.year, d2.either.planToYear);
  const moved = two.household.people.filter((x) => d2.apply.ages[x.id] !== undefined);
  for (const p of moved) {
    assert.equal(Number(p.birthDate.slice(0, 4)) + d2.apply.ages[p.id], d2.either.planToYear);
    p.lifeExpectancy = d2.apply.ages[p.id];
  }
  assert.equal(buildInputs(two, { today }).inputs.endYear, d2.either.planToYear, "the projection now runs to that year");
  // once applied, nothing left to suggest
  assert.equal(compute(two, { today }).apply, null);
  // both set to 100 (the suggested year is earlier than both): one tap still gives that year, not a second button
  const late = retirementPlan(today);
  for (const p of late.household.people) p.lifeExpectancy = 100;
  const d3 = compute(late, { today });
  for (const p of late.household.people) if (d3.apply.ages[p.id] !== undefined) p.lifeExpectancy = d3.apply.ages[p.id];
  assert.equal(buildInputs(late, { today }).inputs.endYear, d3.apply.year);
  assert.equal(compute(late, { today }).apply, null);
});
