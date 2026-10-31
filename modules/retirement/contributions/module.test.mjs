// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("contributions: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("a Roth 401(k) counts with the 401(k) limit, a Roth IRA with the IRA limit (IRC 402A(c)(2), 408A(c)(2))", async () => {
  const { limitKind } = await import("./compute.js");
  assert.equal(limitKind("roth", "Roth IRA"), "ira"); assert.equal(limitKind("roth", "Roth 401(k)"), "401k");
  assert.equal(limitKind("roth", "Work Roth", 1200), "401k", "an employer match: a workplace plan"); assert.equal(limitKind("roth", "Roth 403b"), "401k");
  assert.equal(limitKind("ira", "IRA"), "ira"); assert.equal(limitKind("401k", "401k"), "401k"); assert.equal(limitKind("hsa", "HSA"), "hsa");
  // $20,000 a year into a Roth 401(k) at 41 in 2026 is within the $24,500 401(k) limit, not over the $7,500 IRA limit
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.household.people = [{ id: "a", name: "Ana", role: "self", birthDate: "1985-01-01" }];
  p.accounts = [{ id: "r", name: "Roth 401(k)", type: "roth", balance: 0, ownerId: "a" }];
  p.retirement = { ...(p.retirement ?? {}), contributions: [{ id: "c", personId: "a", accountId: "r", amount: 20000, period: "annual" }] };
  const d = compute(p, { today: "2026-10-31" });
  assert.equal(d.warnings.length, 0); assert.equal(d.byPerson[0].limits[0].kind, "401k"); assert.equal(d.byPerson[0].limits[0].limit, 24500);
});
