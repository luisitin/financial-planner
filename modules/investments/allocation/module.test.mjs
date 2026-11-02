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

test("review: a guess comes first (no mix to pick while most money is not typed in); the one-tap mixes never become REITs, gold or cash", async () => {
  const { targetDateMix } = await import("../holdings/compute.js");
  const T = { today: "2026-11-02" };
  // one bond fund typed, $177,000 in the investment accounts: a guess, not a mix to pick
  const g = await held(); g.holdings = g.holdings.filter((h) => h.symbol === "BND");
  const dg = compute(g, T);
  assert.equal(dg.verdict, "partial", "partial is checked before pick"); assert.ok(dg.known < 0.1);
  assert.match(dg.notes.find((n) => /holdings cover/.test(n)), /of the \$\d/, "the dollars in the note carry a $");
  // a brokerage with VTI and one other thing, nothing else invested
  const one = async (sym, cls, value) => {
    const p = await held(); const t = "2026-11-02";
    p.holdings = [{ id: "a", accountId: "a-brk", symbol: "VTI", name: "", shares: 100, price: 300, priceAsOf: t, costBasis: 30000, assetClass: "", lots: [] },
      { id: "b", accountId: "a-brk", symbol: sym, name: "", shares: value / 100, price: 100, priceAsOf: t, costBasis: value, assetClass: cls, lots: [] }];
    for (const id of ["a-401", "a-roth", "a-bk401"]) p.accounts.find((x) => x.id === id).balance = 0;
    p.accounts.find((x) => x.id === "a-brk").balance = 30000 + value;
    return compute(p, T);
  };
  const gold = await one("GLD", "", 10000);
  assert.equal(gold.restWords, "gold and other", "the hero names the 25% as gold, not bonds and cash");
  const pg = gold.choices.find((c) => c.key === "plan").mix;
  assert.ok(pg.other <= 0.25 + 1e-9 && Math.abs(pg.us_stocks - 0.7) < 0.011 && pg.bonds > 0, JSON.stringify(pg));
  const cash = await one("SPAXX", "cash", 10000);
  const pc = cash.choices.find((c) => c.key === "plan").mix;
  assert.equal(pc.cash, 0, "no bonds held: the rest of the plan's mix is bonds, not 30% cash"); assert.ok(Math.abs(pc.bonds - 0.3) < 0.011);
  assert.equal(cash.restWords, "cash");
  const reit = await one("VNQ", "", 30000);
  const pr = reit.choices.find((c) => c.key === "plan").mix;
  assert.ok(pr.real_estate <= 0.5 + 1e-9 && pr.us_stocks > 0, "REITs keep no more than they hold; never 70% REITs");
  assert.equal(reit.restWords, "", "100% stocks (REITs count as stocks): nothing to name");
  // the glide's parts add to 1 after rounding (the 2030 fund was 101%)
  for (const y of [2030, 2040, 2055, 2020]) { const m = targetDateMix(y, 2026); assert.ok(Math.abs(m.us_stocks + m.intl_stocks + m.bonds - 1) < 1e-9, `${y}: ${JSON.stringify(m)}`); }
});
