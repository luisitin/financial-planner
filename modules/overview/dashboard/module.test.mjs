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

test("a finished 'Set up my plan' folds the checklist even with the assumptions still to look over", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  assert.equal(compute(p).setupFinished, false);
  p.guide = { setup: { startedAt: "2026-11-01", finishedAt: "2026-11-01" } };
  const d = compute(p);
  assert.equal(d.setupFinished, true);
  assert.equal(d.next?.key, "people", "the checklist itself still knows what is open");
});
