import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("settings reports sections", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  const d = compute(p);
  assert.equal(d.schemaVersion, 1);
  assert.equal(d.sections.find((s) => s.key === "accounts").count, 1);
  assert.ok(d.sizeKB > 0);
});
