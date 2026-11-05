// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("monte-carlo: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("the careful figure: the spending that lasts in 9 of 10 markets, below the average-market one (round 5, 2026-11-02)", async () => {
  const { spendingAtChance, drawSequences, CAREFUL_CHANCE } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { project } = await import("../../../core/math/retirement.js");
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const I = buildInputs(retirementPlan(), { today: "2026-11-02" }).inputs;
  const c = spendingAtChance(I);
  assert.equal(c.chance, CAREFUL_CHANCE); assert.equal(c.yearly % 100, 0, "a round $100 a year");
  assert.ok(c.yearly > 0 && c.yearly < c.average, `careful ${c.yearly} below the average-market ${c.average}`);
  assert.ok(c.rate >= 0.9, "it lasts in at least 9 of 10 of its own paths");
  // on a different, larger draw it still lasts in about 9 of 10, and the average-market figure in well under 6 of 10
  const big = drawSequences(1500, I.endYear - I.startYear + 1, { stocks: I.returns.stocks, bonds: I.returns.bonds, stdevStocks: I.stdev.stocks, stdevBonds: I.stdev.bonds, seed: 7 });
  const rate = (s) => big.filter((seq) => project({ ...I, strategy: "fixed-real", spending: { yearly: s } }, { sequence: seq }).success).length / big.length;
  const r = rate(c.yearly), ra = rate(c.average);
  assert.ok(r > 0.84 && r < 0.96, `careful lasts in ${r}`); assert.ok(ra < 0.6, `average-market figure lasts in only ${ra}`);
  // the same plan twice gives the same answer (one fixed draw)
  assert.equal(spendingAtChance(I).yearly, c.yearly);
  // compute() carries it; careful: false leaves it out
  const { compute } = await import("./compute.js");
  assert.equal(compute(retirementPlan(), { today: "2026-11-02", paths: 200 }).careful.yearly, c.yearly);
  assert.equal(compute(retirementPlan(), { today: "2026-11-02", paths: 200, careful: false }).careful, null);
});

// review of the careful figure (round 5, 2026-11-02): settled on the Chance page's own 2,000 paths, the planned share spent
// steadily on the same paths, a goal to leave money, nothing that lasts even at $0, a slice at a time, and its cost
test("the careful figure is settled on the Chance page's 2,000 paths: the most whole $100 that lasts in 9 of 10 of them", async () => {
  const { spendingAtChance, drawSequences, compute: mcCompute } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { project } = await import("../../../core/math/retirement.js");
  const plan = retirementPlan(); plan.retirement.spendingMonthly = 9175;   // $110,100 a year: the old 300-path figure
  const I = buildInputs(plan, { today: "2026-11-02" }).inputs;
  const c = spendingAtChance(I);
  const seqs = drawSequences(2000, I.endYear - I.startYear + 1, { stocks: I.returns.stocks, bonds: I.returns.bonds, stdevStocks: I.stdev.stocks, stdevBonds: I.stdev.bonds, seed: 1 });
  const lasting = (s) => seqs.filter((q) => project({ ...I, strategy: "fixed-real", spending: { yearly: s } }, { sequence: q }).success).length;
  assert.equal(c.paths, 2000);
  assert.ok(lasting(c.yearly) >= 1800, `lasts in ${lasting(c.yearly)} of 2,000 at ${c.yearly}`);
  assert.ok(lasting(c.yearly + 100) < 1800, `$100 more lasts in only ${lasting(c.yearly + 100)}`);
  assert.equal(c.rate, lasting(c.yearly) / 2000);
  // the plan's own spending, on the same paths: exactly the Chance page's share for a steady-spending plan
  assert.equal(c.planned, lasting(110100) / 2000);
  const page = mcCompute(plan, { today: "2026-11-02", paths: 2000, careful: false });
  assert.equal(c.planned, page.successRate, "the Chance page says the same");
  // so a plan spending more than the careful figure is below 9 of 10, and one spending it is at or above
  assert.ok(c.yearly < 110100 && c.planned < 0.9, `${c.yearly}: the old $110,100 lasts in ${c.planned}`);
  const atIt = retirementPlan(); atIt.retirement.spendingMonthly = c.yearly / 12;
  assert.ok(spendingAtChance(buildInputs(atIt, { today: "2026-11-02" }).inputs).planned >= 0.9, "spending exactly the careful figure: at least 9 of 10");
  // every page gets the same figure, whatever number of paths it runs for itself
  assert.equal(mcCompute(plan, { today: "2026-11-02", paths: 100 }).careful.yearly, c.yearly);
  assert.equal(mcCompute(plan, { today: "2026-11-02", paths: 2000 }).careful.yearly, c.yearly);
});

test("another withdrawal rule: the planned share is steady spending at the plan's amount, not the rule's own chance", async () => {
  const { compute: mcCompute } = await import("./compute.js");
  const plan = retirementPlan(); plan.retirement.spendingMonthly = 11000; plan.retirement.strategy = "percent";
  const mc = mcCompute(plan, { today: "2026-11-02", paths: 2000 });
  assert.equal(mc.successRate, 1, "a set share of what is left never runs out");
  assert.ok(mc.careful.planned < 0.5, `$132,000 spent steadily lasts in only ${mc.careful.planned}`);
  const steady = retirementPlan(); steady.retirement.spendingMonthly = 11000;
  assert.equal(mc.careful.yearly, mcCompute(steady, { today: "2026-11-02", paths: 100 }).careful.yearly, "the careful figure is steady spending either way");
});

test("leaving money at the end: the careful figure for that goal, below the one that only lasts", async () => {
  const { spendingAtChance, drawSequences } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { project } = await import("../../../core/math/retirement.js");
  const I = buildInputs(retirementPlan(), { today: "2026-11-02" }).inputs;
  const plain = spendingAtChance(I), keep = spendingAtChance(I, { legacy: 500000 });
  assert.ok(keep.yearly > 0 && keep.yearly < plain.yearly, `${keep.yearly} < ${plain.yearly}`);
  const seqs = drawSequences(2000, I.endYear - I.startYear + 1, { stocks: I.returns.stocks, bonds: I.returns.bonds, stdevStocks: I.stdev.stocks, stdevBonds: I.stdev.bonds, seed: 1 });
  const leaves = (s) => seqs.filter((q) => { const r = project({ ...I, strategy: "fixed-real", spending: { yearly: s } }, { sequence: q }); return r.success && r.endBalanceReal >= 500000 - 0.5; }).length;
  assert.ok(leaves(keep.yearly) >= 1800 && leaves(keep.yearly + 100) < 1800);
});

test("nothing lasts in 9 of 10 markets even spending nothing: the careful figure is $0", async () => {
  const { spendingAtChance } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  // a partner's pay taxed from $500 of savings (core/math/retirement.js: income above spending does not pay its own tax yet)
  const p = retirementPlan(); p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 500 }]; p.retirement.contributions = []; p.retirement.pensions = []; p.retirement.taxMode = "brackets";
  const c = spendingAtChance(buildInputs(p, { today: "2026-11-02" }).inputs);
  assert.equal(c.yearly, 0); assert.ok(c.rate < 0.9, `even $0 lasts in only ${c.rate}`); assert.ok(c.planned <= c.rate, "the planned spending lasts no more often than spending nothing");
});

test("a slice at a time: carefulSteps yields between runs and ends on the same answer; the search costs about 4,000 runs", async () => {
  const { spendingAtChance, carefulSteps } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  for (const plan of [retirementPlan(), familyPlan("2026-11-02")]) {
    const I = buildInputs(plan, { today: "2026-11-02" }).inputs;
    const it = carefulSteps(I, { slice: 50 });
    let r, yields = 0;
    while (!(r = it.next()).done) yields++;
    const c = spendingAtChance(I);
    assert.deepEqual(r.value, c);
    assert.ok(yields > 40, `${yields} slices`);
    assert.ok(c.runs < 5000, `${c.runs} runs of the projection`);
  }
});

test("the monthly careful figure never adds up to more than the yearly one (whole $100s, rounded down)", async () => {
  const { monthlyOf } = await import("../careful.js");
  assert.equal(monthlyOf(110100), 9100); assert.equal(monthlyOf(369300), 30700); assert.equal(monthlyOf(90000), 7500); assert.equal(monthlyOf(1100), 0);
  for (const y of [100, 1200, 59900, 110100, 369300]) assert.ok(monthlyOf(y) * 12 <= y);
});
