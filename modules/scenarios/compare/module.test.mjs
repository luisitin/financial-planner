import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, applyChanges, results, describe, LEVERS, MAX_SCENARIOS } from "./compute.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { project } from "../../../core/math/retirement.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("every lever reads the plan's own value; plan levers set, input levers apply", () => {
  const p = familyPlan(TODAY);
  for (const lv of LEVERS) assert.ok(typeof lv.get === "function", lv.key);
  assert.equal(LEVERS.find((l) => l.key === "retireAge").get(p, "p-ana"), 65);
  assert.equal(LEVERS.find((l) => l.key === "claimAge").get(p, "p-bo"), 67);
  assert.equal(LEVERS.find((l) => l.key === "spendingMonthly").get(p), 7000);
});

test("applyChanges: a copy of the plan, the original untouched; the engine inputs follow", () => {
  const p = familyPlan(TODAY);
  const before = JSON.stringify(p);
  const a = applyChanges(p, { "retireAge:p-ana": 60, spendingMonthly: 6000, extraSavingMonthly: 500, fee: 0.01, lumpSum: 50000, lumpYear: 2030 }, { today: TODAY });
  assert.equal(JSON.stringify(p), before);
  const base = buildInputs(p, { today: TODAY }).inputs;
  assert.equal(a.inputs.people[0].retireAge, 60); assert.equal(a.inputs.spending.yearly, 72000);
  assert.ok(a.inputs.contributions.some((c) => c.bucket === "taxable" && c.yearly === 6000));
  near(a.inputs.returns.stocks, base.returns.stocks - 0.01); near(a.inputs.returns.bonds, base.returns.bonds - 0.01);
  assert.deepEqual(a.inputs.events.at(-1), { year: 2030, amount: -50000, label: "one-time" });
  assert.equal(applyChanges(emptyPlan(), {}, { today: TODAY }).inputs, null);
});

test("results: the projection's own figures; the chance over simulated markets", () => {
  const I = buildInputs(familyPlan(TODAY), { today: TODAY }).inputs;
  const r = results(I, { paths: 50 });
  const p = project(I);
  assert.equal(r.success, p.success); near(r.endReal, p.endBalanceReal);
  assert.ok(r.chance >= 0 && r.chance <= 1); assert.equal(results(I, { paths: 0 }).chance, null);
});

test("describe: plain words for each change", () => {
  const p = familyPlan(TODAY);
  assert.deepEqual(describe(p, { "retireAge:p-ana": 60, extraSavingMonthly: 500, fee: 0.01, lumpSum: -20000, lumpYear: 2031, inflation: 0.035, spendingMonthly: "" }),
    ["Ana retires at 60", "save $500 more a month", "fees of 1% a year", "$20,000 is spent in 2031", "prices rise 3.5% a year"]);
});

test("the family's scenarios: retiring earlier and paying fees cost, saving more gains; at most four", () => {
  const p = familyPlan(TODAY);
  p.scenarios = [
    { id: "a", name: "60", changes: { "retireAge:p-ana": 60, "retireAge:p-bo": 60 } },
    { id: "b", name: "save", changes: { extraSavingMonthly: 500 } },
    { id: "c", name: "fee", changes: { fee: 0.01 } },
    { id: "d", name: "none", changes: {} },
    { id: "e", name: "fifth", changes: {} },
  ];
  const d = compute(p, { today: TODAY, paths: 60 });
  assert.equal(d.ready, true); assert.equal(d.scenarios.length, MAX_SCENARIOS);
  const by = Object.fromEntries(d.scenarios.map((s) => [s.id, s.results]));
  assert.ok(by.a.affordableMonthly < d.base.affordableMonthly); assert.ok(by.b.affordableMonthly > d.base.affordableMonthly); assert.ok(by.c.endReal < d.base.endReal);
  near(by.d.endReal, d.base.endReal);
  assert.equal(d.current["retireAge:p-bo"], 62);
});

test("review 2026-11-02: a spending figure typed in a scenario is a typed figure, even when the plan's is Get started's own", async () => {
  const { retireDefault } = await import("../../overview/setup/compute.js");
  const p = familyPlan(TODAY);
  p.expenses.push({ id: "hi", name: "Health insurance", category: "health", amount: 600, period: "monthly", essential: true, inflates: true });
  p.retirement.spendingMonthly = retireDefault(p, TODAY); p.guide = { setup: { retireAuto: true } };
  assert.equal(p.retirement.spendingMonthly, 5170);
  // the plan: Get started's figure less the $600 premium (the health line pays cover); was the scenario's $6,000 less $600 too
  const a = applyChanges(p, { spendingMonthly: 6000 }, { today: TODAY });
  near(a.inputs.spending.yearly, 72000); assert.equal(a.plan.guide.setup.retireAuto, false);
  assert.equal(p.guide.setup.retireAuto, true, "the plan itself is untouched");
  assert.equal(results(a.inputs, { paths: 0 }).spendingMonthly, 6000);
  // "Spend 10% less" and the editor start from what the plan spends before health cover ($4,570), not the saved $5,170
  const d = compute(p, { today: TODAY, paths: 0 });
  near(d.base.spendingMonthly, 4570); assert.equal(d.current.spendingMonthly, 4570);
  const less = applyChanges(p, { spendingMonthly: Math.round(d.current.spendingMonthly * 0.9 / 10) * 10 }, { today: TODAY });
  assert.ok(less.inputs.spending.yearly < buildInputs(p, { today: TODAY }).inputs.spending.yearly, "10% less is less");
});


// stress test 2026-11-11, W7: the plan read 78% on Compare and 80% on Chance the money lasts
test("W7: the plan and every copy meet one shared draw of pretend years; a copy changing nothing scores as the plan", async () => {
  const { drawShocks, shapeSequences, drawSequences } = await import("../../retirement/monte-carlo/compute.js");
  // the split draw is the old draw, number for number
  const opts = { stocks: 0.07, bonds: 0.04, stdevStocks: 0.15, stdevBonds: 0.05 };
  assert.deepEqual(shapeSequences(drawShocks(5, 9, 3), opts), drawSequences(5, 9, { ...opts, seed: 3 }));
  const p = familyPlan(TODAY);
  p.scenarios = [{ id: "s0", name: "Nothing", changes: {} }, { id: "s1", name: "Fee", changes: { fee: 0.01 } }, { id: "s2", name: "Lower returns", changes: { returnStocks: 0.05 } }];
  const d = compute(p, { today: TODAY, paths: 120 });
  assert.equal(d.scenarios[0].results.chance, d.base.chance);
  // shared luck: a copy with lower returns can never last in a future where the plan ran out (same years, smaller returns)
  const I = buildInputs(p, { today: TODAY }).inputs, years = I.endYear - I.startYear + 1;
  const shocks = drawShocks(120, years, 1);
  const lo = applyChanges(p, { returnStocks: 0.05 }, { today: TODAY }).inputs;
  const sd = (X) => ({ stocks: X.returns.stocks, bonds: X.returns.bonds, stdevStocks: X.stdev.stocks, stdevBonds: X.stdev.bonds });
  const a = shapeSequences(shocks, sd(I)), b = shapeSequences(shocks, sd(lo));
  for (let i = 0; i < 120; i++) if (!project(I, { sequence: a[i] }).success) assert.equal(project(lo, { sequence: b[i] }).success, false, `path ${i}`);
  near(d.scenarios[2].results.chance, b.filter((s) => project(lo, { sequence: s }).success).length / 120);
  // no lever changes how many years a plan runs, so the shared draw is the Chance page's own draw (seed 1), first paths first
  const mc = shapeSequences(drawShocks(120, years, 1), sd(I));
  near(d.base.chance, mc.filter((s) => project(I, { sequence: s }).success).length / 120);
  assert.deepEqual(drawSequences(120, years, { ...sd(I), seed: 1 }), mc);
});

test("W7: chanceShown -- the Chance page's own figure for the plan when known, copies moved by their difference; else 'about', to the nearest 5", async () => {
  const { chanceShown } = await import("./compute.js");
  // known: the plan shows the Chance page's figure, a copy that figure plus its difference on the shared draw
  assert.deepEqual(chanceShown(0.78, null, 0.8), { value: 0.8, text: "80%", about: false });
  assert.deepEqual(chanceShown(0.78, 0.7, 0.8), { value: 0.72, text: "72%", about: false });
  assert.equal(chanceShown(0.5, 1, 0.9).text, "100%");
  assert.equal(chanceShown(0.5, 0, 0.3).text, "0%");
  // not known: "about", every column rounded to 5 points
  assert.deepEqual(chanceShown(0.78, null, null), { value: 0.8, text: "about 80%", about: true });
  assert.deepEqual(chanceShown(0.78, 0.715, null), { value: 0.7, text: "about 70%", about: true });
  // never "about 0%" or "about 100%" for a chance that is neither; exactly none or every future still says so
  assert.equal(chanceShown(0.012, null, null).text, "about 5%");
  assert.equal(chanceShown(0.975, null, null).text, "about 95%");
  assert.equal(chanceShown(0, null, null).text, "about 0%");
  assert.equal(chanceShown(1, null, null).text, "about 100%");
  // known: rounded as the Chance page's fmt.pct (28.5% is 29% there, so here too)
  for (const k of [290, 570, 1130, 1150]) assert.equal(chanceShown(0.5, null, k / 2000).text, `${Math.round(k / 20)}%`);
  assert.equal(chanceShown(null, null, 0.8).text, "-");
  assert.equal(chanceShown(0.5, null, null).value * 100 % 5, 0);
});

test("W7: Compare reads the Chance page's figure for this very plan, kept for the visit; a changed plan is not known", async () => {
  const { rememberChance, knownChance } = await import("../../retirement/careful.js");
  const plan = familyPlan(TODAY);
  let cur = plan;
  const ctx = { fmt: { today: () => TODAY }, store: { get: () => cur } };
  assert.equal(knownChance(ctx), null);
  rememberChance(ctx, { ready: true, successRate: 0.8, paths: 2000, seed: 1 });
  assert.equal(knownChance(ctx), 0.8);
  cur = JSON.parse(JSON.stringify(plan)); cur.retirement.spendingMonthly = (cur.retirement.spendingMonthly ?? 7000) + 500;
  assert.equal(knownChance(ctx), null);
  cur = plan;
  assert.equal(knownChance(ctx), 0.8);
  rememberChance(ctx, { ready: false });
  assert.equal(knownChance(ctx), 0.8);
  // an answer that comes back after the plan changed is kept for the plan it was sent for, not the new one
  const { chanceKey } = await import("../../retirement/careful.js");
  const sent = chanceKey(ctx);
  cur = JSON.parse(JSON.stringify(plan)); cur.retirement.spendingMonthly = (cur.retirement.spendingMonthly ?? 7000) + 900;
  rememberChance(ctx, { ready: true, successRate: 0.6, paths: 2000, seed: 1 }, sent);
  assert.equal(knownChance(ctx), null);
  cur = plan;
  assert.equal(knownChance(ctx), 0.6);
});

test("W7 page: 'about', to the nearest 5, until Chance the money lasts has run this plan; then that page's very figure", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { rememberChance } = await import("../../retirement/careful.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { compute: mc } = await import("../../retirement/monte-carlo/compute.js");
  const p = familyPlan("2026-10-31");
  p.scenarios = [{ id: "s1", name: "Pay a 1% advisor fee", changes: { fee: 0.01 } }];
  const opts = { computeRemote: { "scenarios/compare": (pl, prm) => compute(pl, { ...prm, paths: 100 }) } };
  const url = new URL("./view.js", import.meta.url).href;
  const before = (await renderPage(url, p, "2026-10-31", opts)).text();
  assert.match(before, /about \d*[05]%/);
  assert.match(before, /rounded to the nearest 5/);
  assert.match(before, /Chance the money lasts ›/);
  // the Chance page runs this same plan (as the store holds it) on this visit
  const m = migrate(structuredClone(p));
  const d = mc(m, { today: "2026-10-31", paths: 2000, seed: 1, careful: false });
  rememberChance({ fmt: { today: () => "2026-10-31" }, store: { get: () => m } }, d);
  const after = (await renderPage(url, p, "2026-10-31", opts)).text();
  assert.ok(!/about \d/.test(after), after.slice(0, 400));
  assert.ok(after.includes(`${Math.round(d.successRate * 100)}%`));
  assert.match(after, /Your plan's chance is the one from Chance the money lasts/);
});
