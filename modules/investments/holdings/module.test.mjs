// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("holdings: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("a Vanguard target-date fund typed by its ticker alone is a mix by its year, the fee left unknown", async () => {
  const { classify } = await import("./compute.js");
  const t = classify("vffvx", "", 2026);
  assert.equal(t.cls, "balanced"); assert.equal(t.targetYear, 2055); assert.equal(t.er, null);
  assert.deepEqual(t.mix, { us_stocks: 0.54, intl_stocks: 0.36, bonds: 0.1 }, "29 years out: the glide's 90% stocks");
  assert.equal(classify("VTWNX", "", 2026).targetYear, 2020);
  const inc = classify("VTINX", "", 2026);
  assert.equal(inc.cls, "balanced"); assert.equal(Math.round((inc.mix.us_stocks + inc.mix.intl_stocks) * 100), 30, "the Income fund: the glide's end");
});
