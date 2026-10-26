import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("assistant summary names accounts and goals", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "Chase", type: "checking", balance: 1234 });
  p.goals.push({ id: "g", name: "House", target: 50000, targetDate: "2028-01-01" });
  const d = compute(p);
  assert.match(d.summary, /Chase: checking, balance 1234/);
  assert.match(d.summary, /House: target 50000/);
});
