// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("rmd: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

// ---- this year's withdrawal: amount, accounts, deadline, taken (round 4, 2026-11-02)
import { thisYear, markTaken } from "./compute.js";
import { emptyPlan as blank } from "../../../core/schema/migrate.js";
const retirees = () => {
  const p = blank();
  p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1953-06-20" }];
  p.accounts = [
    { id: "ira", name: "Ruth's IRA", type: "ira", balance: 310000, ownerId: "r", asOf: "2026-09-15", history: [] },
    { id: "k", name: "Sam's 401(k)", type: "401k", balance: 200000, ownerId: "s", history: [{ date: "2025-12-31", balance: 190000 }] },
    { id: "roth", name: "Sam's Roth", type: "roth", balance: 60000, ownerId: "s", history: [] },
  ];
  return p;
};
test("thisYear: the December 31 balance over the factor for the age reached; first year may wait to April 1; Roths have none", () => {
  const t = thisYear(retirees(), { today: "2026-11-02" });
  const ruth = t.people.find((x) => x.id === "r"), sam = t.people.find((x) => x.id === "s");
  assert.equal(ruth.age, 76); assert.equal(ruth.amount, Math.round(310000 / 23.7)); assert.equal(ruth.amount, 13080);
  assert.equal(ruth.estimated, true, "no balance near last December 31: today's, said as an estimate");
  assert.equal(ruth.deadline, "2026-12-31"); assert.equal(ruth.first, false);
  assert.equal(sam.first, true, "born 1953: 73 in 2026, the first year"); assert.equal(sam.deadline, "2027-04-01");
  assert.equal(sam.amount, Math.round(190000 / 26.5), "the December 31 point, not today's 200,000"); assert.equal(sam.estimated, false);
  assert.deepEqual(sam.accounts.map((a) => a.id), ["k"], "the Roth has no required withdrawal");
  assert.equal(t.total, 13080 + 7170);
  assert.deepEqual(thisYear(retirees(), { today: "2021-11-02" }).people, [], "before anyone's start year");
});
test("markTaken: I've taken it, and taken back", () => {
  const p = retirees();
  markTaken(p, 2026, "r", "2026-11-02");
  const t = thisYear(p, { today: "2026-11-02" });
  assert.equal(t.people.find((x) => x.id === "r").taken, "2026-11-02");
  assert.deepEqual(t.due.map((x) => x.id), ["s"]);
  markTaken(p, 2026, "r", null);
  assert.deepEqual(p.retirement.rmdTaken, {});
  assert.equal(thisYear(p, { today: "2026-11-02" }).due.length, 2);
});
