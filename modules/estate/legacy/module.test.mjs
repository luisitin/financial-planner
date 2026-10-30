import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, legacyTarget } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const withLegacy = (legacy) => { const p = familyPlan(TODAY); p.estate.legacy = legacy; return p; };
const BEQ = [{ id: "a", to: "Cy", kind: "person", amount: 900000 }, { id: "b", to: "Food bank", kind: "charity", amount: 50000 }];

test("the target: the bequests' total, less the home when it is part of the legacy", () => {
  assert.deepEqual(legacyTarget(emptyPlan()), { total: 0, home: 0, target: 0 });
  assert.deepEqual(legacyTarget(withLegacy({ bequests: BEQ })), { total: 950000, home: 0, target: 950000 });
  assert.deepEqual(legacyTarget(withLegacy({ bequests: BEQ, includeHome: true })), { total: 950000, home: 380000, target: 570000 });
  assert.equal(legacyTarget(withLegacy({ bequests: [{ id: "a", to: "Cy", amount: 100000 }], includeHome: true })).target, 0, "never below zero");
});

test("nothing to leave: no goal-seek run", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.total, 0); assert.equal(d.levers, null); assert.equal(d.meets, true);
});

test("the family's legacy: shares, by kind, checked against the plan's end and solved by goal seek", () => {
  const d = compute(withLegacy({ bequests: BEQ, includeHome: true }), { today: TODAY });
  assert.equal(d.people, 900000); assert.equal(d.charity, 50000); assert.ok(Math.abs(d.bequests[0].share - 900000 / 950000) < 1e-12);
  assert.equal(d.ready, true); assert.equal(d.meets, d.endReal >= 570000);
  assert.ok(Array.isArray(d.levers) && d.levers.some((l) => l.id === "spending"));
  const big = compute(withLegacy({ bequests: [{ id: "a", to: "Cy", kind: "person", amount: 2000000 }] }), { today: TODAY });
  assert.equal(big.meets, false); assert.ok(big.gap > 0); assert.equal(big.levers.find((l) => l.id === "spending").status, "needs");
});

test("not ready without the plan's basics, the bequests still listed", () => {
  const p = emptyPlan(); p.estate.legacy = { bequests: BEQ };
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.total, 950000);
});
