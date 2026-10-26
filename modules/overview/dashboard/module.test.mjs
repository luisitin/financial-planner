import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("setup checklist counts", () => {
  const p = emptyPlan();
  assert.equal(compute(p).doneCount, 0);
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  p.goals.push({ id: "g", name: "Emergency fund", target: 10000 });
  const d = compute(p);
  assert.equal(d.doneCount, 2);
  assert.equal(d.total, d.steps.length);
});
