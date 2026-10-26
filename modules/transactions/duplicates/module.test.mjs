import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, findDuplicates } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("empty plan", () => { assert.equal(compute(emptyPlan()).count, 0); });
test("the Amazon line posted twice a day apart is a duplicate; the two Kroger trips a week apart are not", () => {
  const d = compute(samplePlan());
  assert.equal(d.count, 1);
  assert.equal(d.pairs[0].keep.id, "t11"); assert.equal(d.pairs[0].drop.id, "t12"); assert.equal(d.pairs[0].accountName, "Visa card");
  assert.ok(d.pairs[0].why.includes("a day apart"));
});
test("similar descriptions count; different accounts or amounts do not", () => {
  const dup = findDuplicates([
    { id: "a", accountId: "x", date: "2026-09-01", amount: -10, payee: "Starbucks", rawPayee: "STARBUCKS STORE 1234 DAYTON OH" },
    { id: "b", accountId: "x", date: "2026-09-01", amount: -10, payee: "Starbucks", rawPayee: "STARBUCKS 1234 DAYTON" },
    { id: "c", accountId: "y", date: "2026-09-01", amount: -10, payee: "Starbucks", rawPayee: "STARBUCKS 1234 DAYTON" },
    { id: "d", accountId: "x", date: "2026-09-01", amount: -11, payee: "Starbucks", rawPayee: "STARBUCKS 1234 DAYTON" },
    { id: "e", accountId: "x", date: "2026-09-01", amount: -10, payee: "Shell", rawPayee: "SHELL OIL" },
  ]);
  assert.equal(dup.length, 1); assert.equal(dup[0].keep.id, "a"); assert.equal(dup[0].drop.id, "b"); assert.ok(dup[0].why.includes("same day"));
});
