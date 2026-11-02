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

// the round-3 walk-through's household (qa/fixtures/held-plan.mjs)
const held = async () => (await import("../../../qa/fixtures/held-plan.mjs")).heldPlan();

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

test("holdings with no class are named in dollars; a 2055 fund typed by ticker alone gives the fund choice", () => {
  const p = investmentsPlan();
  const d = compute(p, { today: "2026-09-16" });
  const note = d.notes.find((n) => /have no asset class/.test(n));
  assert.match(note, /^\$90,000 of holdings have no asset class yet/, "ACME: 500 x $180");
  p.holdings.find((h) => h.symbol === "VFFVX").name = "";
  const c = compute(p, { today: "2026-09-16" }).choices.find((x) => x.key === "fund");
  assert.equal(c?.year, 2055);
});
