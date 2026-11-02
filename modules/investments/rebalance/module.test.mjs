// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("rebalance: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("no trades against a mix nobody chose, and a target-date fund is never sold as one class", async () => {
  const held = async () => (await import("../../../qa/fixtures/held-plan.mjs")).heldPlan();
  const { compute: allocation } = await import("../allocation/compute.js");
  const p = await held(), T = { today: "2026-11-02" };
  const w = compute(p, T);
  assert.equal(w.waiting, "pick"); assert.equal(w.needed, false); assert.deepEqual(w.trades, []);
  // the plan's 70/30 chosen: the US index funds are sold, the 2055 fund is not
  p.investments = { ...(p.investments ?? {}), target: allocation(p, T).choices.find((c) => c.key === "plan").mix };
  const r = compute(p, T);
  assert.equal(r.waiting, null); assert.equal(r.needed, true);
  assert.ok(r.sells.length && r.sells.every((s) => s.symbol !== "FFFHX"), r.sells.map((s) => s.symbol).join(","));
  assert.deepEqual(r.blended.map((b) => b.symbol), ["FFFHX"]);
  // only the target-date fund holds stocks: nothing can be sold for them, and the page says why
  p.holdings = p.holdings.filter((h) => h.symbol === "FFFHX" || h.symbol === "BND");
  for (const [id, v] of [["a-401", 3300 * 16], ["a-roth", 0], ["a-bk401", 0]]) p.accounts.find((a) => a.id === id).balance = v;
  p.investments.target = { us_stocks: 0.3, intl_stocks: 0.2, bonds: 0.5, cash: 0, real_estate: 0, other: 0 };
  const o = compute(p, T);
  assert.ok(o.sells.every((s) => s.symbol !== "FFFHX"));
  assert.ok(o.overOnlyBlended.length > 0);
  // nothing can be sold: the page says the ways to move the fund's mix instead of an empty trade list
  assert.equal(o.sells.length, 0); assert.ok(o.onlyInFund, "only the fund holds what is over");
  assert.deepEqual(o.onlyInFund.funds.map((x) => x.symbol), ["FFFHX"]); assert.equal(o.onlyInFund.taxFree, true, "inside the 401(k)");
  assert.ok(!o.notes.some((n) => /keeps its own mix|could not be placed/.test(n)), "the hero says it, not two notes");
  // the fund alone, its own mix picked: no rebalance, and no note telling them to pick it
  p.holdings = p.holdings.filter((h) => h.symbol === "FFFHX"); p.accounts.find((a) => a.id === "a-brk").balance = 0;
  p.investments.target = null;
  p.investments.target = allocation(p, T).choices.find((c) => c.key === "fund").mix;
  const k = compute(p, T);
  assert.equal(k.needed, false); assert.equal(k.onlyInFund, null); assert.deepEqual(k.overOnlyBlended, []);
  assert.ok(!k.notes.some((n) => /pick a target that matches|could not be placed/.test(n)), k.notes.join(" | "));
});
