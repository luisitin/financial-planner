// Copy to modules/<group>/<id>/module.test.mjs. `npm test` runs every *.test.mjs under tests/
// and every module.test.mjs (see tests/modules.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../core/schema/migrate.js";

test("template compute counts accounts", () => {
  const plan = emptyPlan();
  plan.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  assert.equal(compute(plan).example, 1);
});
