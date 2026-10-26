import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("all-pages flags noted pages", () => {
  const p = emptyPlan();
  p.pageNotes["retirement/monte-carlo"] = "show me the fan chart";
  assert.ok(compute(p).noted.has("retirement/monte-carlo"));
  assert.equal(compute(emptyPlan()).noted.size, 0);
});
