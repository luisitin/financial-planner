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

test("a file to restore must be shaped like a plan: lists stay lists, fields stay fields, two levels down", async () => {
  const { planShapeProblem } = await import("./compute.js");
  const t = emptyPlan();
  assert.equal(planShapeProblem(emptyPlan(), t), null);
  assert.equal(planShapeProblem({ schemaVersion: 1 }, t), null);                       // missing keys are filled by migrate
  assert.equal(planShapeProblem({ schemaVersion: 3, accounts: "oops" }, t), "accounts");
  assert.equal(planShapeProblem({ schemaVersion: 1, household: { people: "x" } }, t), "household.people");
  assert.equal(planShapeProblem({ schemaVersion: 1, household: null }, t), "household");
  assert.equal(planShapeProblem({ schemaVersion: 1, meta: "oops" }, t), "meta");
  assert.equal(planShapeProblem({ schemaVersion: 1, holdings: "oops" }, t), "holdings");
  assert.equal(planShapeProblem({ schemaVersion: 1, categories: {} }, t), "categories");
  assert.equal(planShapeProblem([], t), "the file");
});
