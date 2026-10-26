import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan", () => { assert.equal(compute(emptyPlan()).hasData, false); });
test("latest month by default: spending only (no income, no transfers), categories with shares and change, top payees, biggest", () => {
  const p = samplePlan();
  const d = compute(p);
  assert.equal(d.month, "2026-09"); assert.equal(d.label, "Sep 2026");
  assert.deepEqual(d.months.map((m) => m.ym), ["2026-09", "2026-08"]);
  near(d.total, 1500 + 86.40 + 54.12 + 15.49 + 640.22 + 42.17 + 42.17);
  assert.equal(d.count, 7);
  assert.equal(d.previous.ym, "2026-08"); near(d.previous.total, 1608);
  near(d.change, (d.total - 1608) / 1608);
  assert.equal(d.byCategory[0].category, "housing"); near(d.byCategory[0].share, 1500 / d.total); near(d.byCategory[0].change, 0);
  const groc = d.byCategory.find((c) => c.category === "groceries");
  near(groc.total, 140.52); near(groc.previous, 60); near(groc.change, (140.52 - 60) / 60);
  const unfiled = d.byCategory.find((c) => c.category === "");
  near(unfiled.total, 15.49 + 640.22 + 42.17);
  assert.equal(d.topPayees[0].payee, "Oak Street Apartments");
  assert.equal(d.biggest[0].payee, "Oak Street Apartments"); assert.equal(d.biggest[1].payee, "Chase Credit Crd Autopay");
  assert.equal(d.daily.length, 6, "six distinct days with spending");
});
test("an earlier month can be chosen; an unknown month falls back to the latest", () => {
  const p = samplePlan();
  const d = compute(p, { month: "2026-08" });
  assert.equal(d.month, "2026-08"); near(d.total, 1608); assert.equal(d.previous, null); assert.equal(d.change, null);
  assert.equal(compute(p, { month: "2020-01" }).month, "2026-09");
});
