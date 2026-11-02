// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("allocation: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// the round-3 walk-through's household: a 2055 target-date fund, two US funds, VTI and BND (no target of their own)
const held = async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-02"), t = "2026-11-02";
  p.holdings = [
    { id: "h1", accountId: "a-401", symbol: "FFFHX", name: "Fidelity Freedom 2055", shares: 3300, price: 16, priceAsOf: t, costBasis: 42000, assetClass: "", lots: [] },
    { id: "h2", accountId: "a-401", symbol: "FXAIX", name: "Fidelity 500 Index", shares: 150, price: 220, priceAsOf: t, costBasis: 25000, assetClass: "", lots: [] },
    { id: "h3", accountId: "a-roth", symbol: "VTI", name: "", shares: 100, price: 310, priceAsOf: t, costBasis: 22000, assetClass: "", lots: [] },
    { id: "h4", accountId: "a-bk401", symbol: "AGTHX", name: "American Funds Growth Fund of America", shares: 600, price: 70, priceAsOf: t, costBasis: 30000, assetClass: "us_stocks", lots: [] },
    { id: "h6", accountId: "a-brk", symbol: "BND", name: "", shares: 120, price: 72, priceAsOf: t, costBasis: 9000, assetClass: "", lots: [] },
  ];
  for (const [id, v] of [["a-401", 3300 * 16 + 150 * 220], ["a-roth", 31000], ["a-bk401", 42000], ["a-brk", 120 * 72]]) p.accounts.find((a) => a.id === id).balance = v;
  return p;
};
export { held };

test("no target of your own: no drift is called; three mixes to pick, each keeping what is held inside stocks and inside the rest", async () => {
  const p = await held(), T = { today: "2026-11-02" };
  const a = compute(p, T);
  assert.equal(a.targetSource, "plan"); assert.equal(a.verdict, "pick");
  assert.deepEqual(a.choices.map((c) => c.key), ["now", "fund", "plan"]);
  const fund = a.choices.find((c) => c.key === "fund");
  assert.equal(fund.year, 2055); assert.ok(Math.abs(fund.stocks - 0.9) < 0.006, "a 2055 fund holds about 90% stocks in 2026");
  const sum = (m) => Object.values(m).reduce((s, x) => s + x, 0);
  for (const c of a.choices) assert.ok(Math.abs(sum(c.mix) - 1) < 1e-9);
  const usOverIntl = (m) => m.us_stocks / (m.us_stocks + m.intl_stocks);
  assert.ok(Math.abs(usOverIntl(fund.mix) - usOverIntl(a.choices[0].mix)) < 0.01, "US against international as held");
  // picking 90% when 92% is held: close to target, not a trade between US and international
  p.investments = { ...(p.investments ?? {}), target: fund.mix };
  const b = compute(p, T);
  assert.equal(b.verdict, "ok"); assert.equal(b.flaggedCount, 0);
  // most of the money not classified: no verdict
  p.holdings = p.holdings.filter((h) => h.id === "h6");
  assert.equal(compute(p, T).verdict, "partial");
});
