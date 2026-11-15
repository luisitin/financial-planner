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
  // the figure the pages show is settled on the plan spending it (carefulSettled, left2 fix round 1, M-1): the health line moves
  // with spending, so the first search on these inputs ($97,800 here) is not the figure a plan typing it gets (0.8985 of paths);
  // settled, $97,600, and a plan spending exactly that lasts in at least 9 of 10 (0.9005). This test used the first search,
  // `c.yearly`, for the two checks below; the page's figure is what a person types, so they use it now
  const shown = mcCompute(plan, { today: "2026-11-02", paths: 2000 }).careful;
  assert.ok(shown.yearly <= c.yearly && c.yearly - shown.yearly <= 1000, `settled ${shown.yearly} vs first search ${c.yearly}`);
  const atIt = retirementPlan(); atIt.retirement.spendingMonthly = shown.yearly / 12;
  assert.ok(spendingAtChance(buildInputs(atIt, { today: "2026-11-02" }).inputs).planned >= 0.9, "spending exactly the careful figure: at least 9 of 10");
  // every page gets the same figure, whatever number of paths it runs for itself
  assert.equal(mcCompute(plan, { today: "2026-11-02", paths: 100 }).careful.yearly, shown.yearly);
  assert.equal(shown.planned, c.planned, "the share at the plan's own spending is the first search's");
});

test("another withdrawal rule: the planned share is steady spending at the plan's amount, not the rule's own chance", async () => {
  const { compute: mcCompute } = await import("./compute.js");
  const plan = retirementPlan(); plan.retirement.spendingMonthly = 11000; plan.retirement.strategy = "percent";
  const mc = mcCompute(plan, { today: "2026-11-02", paths: 2000 });
  assert.equal(mc.successRate, 1, "a set share of what is left never runs out");
  assert.ok(mc.careful.planned < 0.5, `$132,000 spent steadily lasts in only ${mc.careful.planned}`);
  const steady = retirementPlan(); steady.retirement.spendingMonthly = 11000;
  // the health line (projection README, "Health cover on top of spending") is priced on the plan's own income, which the rule moves
  // (a set share takes out other amounts, so other income): with the same health line the careful figure is the same either way
  const { buildInputs } = await import("../projection/compute.js");
  const { spendingAtChance } = await import("./compute.js");
  const Ip = buildInputs(plan, { today: "2026-11-02" }).inputs, Is = buildInputs(steady, { today: "2026-11-02" }).inputs;
  assert.equal(mc.careful.yearly, spendingAtChance({ ...Is, events: Ip.events }).yearly, "the careful figure is steady spending either way");
  // and with no health line (the box "my spending figure already includes health cover") the two plans give one figure
  plan.retirement.healthIncluded = true; steady.retirement.healthIncluded = true;
  assert.equal(mcCompute(plan, { today: "2026-11-02", paths: 2000 }).careful.yearly, mcCompute(steady, { today: "2026-11-02", paths: 100 }).careful.yearly);
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
    // (seventh pass, 2026-11-06: the family's search takes 5,176 runs, its Medicare now holding the Medigap Plan G default: the
    // first guess on the first paths lands one settling step further from the figure on all 2,000; it was 3,849)
    assert.ok(c.runs < 6000, `${c.runs} runs of the projection`);
  }
});

test("the monthly careful figure never adds up to more than the yearly one (whole $100s, rounded down)", async () => {
  const { monthlyOf } = await import("../careful.js");
  assert.equal(monthlyOf(110100), 9100); assert.equal(monthlyOf(369300), 30700); assert.equal(monthlyOf(90000), 7500); assert.equal(monthlyOf(1100), 0);
  for (const y of [100, 1200, 59900, 110100, 369300]) assert.ok(monthlyOf(y) * 12 <= y);
});

// ---------------------------------------------------------------- gap #17 (2026-11-13): how careful the answer is; my own "strong" and "fair"
const T17 = "2026-11-13";
const withA = (plan, a) => { const p = structuredClone(plan); p.assumptions = { ...(p.assumptions ?? {}), ...a }; return p; };

test("gap #17: the careful chance is the plan's own, 9 in 10 when it is not set or not a chance worth planning to", async () => {
  const { carefulChanceOf, CAREFUL_CHANCE, CAREFUL_CHOICES } = await import("./compute.js");
  assert.equal(CAREFUL_CHANCE, 0.9);
  assert.deepEqual(CAREFUL_CHOICES, [0.75, 0.9, 0.95]);
  assert.equal(carefulChanceOf(emptyPlan()), 0.9);
  assert.equal(carefulChanceOf({}), 0.9); assert.equal(carefulChanceOf(null), 0.9);
  for (const c of [0.75, 0.95, 0.6, 0.99, 0.8]) assert.equal(carefulChanceOf(withA(emptyPlan(), { carefulChance: c })), c);
  // below a coin toss is not careful; 100% has no figure; text or nothing is not a chance
  for (const bad of [0.4, 1, 1.5, -0.1, "0.95", null, NaN]) assert.equal(carefulChanceOf(withA(emptyPlan(), { carefulChance: bad })), 0.9, String(bad));
});

test("gap #17: the careful spending at 19 in 20 is no more than at 9 in 10, which is no more than at 3 in 4", async () => {
  const { spendingAtChance } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  for (const plan of [retirementPlan(), familyPlan(T17)]) {
    const I = buildInputs(plan, { today: T17 }).inputs;
    const [a, b, c] = [0.95, 0.9, 0.75].map((chance) => spendingAtChance(I, { chance }));
    assert.ok(a.yearly <= b.yearly && b.yearly <= c.yearly, `${a.yearly} <= ${b.yearly} <= ${c.yearly}`);
    assert.ok(a.yearly < c.yearly, "the choice moves the figure");
    assert.equal(a.chance, 0.95); assert.equal(c.chance, 0.75);
    assert.ok(a.rate >= 0.95 && c.rate >= 0.75, `${a.rate}, ${c.rate}: each lasts in at least its own share`);
  }
});

test("gap #17: compute() works the careful figure to the plan's own chance; with none set it is the old call, byte for byte", async () => {
  const { compute: mc, settledAtChance } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const plan = retirementPlan();
  const old = mc(plan, { today: T17, paths: 100 }).careful;
  assert.equal(JSON.stringify(old), JSON.stringify(settledAtChance(plan, (q) => buildInputs(q, { today: T17, paths: 100 }).inputs ?? null, { seed: 1, legacy: 0, sequences: null })));
  assert.equal(old.chance, 0.9);
  const more = mc(withA(plan, { carefulChance: 0.95 }), { today: T17, paths: 100 }).careful;
  assert.equal(more.chance, 0.95);
  assert.ok(more.yearly < old.yearly, `${more.yearly} < ${old.yearly}`);
  assert.equal(JSON.stringify(mc(withA(plan, { carefulChance: 0.9 }), { today: T17, paths: 100 }).careful), JSON.stringify(old), "9 in 10 typed is the same as nothing typed");
});

test("gap #17: the lines for strong and fair move the verdict; out-of-range lines fall back to 85 and 70", async () => {
  const { verdictOf, linesOf, GOOD_CHANCE, OK_CHANCE, compute: mc } = await import("./compute.js");
  assert.equal(GOOD_CHANCE, 0.85); assert.equal(OK_CHANCE, 0.7);
  assert.deepEqual(linesOf(emptyPlan()), { good: 0.85, ok: 0.7 });
  assert.deepEqual(linesOf(withA(emptyPlan(), { goodChance: 0.95, okChance: 0.8 })), { good: 0.95, ok: 0.8 });
  assert.deepEqual(linesOf(withA(emptyPlan(), { goodChance: 0.6 })), { good: 0.6, ok: 0.6 }, "fair never above strong");
  assert.deepEqual(linesOf(withA(emptyPlan(), { goodChance: 2, okChance: 0 })), { good: 0.85, ok: 0.7 });
  assert.equal(verdictOf(0.86), "strong"); assert.equal(verdictOf(0.85), "strong"); assert.equal(verdictOf(0.849), "fair"); assert.equal(verdictOf(0.7), "fair"); assert.equal(verdictOf(0.69), "weak");
  assert.equal(verdictOf(0.86, { good: 0.95, ok: 0.8 }), "fair");
  assert.equal(verdictOf(0.75, { good: 0.95, ok: 0.8 }), "weak");
  assert.equal(verdictOf(0.62, { good: 0.6, ok: 0.5 }), "strong");
  // through compute(): the family's own chance (about 80 of 100) is fair at the usual lines, strong at 75, weak at 90 and 85
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const fam = familyPlan(T17);
  const base = mc(fam, { today: T17, paths: 200, careful: false });
  assert.ok(base.successRate >= 0.7 && base.successRate < 0.85, `${base.successRate}`);
  assert.equal(base.verdict, "fair");
  assert.equal(mc(withA(fam, { goodChance: base.successRate - 0.01 }), { today: T17, paths: 200, careful: false }).verdict, "strong");
  assert.equal(mc(withA(fam, { goodChance: 0.95, okChance: Math.min(0.94, base.successRate + 0.01) }), { today: T17, paths: 200, careful: false }).verdict, "weak");
  // the lines move only the verdict
  const moved = mc(withA(fam, { goodChance: 0.5, okChance: 0.4 }), { today: T17, paths: 200, careful: false });
  assert.equal(JSON.stringify({ ...moved, verdict: base.verdict }), JSON.stringify(base));
});

test("gap #17: the words for a chance, and the note beside 'even in a bad run of years'", async () => {
  const { inWords, badRunNote, perHundred } = await import("./compute.js");
  const { BAD_RUN_NOTE } = await import("../odds.js");
  assert.equal(inWords(0.75), "3 in 4"); assert.equal(inWords(0.9), "9 in 10"); assert.equal(inWords(0.95), "19 in 20");
  assert.equal(inWords(0.8), "4 in 5"); assert.equal(inWords(0.85), "17 in 20"); assert.equal(inWords(0.99), "99 in 100"); assert.equal(inWords(0.6), "3 in 5");
  assert.equal(inWords(0.95, "of"), "19 of 20");
  assert.equal(badRunNote(0.9), BAD_RUN_NOTE, "9 in 10: the words every page says today");
  assert.equal(badRunNote(), BAD_RUN_NOTE);
  assert.equal(badRunNote(0.95), "(only 1 in 20 is worse)");
  assert.equal(badRunNote(0.75), "(only 1 in 4 is worse)");
  assert.equal(badRunNote(0.8), "(only 1 in 5 is worse)");
  assert.equal(badRunNote(0.85), "(only 3 in 20 are worse)");
  assert.equal(badRunNote(0.99), "(only 1 in 100 is worse)");
  // a share in whole hundredths, rounded down, never 100 unless every one: 580 of 2,000 is 29, not 28 (0.29 * 100 is 28.999...)
  assert.equal(perHundred(0.29), 29); assert.equal(perHundred(580 / 2000), 29); assert.equal(perHundred(0.999), 99); assert.equal(perHundred(1), 100); assert.equal(perHundred(0.0049), 0); assert.equal(perHundred(0.93), 93);
});

test("gap #17: the figure a page asks for at the plan's own chance is the computer's for the plan, one figure (careful.js)", async () => {
  const careful = await import("../careful.js");
  const fmt = await import("../../../core/format.js");
  const { compute: mc } = await import("./compute.js");
  assert.equal(careful.carefulChanceOf(withA(emptyPlan(), { carefulChance: 0.95 })), 0.95, "the reader goes through careful.js");
  assert.equal(careful.badRunNote(0.95), "(only 1 in 20 is worse)");
  const ctxOf = (plan) => ({ fmt: { ...fmt, today: () => T17 }, store: { get: () => plan } });
  const el = { isConnected: true };
  const viaPage = (plan, legacy = 0) => new Promise((done) => careful.whenCareful(ctxOf(plan), el, done, { legacy, chance: careful.carefulChanceOf(plan) }));
  const plan = withA(retirementPlan(), { carefulChance: 0.95 });
  const here = await viaPage(plan);
  // the computer's answer (a page with the computer connected asks it for the same compute) and this device's agree
  assert.deepEqual(here, mc(plan, { today: T17, paths: 100 }).careful);
  assert.equal(here.chance, 0.95);
  // the answer is kept by the plan and the chance asked for: 9 in 10 is another answer, and its key is the one it always was
  const usual = retirementPlan();
  assert.notEqual(careful.carefulKey(ctxOf(plan), { chance: 0.95 }), careful.carefulKey(ctxOf(usual)));
  assert.equal(careful.carefulKey(ctxOf(usual)), careful.keyOf(["careful", T17, 0, (await import("../projection/compute.js")).buildInputs(usual, { today: T17 }).inputs]));
  assert.deepEqual(careful.knownAnswer(careful.carefulKey(ctxOf(plan), { chance: 0.95 })), here);
  // a page drawn with a store that cannot be read (a module test's stand-in) still gets a key, the one it always got
  assert.equal(careful.carefulKey({ fmt: { ...fmt, today: () => T17 }, store: {} }), careful.keyOf(["careful", T17, 0, null]));
  const back = await viaPage(usual);
  assert.equal(back.chance, 0.9);
  assert.ok(here.yearly < back.yearly);
});

// critic of g34 (2026-11-13), finding 1: with 19 in 20 chosen, Will the money last? said "(only 1 in 10 is worse)" beside
// $76,500, the figure worked to 19 in 20. A page is handed a figure worked to another chance only when it asks for it (and so
// says that chance in words, badRunNote); every other page keeps the 9 in 10 figure its words describe.
test("g34 critic 1: a page whose words say 1 in 10 gets the 9 in 10 figure; the Chance page asks for the plan's own chance", async () => {
  const careful = await import("../careful.js");
  const { api } = await import("../../../core/api.js");
  const fmt = await import("../../../core/format.js");
  const { compute: mc } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const usual = familyPlan(T17), plan = withA(usual, { carefulChance: 0.95 });
  const ctxOf = (p, { day = T17, backend = "local" } = {}) => ({ fmt: { ...fmt, today: () => day }, store: { get: () => p, backend: () => backend } });
  const el = { isConnected: true };
  const ask = (p, opts, how) => new Promise((done) => careful.whenCareful(ctxOf(p, how), el, done, opts));
  // Will the money last?, How much to take out, Required withdrawals and Goal seek ask without a chance: 9 in 10, as they say
  const plain = await ask(plan, {});
  assert.equal(plain.chance, 0.9);
  assert.deepEqual(plain, await ask(usual, {}), "the same figure as a plan that chose nothing");
  assert.equal(careful.carefulKey(ctxOf(plan)), careful.carefulKey(ctxOf(usual)), "and the usual key, so an answer remembered for a page is the 9 in 10 one");
  // the Chance page asks for the plan's own chance, and says it in words (badRunNote)
  const own = await ask(plan, { chance: careful.carefulChanceOf(plan) });
  assert.equal(own.chance, 0.95);
  assert.equal(own.yearly, 76500, "the family's figure at 19 in 20 (README)");
  assert.equal(plain.yearly, 79700, "and at 9 in 10");
  assert.notEqual(careful.carefulKey(ctxOf(plan), { chance: 0.95 }), careful.carefulKey(ctxOf(plan)));
  assert.equal(careful.carefulKey(ctxOf(plan), { chance: 0.9 }), careful.carefulKey(ctxOf(plan)), "9 in 10 asked is 9 in 10 by default");
  // a chance that is not one to plan to is the usual 9 in 10
  for (const bad of [0.4, 1, "0.95", NaN]) assert.equal(careful.carefulKey(ctxOf(plan), { chance: bad }), careful.carefulKey(ctxOf(plan)), String(bad));
  // with the computer connected the chance asked for goes with the run, so the PC works the figure the page says; compute()
  // takes `chance` before the plan's own (another day: nothing remembered answers first)
  const sent = [];
  const was = api.compute;
  api.compute = async (key, params, p) => { sent.push({ key, params }); return mc(p, params); };
  try {
    const day = "2026-11-14";
    const pcPlain = await ask(plan, {}, { day, backend: "server" });
    const pcOwn = await ask(plan, { chance: 0.95 }, { day, backend: "server" });
    assert.deepEqual(sent.map((x) => [x.key, x.params.chance]), [["retirement/monte-carlo", 0.9], ["retirement/monte-carlo", 0.95]]);
    assert.equal(pcPlain.chance, 0.9); assert.equal(pcOwn.chance, 0.95);
    assert.ok(pcOwn.yearly < pcPlain.yearly, `${pcOwn.yearly} < ${pcPlain.yearly}`);
  } finally { api.compute = was; }
  assert.equal(mc(plan, { today: T17, paths: 100, chance: 0.9 }).careful.chance, 0.9);
  assert.equal(mc(plan, { today: T17, paths: 100 }).careful.chance, 0.95, "with no chance asked, compute() reads the plan's");
});

test("g34 critic 1: a page that asks for the plan's own careful chance says it in words, never odds.js's fixed '1 in 10'", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = new URL("../../", import.meta.url).pathname;
  const views = [];
  for (const g of fs.readdirSync(root)) {
    const gd = path.join(root, g);
    if (!fs.statSync(gd).isDirectory()) continue;
    for (const id of fs.readdirSync(gd)) { const f = path.join(gd, id, "view.js"); if (fs.existsSync(f)) views.push([`${g}/${id}`, fs.readFileSync(f, "utf8")]); }
  }
  const users = views.filter(([, src]) => /whenCareful\(/.test(src));
  assert.ok(users.length >= 5, users.map(([k]) => k).join(", "));
  const asks = users.filter(([, src]) => /carefulChanceOf|carefulChance\b/.test(src));
  assert.ok(asks.some(([k]) => k === "retirement/monte-carlo"), "this page asks for the plan's chance");
  for (const [k, src] of asks) assert.ok(!/BAD_RUN_NOTE/.test(src) && /badRunNote\(/.test(src), `${k}: the chance it asks for, in words`);
});

test("gap #17 invariance: with no careful chance and no lines, compute() is what it was over the qa households and the fixture plans", async () => {
  const { compute: mc, settledAtChance } = await import("./compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const KEYS = ["ready", "paths", "successRate", "medianEndReal", "failAges", "bands", "byAge", "verdict", "retireYear", "endYear", "spendingYearly", "seed", "careful"];
  const fixtures = [["family", familyPlan(T17)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["retirement", retirementPlan()]];
  const plans = [...fixtures, ["empty", emptyPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.equal(plans.length, 19);
  const defaults = { carefulChance: 0.9, goodChance: 0.85, okChance: 0.7 };
  for (const [name, p0] of plans) {
    const p = migrate(structuredClone(p0));
    for (const k of Object.keys(defaults)) assert.equal(p.assumptions[k], undefined, `${name}: migrate adds no ${k}`);
    const heavy = fixtures.some(([n]) => n === name);
    const o = { today: T17, paths: 200, careful: heavy };
    const d = mc(p, o);
    if (!d.ready) { assert.equal(JSON.stringify(mc(withA(p, defaults), o)), JSON.stringify(d), name); continue; }
    assert.deepEqual(Object.keys(d), KEYS, name);
    // the old verdict rule, 85 and 70
    assert.equal(d.verdict, d.successRate >= 0.85 ? "strong" : d.successRate >= 0.7 ? "fair" : "weak", name);
    // the old careful call, without a chance
    if (heavy) assert.equal(JSON.stringify(d.careful), JSON.stringify(settledAtChance(p, (q) => buildInputs(q, o).inputs ?? null, { seed: 1, legacy: 0, sequences: null })), name);
    else assert.equal(d.careful, null, name);
    // the usual figures typed in are the same as none typed (the careful figure with 9 in 10 typed: the test above)
    assert.equal(JSON.stringify(mc(withA(p, defaults), { ...o, careful: false })), JSON.stringify({ ...d, careful: null }), `${name}: the usual figures typed`);
  }
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM (simple first, opt C14)
const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
// a browser writes "null" for a null handed to append(); the stand-in skips it, so here it fails instead
const appendOf = FakeElement.prototype.append;
FakeElement.prototype.append = function (...ns) {
  if (ns.some((n) => n === null || n === undefined)) throw new Error(`append(${ns.map((n) => (n === null || n === undefined ? String(n) : typeof n)).join(", ")}): a browser would write "${String(ns.find((n) => n == null))}"`);
  return appendOf.apply(this, ns);
};
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const view = await import("./view.js");
const settle = () => new Promise((r) => setTimeout(r, 0));
/** Draw the page as the shell does: store.update keeps the draft and draws again; the computer's run is this compute at 200 pretend futures. */
async function page(plan0, { query = {} } = {}) {
  let plan = migrate(structuredClone(plan0));
  const s = { saved: [], root: null, runs: [] };
  const ctx = () => ({ ui, fmt: { ...fmt, today: () => T17 }, plan, view: { build: false }, module: { group: "retirement", id: "monte-carlo" },
    route: { group: "retirement", id: "monte-carlo", rest: [], query },
    store: { get: () => plan, backend: () => "local", update: (fn) => { const d = structuredClone(plan); fn(d); s.saved.push(d); plan = d; draw(); } },
    computeRemote: async (key, params) => { s.runs.push({ key, params }); return compute(plan, { ...params, paths: 200 }); },
    redraw: () => draw() });
  const draw = () => { s.root = new FakeElement("main"); view.render(s.root, ctx()); };
  draw();
  await settle();
  s.plan = () => plan;
  s.settle = settle;
  return s;
}
const everything = (el) => [el, ...el.all()];
const partsOf = (root) => everything(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const opened = (d) => d.hasAttribute("open");
const titleOf = (d) => d.querySelector(".fold-title").textContent;
const statusOf = (d) => d.querySelector(".fold-status")?.textContent ?? "";
const rowsOf = (root) => partsOf(root).map((p) => [p.dataset.part, p.dataset.kind, titleOf(p), statusOf(p), opened(p)]);
/** The words a person sees without opening anything: a shut part shows only its summary. */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !opened(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/​/g, "").replace(/\s+/g, " ").trim();
}
const chipOf = (root, words) => everything(root).find((e) => e.tagName === "BUTTON" && e.className.includes("chip") && e.textContent === words) ?? null;
const formWith = (root, name) => everything(root).find((e) => e.tagName === "FORM" && e.querySelector(`[name="${name}"]`)) ?? null;
function fill(form, values) {
  for (const [k, v] of Object.entries(values)) form.querySelector(`[name="${k}"]`).value = v;
  form.dispatch("submit");
}

test("simple first (R3 to R5): one written sentence per case under the answer, the person's own lines named when set", () => {
  const usual = { good: 0.85, ok: 0.7 }, high = { good: 0.95, ok: 0.8 }, low = { good: 0.75, ok: 0.6 };
  const cases = [
    [1, usual, "every", "100 of 100", "Strong: the money lasted in every pretend future."],
    [0.93, usual, "strong", "93 of 100", "Strong: the money lasted in nearly every pretend future."],
    [0.8, usual, "fair", "80 of 100", "Fair: it lasted in most pretend futures, but not all. A little less spending or a little more saving moves this a lot."],
    [0.5, usual, "weak", "50 of 100", "Weak: it ran out in many pretend futures. Look at spending, the retirement age and Social Security timing."],
    [0.003, usual, "weak", "under 1 of 100", "Weak: it ran out in many pretend futures. Look at spending, the retirement age and Social Security timing."],
    [0, usual, "none", "0 of 100", "Weak: the money ran out in every pretend future. Look at spending, the retirement age and Social Security timing."],
    [0.8, low, "strongOwn", "80 of 100", "Strong: that is at or above the 75 of 100 you call strong."],
    [0.86, high, "fairOwn", "86 of 100", "Fair: under the 95 of 100 you call strong, at or above the 80 you call fair. A little less spending or a little more saving moves this a lot."],
    [0.75, high, "weakOwn", "75 of 100", "Weak: under the 80 of 100 you call fair. Look at spending, the retirement age and Social Security timing."],
    [1, high, "every", "100 of 100", "Strong: the money lasted in every pretend future."],
  ];
  for (const [successRate, lines, key, value, lede] of cases) {
    assert.deepEqual(view.answerFor({ successRate, endYear: 2085 }, lines), { key, value, label: "pretend futures where the money lasts to 2085", lede }, `${key} ${successRate}`);
  }
});

test("simple first: the first view is the answer and one card of three quiet rows; every figure moved, none deleted", async () => {
  const s = await page(retirementPlan());
  const t = seen(s.root);
  const d = compute(migrate(retirementPlan()), { today: T17, paths: 200, careful: false });
  const a = view.answerFor(d, { good: 0.85, ok: 0.7 });
  // the how row says it holds the file (n1 fix P3: "How this is done" gave no hint of one)
  assert.equal(t, `Chance the money lasts ${a.value} ${a.label} ${a.lede} 8 more numbers › How the pretend futures end › Set my own numbers 9 in 10 › How this is done with a spreadsheet ›`);
  assert.deepEqual(rowsOf(s.root), [["numbers", "more", "8 more numbers", "", false], ["endings", "more", "How the pretend futures end", "", false], ["careful", "own", "Set my own numbers", "9 in 10", false], ["how", "how", "How this is done", view.FILE_SAYS, false]]);
  assert.equal(view.FILE_SAYS, "with a spreadsheet");
  assert.equal(everything(s.root).filter((e) => e.dataset?.parts !== undefined).length, 1, "the parts are rows of one card");
  assert.ok(!everything(s.root).some((e) => e.tagName === "DETAILS" && !e.dataset.part && !e.className.includes("form-more")), "no hand-written fold");
  // inside the parts: the tiles, the range, still funded at, the way it is done (the lede moved here), the number of pretend futures
  const all = (id) => seen(partOf(s.root, id).querySelector(".fold-body"));
  assert.match(all("numbers"), /^\$[\d,]+ Typical amount left at \d{4}, today's dollars \(the middle pretend future\) (age \d+ When it ran out|never Ran out in any pretend future)/);
  assert.match(all("numbers"), /The range of outcomes, in today's dollars .* Still funded at\.\.\. Age 70 \(\d{4}\)/);
  assert.match(all("how"), /^Your plan was tried thousands of times, each a pretend future/);
  assert.match(all("how"), /so the answer does not change when you reopen the page/);
  assert.match(all("how"), /We call the chance strong from 85 of 100 and fair from 70; under that it is weak\./);
  // the number of pretend futures is chosen in How this is done, by three chips: no box in the parts card (S15, R30, R32)
  assert.match(all("how"), /How many pretend futures to try: 1,000 \(quick\) 2,000 10,000 A spreadsheet file \(CSV\) with one row for each of the 200 pretend futures: .* About \d+ KB\. Save all 200 pretend futures as a spreadsheet$/);
  // the button says the page's word and how many (n1 fix P3: it said "Save every run as a file")
  assert.deepEqual([view.saveWords(2000), view.saveWords(10000), view.saveWords(1000)], ["Save all 2,000 pretend futures as a spreadsheet", "Save all 10,000 pretend futures as a spreadsheet", "Save all 1,000 pretend futures as a spreadsheet"]);
  assert.equal(chipOf(s.root, "2,000").getAttribute("aria-pressed"), "true");
  assert.ok(!everything(everything(s.root).find((e) => e.dataset?.parts !== undefined)).some((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && !e.closest("form")), "no box in the parts card outside a form");
  // nothing changes in the plan by drawing it
  assert.equal(s.saved.length, 0);
});

test("simple first: while the plan is tried the page says so; a plan that cannot run says what it needs, with one filled way on", async () => {
  let plan = migrate(retirementPlan());
  const root = new FakeElement("main");
  let release;
  view.render(root, { ui, fmt: { ...fmt, today: () => T17 }, plan, view: { build: false }, module: { group: "retirement", id: "monte-carlo" }, route: { group: "retirement", id: "monte-carlo", rest: [], query: {} },
    store: { get: () => plan, backend: () => "local", update() {} }, computeRemote: () => new Promise((r) => { release = r; }) });
  assert.equal(seen(root), "Chance the money lasts Trying your plan 2,000 times...");
  release(null);
  const e = await page(emptyPlan());
  assert.match(seen(e.root), /^Chance the money lasts First, the plan needs /);
  assert.equal(partsOf(e.root).length, 0);
  assert.equal(everything(e.root).filter((x) => x.tagName === "A" && x.className === "btn").length, 1, "one filled way on");
});

test("gap #17 (R7, R17): a chip saves how careful at once, the green line names it, the part stays open; 9 in 10 takes the field away", async () => {
  const s = await page(retirementPlan(), { query: { show: "careful" } });
  assert.ok(opened(partOf(s.root, "careful")));
  const body = () => seen(partOf(s.root, "careful").querySelector(".fold-body"));
  assert.match(body(), /^How careful should the spending that lasts be\? It is the most you could spend each year and still have the money last in this many pretend futures\. 3 in 4 9 in 10 \(usual\) 19 in 20 Type my own/);
  assert.equal(chipOf(s.root, "9 in 10 (usual)").getAttribute("aria-pressed"), "true");
  chipOf(s.root, "19 in 20").dispatch("click");
  assert.equal(s.saved.length, 1);
  assert.equal(s.plan().assumptions.carefulChance, 0.95);
  await s.settle();
  const part = partOf(s.root, "careful");
  assert.ok(opened(part), "the part saved stays open (R17)");
  assert.deepEqual(rowsOf(s.root).map((r) => r[4]), [false, false, true, false], "no other part opens");
  assert.equal(statusOf(part), "1 set by you");
  assert.match(body(), /Saved\. The spending that lasts now has to last in 19 of 20 pretend futures\./);
  assert.equal(chipOf(s.root, "19 in 20").getAttribute("aria-pressed"), "true");
  // the figure it gives, in the words of its own chance (the same answer Will the money last? asks for)
  for (let i = 0; i < 400 && /Working out/.test(body()); i++) await new Promise((r) => setTimeout(r, 10));
  assert.match(body(), /Even in a bad run of years \(only 1 in 20 is worse\), the money can pay for about \$[\d,]+ a year \(\$[\d,]+ a month\)/);
  // back to the usual: the field goes, so the plan is as it was
  chipOf(s.root, "9 in 10 (usual)").dispatch("click");
  assert.equal("carefulChance" in s.plan().assumptions, false);
  await s.settle();
  assert.match(body(), /Saved\. The spending that lasts is back to the usual 9 of 10 pretend futures\./);
  assert.equal(statusOf(partOf(s.root, "careful")), "9 in 10");
});

test("gap #17: my own lines for strong and fair, under More details (optional); the green line says what the plan now reads", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await page(familyPlan(T17), { query: { show: "careful" } });
  const d = compute(migrate(familyPlan(T17)), { today: T17, paths: 200, careful: false });
  const n = Math.floor(d.successRate * 100 + 1e-9);
  assert.ok(d.verdict === "fair", d.verdict);
  const form = () => formWith(s.root, "goodChance");
  assert.ok(form().querySelector("details")?.className.includes("form-more"), "the two boxes wait under More details (optional)");
  assert.ok(!form().querySelector("details").hasAttribute("open"), "shut while nothing of the person's is in them");
  assert.match(seen(partOf(s.root, "careful").querySelector(".fold-body")), /We call the chance strong from 85 of 100 and fair from 70\. More details \(optional\)/);
  // fair under strong: held at the boxes, nothing saved
  fill(form(), { goodChance: "70", okChance: "80" });
  assert.equal(s.saved.length, 0);
  assert.match(seen(s.root), /The chance you call fair \(80 of 100\) has to be under the one you call strong \(70\)\./);
  // strong typed under the usual fair, fair left empty: the message names the 70 it would keep
  fill(form(), { goodChance: "65", okChance: "" });
  assert.equal(s.saved.length, 0);
  assert.match(seen(s.root), /The chance you call fair \(70 of 100\) has to be under the one you call strong \(65\)\./);
  // strong from 75: the family's chance now reads strong
  fill(form(), { goodChance: "75", okChance: "" });
  assert.equal(s.saved.length, 1);
  assert.equal(s.plan().assumptions.goodChance, 0.75); assert.equal("okChance" in s.plan().assumptions, false);
  await s.settle();
  assert.match(seen(s.root), new RegExp(`Saved\\. At ${n} of 100, your plan now reads strong\\.`));
  assert.match(seen(s.root), /Strong: that is at or above the 75 of 100 you call strong\./);
  assert.ok(opened(partOf(s.root, "careful")), "the part saved stays open");
  assert.ok(form().querySelector("details").hasAttribute("open"), "the boxes show what was saved");
  assert.equal(statusOf(partOf(s.root, "careful")), "1 set by you");
  assert.match(seen(partOf(s.root, "how").querySelector(".fold-body")), /We call the chance strong from 75 of 100 and fair from 70/);
  // Save again with the same figures: nothing changed, said plainly
  fill(form(), { goodChance: "75", okChance: "" });
  assert.equal(s.saved.length, 1);
  assert.match(seen(partOf(s.root, "careful")), /Nothing changed: strong is still from 75 of 100 and fair from 70\./);
  // both boxes emptied: the usual lines again, and the fields go
  fill(form(), { goodChance: "", okChance: "" });
  assert.equal("goodChance" in s.plan().assumptions, false);
  await s.settle();
  assert.match(seen(s.root), new RegExp(`Saved\\. At ${n} of 100, your plan now reads fair\\.`));
  assert.match(seen(s.root), /Fair: it lasted in most pretend futures, but not all\./);
});

test("gap #17: Save with nothing changed says so and saves nothing; my own chance typed shows as a chip of its own", async () => {
  const s = await page(retirementPlan(), { query: { show: "careful" } });
  const fold = formWith(s.root, "goodChance").querySelector(".form-more");
  fold.setAttribute("open", ""); fold.dispatch("toggle");
  fill(formWith(s.root, "goodChance"), { goodChance: "", okChance: "" });
  assert.equal(s.saved.length, 0);
  assert.match(seen(partOf(s.root, "careful")), /Nothing to save yet: type when you call it strong, fair or both\./);
  // "Type my own": one box in place; 80 is 4 in 5
  everything(s.root).find((e) => e.tagName === "BUTTON" && e.textContent === "Type my own").dispatch("click");
  const box = partOf(s.root, "careful").querySelector('[name="carefulChance"]');
  assert.ok(box, "the box shows in place");
  box.value = "80"; box.dispatch("change");
  assert.equal(s.plan().assumptions.carefulChance, 0.8);
  await s.settle();
  assert.equal(chipOf(s.root, "Yours: 4 in 5")?.getAttribute("aria-pressed"), "true");
  assert.match(seen(partOf(s.root, "careful")), /Saved\. The spending that lasts now has to last in 4 of 5 pretend futures\./);
  // out of range is held at the box by the kit (60 to 99), never saved
  everything(s.root).find((e) => e.tagName === "BUTTON" && e.textContent === "Type my own").dispatch("click");
  const b2 = partOf(s.root, "careful").querySelector('[name="carefulChance"]');
  b2.value = "40"; b2.dispatch("input"); b2.dispatch("change");
  assert.equal(s.plan().assumptions.carefulChance, 0.8);
});

// critic of g34 (2026-11-13), finding 2: with "More details (optional)" shut, a filled Save stood under no boxes, and a tap
// said "Nothing to save yet: open More details (optional) ...". The Save shows only with the boxes it saves.
test("g34 critic 2: my own lines' Save shows only with More details (optional) open; shut, no button stands under no boxes", async () => {
  const s = await page(retirementPlan(), { query: { show: "careful" } });
  const part = () => partOf(s.root, "careful");
  const form = () => formWith(s.root, "goodChance");
  const fold = () => form().querySelector(".form-more");
  // a browser draws .form-actions as a flex row whatever its `hidden` says (core/ui/base.css), so the row is put out of the
  // drawing itself (display: none), and out of what a screen reader reads (hidden)
  const shown = (f) => { const a = f.querySelector(".form-actions"); return !a.hidden && a.style.display !== "none"; };
  const saveSeen = () => shown(form()) && /\bSave\b/.test(seen(part()));
  assert.ok(!fold().hasAttribute("open"));
  assert.ok(!saveSeen(), `shut: no Save (${seen(part())})`);
  assert.equal(form().querySelector(".form-actions").style.display, "none", "out of the drawing, not only hidden");
  assert.ok(form().querySelector(".form-actions").hidden);
  assert.match(seen(part()), /We call the chance strong from 85 of 100 and fair from 70\. More details \(optional\) ›$/, "the line is the last thing in the part");
  assert.equal(everything(part()).filter((e) => e.tagName === "BUTTON" && !e.className.includes("chip") && !e.className.includes("secondary") && !(e.closest?.(".form-actions")?.hidden)).length, 0, "no filled button shows in the part");
  // opened by the person: the two boxes and their Save
  fold().setAttribute("open", ""); fold().dispatch("toggle");
  assert.ok(saveSeen(), "open: Save under the boxes");
  // tapped with both boxes empty: what to do, now that the boxes are in front of the person
  fill(form(), { goodChance: "", okChance: "" });
  assert.equal(s.saved.length, 0);
  assert.match(seen(part()), /Nothing to save yet: type when you call it strong, fair or both\./);
  assert.doesNotMatch(seen(part()), /open More details/);
  // shut again: the Save goes with the boxes
  fold().removeAttribute("open"); fold().dispatch("toggle");
  assert.ok(!saveSeen());
  // a plan with its own lines: the boxes hold them, so the line opens by itself, and the Save with it
  const own = await page(withA(retirementPlan(), { goodChance: 0.8 }), { query: { show: "careful" } });
  const f2 = formWith(own.root, "goodChance");
  assert.ok(f2.querySelector(".form-more").hasAttribute("open"));
  assert.ok(shown(f2));
  assert.match(seen(partOf(own.root, "careful")), /\bSave$/);
  // "Show every box in forms" (Settings) opens the line, and the Save with it
  ui.setMoreOpen(true);
  try {
    const all = await page(retirementPlan(), { query: { show: "careful" } });
    assert.ok(shown(formWith(all.root, "goodChance")));
    assert.match(seen(partOf(all.root, "careful")), /\bSave$/);
  } finally { ui.setMoreOpen(false); }
});

// docs/OPTIONAL.md S11 (R17): after a save only the part saved in changes, its green line is in that part and said once. The
// page's saves are all inside "Set my own numbers" (a chip, "Type my own", the lines' Save); the number of pretend futures is
// no save (kept for the visit, never in the plan) and moves no part.
test("S11: after a save only the saved part changes: a chip and my own lines' Save keep Set my own numbers open and no other; a runs chip saves nothing", async () => {
  const states = (root) => Object.fromEntries(partsOf(root).map((p) => [p.dataset.part, opened(p)]));
  const greenIn = (root) => everything(root).filter((e) => e.className === "notice ok").map((n) => partsOf(root).find((p) => everything(p).includes(n))?.dataset.part ?? "outside");
  const open = (root, id) => { const p = partOf(root, id); p.setAttribute("open", ""); p.dispatch("toggle"); return p; };
  await page(retirementPlan());   // a green line an earlier test's tap left in the view's module state is said on this draw
  const s = await page(retirementPlan());
  const before = states(s.root);
  assert.deepEqual(before, { numbers: false, endings: false, careful: false, how: false });
  // a chip inside Set my own numbers (opened by the person): saved at once; on the next draw that part alone is open
  open(s.root, "careful");
  chipOf(s.root, "19 in 20").dispatch("click");
  assert.equal(s.saved.length, 1);
  await s.settle();
  assert.deepEqual(states(s.root), { ...before, careful: true }, "only the part saved in differs");
  assert.deepEqual(greenIn(s.root), ["careful"], "the green line is in the part saved in, once");
  // the lines' Save, under More details (optional): the same part again, no other
  const fold = formWith(s.root, "goodChance").querySelector(".form-more");
  fold.setAttribute("open", ""); fold.dispatch("toggle");
  fill(formWith(s.root, "goodChance"), { goodChance: "80", okChance: "" });
  assert.equal(s.saved.length, 2);
  await s.settle();
  assert.deepEqual(states(s.root), { ...before, careful: true });
  assert.deepEqual(greenIn(s.root), ["careful"]);
  assert.match(seen(partOf(s.root, "careful")), /Saved\. At \d+ of 100, your plan now reads (strong|fair|weak)\./);
  // said once: a draw with no save is as designed again
  const again = await page(s.plan());
  assert.deepEqual(states(again.root), before);
  assert.deepEqual(greenIn(again.root), []);
  // the number of pretend futures (How this is done): no store.update, the plan tried again with that many, no part moved as
  // drawn (wave 1 keeps How this is done as the person left it, a reading part their tap is kept for), no green line
  open(again.root, "how");
  const runs = again.runs.length, saved = again.saved.length;
  try {
    chipOf(again.root, "1,000 (quick)").dispatch("click");
    await again.settle();
    assert.equal(again.saved.length, saved, "choosing how many pretend futures writes nothing to the plan");
    assert.equal(again.runs.at(-1).params.paths, 1000);
    assert.ok(again.runs.length > runs);
    assert.deepEqual(states(again.root), before);
    assert.deepEqual(greenIn(again.root), []);
    assert.equal(chipOf(open(again.root, "how"), "1,000 (quick)").getAttribute("aria-pressed"), "true");
  } finally {
    // the number is kept for the visit (module state): put back the usual 2,000 for the tests after this one
    chipOf(open(again.root, "how"), "2,000")?.dispatch("click");
    await again.settle();
  }
  assert.equal(again.runs.at(-1).params.paths, 2000);
});

// ---------------------------------------------------------------- how the runs end, and every run as a file (gap next-60 #36)
const MC = await import("./compute.js");

test("#36 failGroups: the runs that ran out by age, cut at 80 and 90 where the plan's ages reach them (hand counts)", () => {
  // a plan from 58 to 97: [58, 79], [80, 89], [90, 97]
  assert.deepEqual(MC.failGroups([62, 79, 80, 85, 89, 90, 97], 58, 97), [{ from: 58, to: 79, n: 2 }, { from: 80, to: 89, n: 3 }, { from: 90, to: 97, n: 2 }]);
  // a plan that starts at 85: no "before 80"; one that starts at 91: one group; one that ends at 79: one group
  assert.deepEqual(MC.failGroups([86, 92], 85, 100), [{ from: 85, to: 89, n: 1 }, { from: 90, to: 100, n: 1 }]);
  assert.deepEqual(MC.failGroups([95], 91, 100), [{ from: 91, to: 100, n: 1 }]);
  assert.deepEqual(MC.failGroups([70, 75], 40, 79), [{ from: 40, to: 79, n: 2 }]);
  // nothing ran out: the groups are still there, empty
  assert.deepEqual(MC.failGroups([], 36, 95).map((g) => g.n), [0, 0, 0]);
});

test("#36 niceStep and leftBands: four bands of one round width, the step from the 90th percentile over 4 (hand figures)", () => {
  for (const [x, s] of [[0, 1000], [999, 1000], [1000, 1000], [1001, 2000], [2100, 2500], [2600, 5000], [212600, 250000], [373000, 500000], [500000, 500000], [644000, 1000000], [3.2e6, 5e6]]) assert.equal(MC.niceStep(x), s, `${x}`);
  // ends 0..900,000 in tens of thousands: p90 = 810,000, /4 = 202,500 -> 250,000; median 450,000
  const ends = Array.from({ length: 91 }, (_, i) => i * 10000);
  const L = MC.leftBands(ends);
  assert.equal(L.step, 250000);
  assert.deepEqual(L.bands, [{ from: 0, to: 250000, n: 25 }, { from: 250000, to: 500000, n: 25 }, { from: 500000, to: 750000, n: 25 }, { from: 750000, to: null, n: 16 }]);
  // 3s is 0.75 to 1.5 times p90 (here 750,000 / 810,000 = 0.93), so the top band can hold more than a tenth: 16 of 91 (n1 fix F3:
  // the note said "about the top tenth or less")
  assert.ok(3 * L.step >= 0.75 * 810000 && 3 * L.step <= 1.5 * 810000 && L.bands[3].n / ends.length > 0.1);
  assert.equal(L.median, 450000);
  // the median is rounded down to $1,000, so "half end with more than" it holds; nothing lasting is no bands
  assert.equal(MC.leftBands([1999, 2500, 3999]).median, 2000);
  assert.deepEqual(MC.leftBands([]), { step: null, bands: [], median: null });
});

test("#36 compute endings: every run counted once, ran out by age, what is left in bands; the same run as the page's chance", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(T17);
  const d = compute(p, { today: T17, paths: 2000, careful: false, endings: true });
  const e = d.endings;
  assert.equal(e.paths, 2000);
  assert.equal(e.ranOut + e.lasted, 2000);
  assert.equal(e.lasted, Math.round(d.successRate * 2000), "the lasted count is the page's chance");
  assert.equal(e.ranOut, d.failAges.count);
  assert.equal(e.out.reduce((t, g) => t + g.n, 0), e.ranOut);
  assert.equal(e.left.reduce((t, b) => t + b.n, 0), e.lasted);
  assert.deepEqual([e.startAge, e.endAge], [d.bands[0].age, d.bands.at(-1).age]);
  assert.deepEqual(e.out.map((g) => [g.from, g.to]), [[e.startAge, 79], [80, 89], [90, e.endAge]]);
  assert.equal(e.step, MC.niceStep(e.step), "a round step");
  // by hand from the runs themselves (runs: true, the same draw)
  const r = compute(p, { today: T17, paths: 2000, careful: false, runs: true });
  const lasting = r.runs.filter((x) => x.failAge === null);
  assert.equal(lasting.length, e.lasted);
  assert.equal(r.runs.filter((x) => x.failAge !== null && x.failAge < 80).length, e.out[0].n);
  assert.equal(r.runs.filter((x) => x.failAge >= 90).length, e.out[2].n);
  assert.equal(lasting.filter((x) => x.endReal >= 3 * e.step).length, e.left[3].n);
  assert.equal(e.medianLeft, MC.leftBands(lasting.map((x) => x.endReal)).median);
  console.log(`# #36 family: ${e.ranOut} ran out (${e.out.map((g) => g.n).join("/")}), ${e.lasted} lasted (${e.left.map((b) => b.n).join("/")} by $${e.step.toLocaleString("en-US")}), half of those over $${e.medianLeft.toLocaleString("en-US")}, file ${e.file.bytes} bytes`);
});

test("#36 runsCsv: one line per run, the age it ran out or blank, what is left, each year's balance; its size is the size said", async () => {
  const { splitCsv } = await import("../../../core/csv.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(T17);
  const both = compute(p, { today: T17, paths: 300, careful: false, endings: true, runs: true });
  const text = MC.runsCsv(both);
  assert.equal(text.length, both.endings.file.bytes, "the line above the button says the file's real size");
  const rows = splitCsv(text);
  assert.equal(rows.length, 301);
  const years = both.endYear - both.bands[0].year + 1;
  assert.deepEqual(rows[0].slice(0, 4), ["Pretend future", "Ran out at age", "Left at the end (today's dollars)", `End of ${both.bands[0].year}`]);
  assert.equal(rows[0].length, 3 + years);
  assert.equal(rows[0].at(-1), `End of ${both.endYear}`);
  for (let k = 0; k < 300; k++) {
    const row = rows[k + 1], run = both.runs[k];
    assert.equal(row[0], String(k + 1));
    assert.equal(row[1], run.failAge === null ? "" : String(run.failAge));
    assert.equal(row[2], String(Math.max(0, Math.round(run.endReal))));
    assert.equal(row.length, 3 + years);
    assert.equal(row.at(-1), row[2], "the last year's balance is what is left at the end");
  }
  // the blanks are the runs that lasted: as many as the page's chance says
  assert.equal(rows.slice(1).filter((r) => r[1] === "").length, Math.round(both.successRate * 300));
  // a draw too big for every year's balance (runs x years over RUNS_CELLS) keeps the three columns, and says so
  const many = Math.floor(MC.RUNS_CELLS / years) + 1;
  const big = compute(p, { today: T17, paths: many, careful: false, endings: true, runs: true });
  assert.equal(big.endings.file.years, 0);
  assert.deepEqual(big.runsYears, []);
  const t2 = MC.runsCsv(big);
  assert.equal(t2.length, big.endings.file.bytes);
  assert.deepEqual(splitCsv(t2)[0], [...MC.RUNS_HEAD]);
  assert.equal(big.runs[0].balances, undefined);
});

test("#36 the sentence that reads the picture: one written out per case", () => {
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const groups = (a, b, c) => [{ from: 36, to: 79, n: a }, { from: 80, to: 89, n: b }, { from: 90, to: 95, n: c }];
  const E = (ranOut, out, medianLeft, paths = 2000) => ({ paths, ranOut, lasted: paths - ranOut, out, medianLeft });
  const cases = [
    [E(0, groups(0, 0, 0), 889000), "every", "The money lasted in all 2,000 pretend futures; in half of them more than $889,000 is left at the end, in today's dollars."],
    [E(0, groups(0, 0, 0), 0), "everyThin", "The money lasted in all 2,000 pretend futures; in half of them less than $1,000 is left at the end, in today's dollars."],
    [E(396, groups(8, 190, 198), 812000), "some", "The money ran out in 396 of the 2,000 pretend futures, most often at 90 or later; in half of the 1,604 that lasted, more than $812,000 is left at the end, in today's dollars."],
    [E(914, groups(9, 479, 426), 665000), "some", "The money ran out in 914 of the 2,000 pretend futures, most often between 80 and 89; in half of the 1,086 that lasted, more than $665,000 is left at the end, in today's dollars."],
    [E(1500, groups(1400, 50, 50), 0), "someThin", "The money ran out in 1,500 of the 2,000 pretend futures, most often before 80; in half of the 500 that lasted, less than $1,000 is left at the end, in today's dollars."],
    [E(1999, groups(1936, 59, 4), 850000), "one", "The money ran out in 1,999 of the 2,000 pretend futures, most often before 80; in the one that lasted, about $850,000 is left at the end, in today's dollars."],
    [E(2000, groups(2000, 0, 0), null), "none", "The money ran out in all 2,000 pretend futures, most often before 80."],
    // a tie goes to the earlier ages; one group alone is said by its two ages
    [E(20, groups(10, 10, 0), 5000), "some", "The money ran out in 20 of the 2,000 pretend futures, most often before 80; in half of the 1,980 that lasted, more than $5,000 is left at the end, in today's dollars."],
    [E(200, [{ from: 91, to: 100, n: 200 }], null, 200), "none", "The money ran out in all 200 pretend futures, most often between 91 and 100."],
  ];
  for (const [e, key, sentence] of cases) assert.deepEqual(view.endingsFor(e, money), { key, sentence }, key);
  // the rows' own words
  assert.deepEqual(view.groupWords(groups(1, 1, 1)).map((w) => w.label), ["before 80", "80 to 89", "90 or later"]);
  assert.deepEqual(view.groupWords([{ from: 85, to: 89 }, { from: 90, to: 100 }]).map((w) => w.label), ["before 90", "90 or later"]);
  assert.deepEqual(view.groupWords([{ from: 95, to: 95 }]), [{ label: "at 95", phrase: "at 95" }]);
  assert.deepEqual([{ from: 0, to: 1e6 }, { from: 1e6, to: 2e6 }, { from: 3e6, to: null }].map((b) => view.bandWords(b, money)), ["under $1,000,000", "$1,000,000 to $2,000,000", "$3,000,000 or more"]);
  assert.deepEqual([887459, 4000, 994999, 995000, 1450000].map(view.sizeWords), ["890 KB", "10 KB", "990 KB", "1.0 MB", "1.5 MB"]);
  assert.equal(view.fileWords({ file: { rows: 2000, years: 60, bytes: 887459 } }, 2085), "A spreadsheet file (CSV) with one row for each of the 2,000 pretend futures: the age the money ran out, what is left at the end and the balance at the end of each year to 2085, in today's dollars. About 890 KB.");
  assert.equal(view.fileWords({ file: { rows: 10000, years: 0, bytes: 162000 } }, 2085), "A spreadsheet file (CSV) with one row for each of the 10,000 pretend futures: the age the money ran out and what is left at the end, in today's dollars; with this many, the balance of each year is left out to keep the file small. About 160 KB.");
  assert.equal(view.savedWords("planner-pretend-futures-2026-11-13.csv", 2000, 887459), "planner-pretend-futures-2026-11-13.csv is downloading: 2,000 rows, about 890 KB. Open it with Excel, Numbers or Google Sheets.");
});

test("#36 the page: one more quiet row; opened, the sentence and a bar per group; the file's button downloads and says so", async () => {
  const { resolveObjectURL } = await import("node:buffer");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await page(familyPlan(T17));
  assert.equal(s.runs[0].params.endings, true, "the page asks for how the runs end with its one run");
  const d = compute(migrate(familyPlan(T17)), { today: T17, paths: 200, careful: false, endings: true });
  const money = (n) => fmt.money(n, "USD");
  const p = partOf(s.root, "endings");
  assert.equal(opened(p), false);
  assert.equal(titleOf(p), "How the pretend futures end");
  const body = seen(p.querySelector(".fold-body"));
  const g = view.groupWords(d.endings.out);
  const bands = d.endings.left.map((b) => view.bandWords(b, money));
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  // (then money and the odds of living, gap next-60 #37: its own test below)
  assert.ok(body.startsWith([view.endingsFor(d.endings, money).sentence, "Ran out, by age", ...d.endings.out.flatMap((x, i) => [cap(g[i].label), String(x.n)]),
    "Lasted, by what is left at the end", ...d.endings.left.flatMap((b, i) => [cap(bands[i]), String(b.n)]),
    "Each bar is out of all 200 pretend futures. What is left is in today's dollars; an age is Ana's age in the first year the money falls short. Money and the odds of living "].join(" ")), body);
  // a plan whose first person is "Me" reads "your age"
  const me = familyPlan(T17); me.household.people[0].name = "Me";
  assert.match(seen(partOf((await page(me)).root, "endings").querySelector(".fold-body")), /an age is your age in the first year the money falls short\. Money and the odds of living /);
  // each bar is as wide as its share of all the runs, red for ran out and green for lasted (the odds of living's bars after them)
  const bars = everything(p).filter((e) => e.className === "progress").slice(0, d.endings.out.length + d.endings.left.length).map((e) => e.childNodes[0].style);
  assert.deepEqual(bars.map((b) => b.width), [...d.endings.out, ...d.endings.left].map((x) => `${Math.round((1000 * x.n) / 200) / 10}%`));
  assert.deepEqual(bars.map((b) => b.background), [...d.endings.out.map(() => "var(--bad)"), ...d.endings.left.map(() => "var(--ok)")]);
  // the file, at the foot of How this is done: outlined, made when tapped, the green line says what came down
  const how = partOf(s.root, "how");
  const btn = everything(how).find((e) => e.tagName === "BUTTON" && e.textContent === "Save all 200 pretend futures as a spreadsheet");
  assert.ok(btn && btn.className === "secondary", "outlined, never a second filled button");
  const made = [];
  const create = globalThis.document.createElement;
  globalThis.document.createElement = (t) => { const el = create(t); if (t === "a") made.push(el); return el; };
  try {
    btn.dispatch("click");
    for (let i = 0; i < 5; i++) await s.settle();
  } finally { globalThis.document.createElement = create; }
  assert.equal(s.runs.at(-1).params.runs, true);
  assert.equal(s.saved.length, 0, "a file is no change to the plan");
  assert.equal(made.length, 1);
  assert.equal(made[0].download, `planner-pretend-futures-${T17}.csv`);
  const text = await resolveObjectURL(made[0].href).text();
  assert.equal(text, MC.runsCsv(compute(migrate(familyPlan(T17)), { today: T17, paths: 200, careful: false, runs: true })));
  const ok = everything(how).filter((e) => e.className === "notice ok");
  assert.equal(ok.length, 1);
  assert.equal(ok[0].textContent, view.savedWords(`planner-pretend-futures-${T17}.csv`, 200, text.length));
  // the computer did not answer: a red line that says what to do, and the button works again
  const failing = await (async () => {
    let plan = migrate(familyPlan(T17));
    const root = new FakeElement("main");
    view.render(root, { ui, fmt: { ...fmt, today: () => T17 }, plan, view: { build: false }, module: { group: "retirement", id: "monte-carlo" }, route: { group: "retirement", id: "monte-carlo", rest: [], query: {} },
      store: { get: () => plan, backend: () => "local", update() {} },
      computeRemote: async (key, params) => { if (params.runs) throw new Error("the computer did not answer"); return compute(plan, { ...params, paths: 200 }); } });
    await settle();
    return root;
  })();
  const fb = everything(failing).find((e) => e.tagName === "BUTTON" && e.textContent === "Save all 200 pretend futures as a spreadsheet");
  fb.dispatch("click");
  for (let i = 0; i < 5; i++) await settle();
  const bad = everything(failing).filter((e) => e.className === "notice error");
  assert.equal(bad.length, 1);
  assert.equal(bad[0].textContent, "The file could not be made: the computer did not answer. Reload the page and try again.");
  assert.equal(fb.disabled, false);
});

// ---------------------------------------------------------------- how the pretend years are drawn (gap next-60 #35)
const MCM = await import("../../../core/math/montecarlo.js");
const { RETURNS } = await import("../historical/data/returns.js");
const T35 = "2026-11-15";
const mean = (xs) => xs.reduce((t, x) => t + x, 0) / xs.length;

test("#35 the bundled history's own figures: 1928 to 2025, every class the plan uses, inflation's swing and how it carries on", () => {
  const H = MC.HISTORY;
  assert.deepEqual([H.from, H.to, H.years], [1928, 2025, 98]);
  assert.equal(RETURNS.length, 98);
  RETURNS.forEach((r, i) => { assert.equal(r.year, 1928 + i); for (const k of ["stocks", "bonds", "bills", "inflation"]) assert.ok(Number.isFinite(r[k]), `${r.year} ${k}`); });
  // by hand from the file, to four places (README)
  assert.deepEqual([H.mean.stocks, H.mean.bonds, H.mean.cash, H.mean.inflation].map((x) => x.toFixed(4)), ["0.1185", "0.0482", "0.0341", "0.0311"]);
  assert.equal(H.mean.cash, mean(RETURNS.map((r) => r.bills)), "cash is the 3-month bills");
  const i = RETURNS.map((r) => r.inflation), m = mean(i);
  assert.ok(Math.abs(H.inflationSd - Math.sqrt(i.reduce((t, x) => t + (x - m) ** 2, 0) / 97)) < 1e-15);
  assert.equal(H.inflationSd.toFixed(4), "0.0390");
  assert.equal(H.inflationLag1.toFixed(2), "0.61");
});

test("#35 lag1, pickIndices and ar1Paths (core/math/montecarlo.js): hand figures, the same seed the same draw", () => {
  // [1, 2, 3, 4]: deviations -1.5 -0.5 0.5 1.5; (0.75 - 0.25 + 0.75) / (2.25 + 0.25 + 0.25 + 2.25) = 1.25 / 5
  assert.equal(MCM.lag1([1, 2, 3, 4]), 0.25);
  assert.equal(MCM.lag1([5]), 0);
  assert.equal(MCM.lag1([2, 2, 2]), 0);
  // the picks: floor(u x count) of mulberry32(seed), path by path, year by year
  const r = MCM.mulberry32(3);
  assert.deepEqual(MCM.pickIndices(2, 3, 98, 3), [[0, 1, 2], [3, 4, 5]].map((p) => p.map(() => Math.floor(r() * 98))));
  const picks = MCM.pickIndices(500, 40, 98, 1);
  assert.deepEqual(picks, MCM.pickIndices(500, 40, 98, 1));
  assert.notDeepEqual(picks, MCM.pickIndices(500, 40, 98, 2));
  const flat = picks.flat();
  assert.ok(flat.every((k) => Number.isInteger(k) && k >= 0 && k <= 97));
  const counts = new Array(98).fill(0); for (const k of flat) counts[k]++;
  // 20,000 picks: about 204 each; every real year picked, none more than twice as often as another
  assert.ok(Math.min(...counts) > 140 && Math.max(...counts) < 280, `${Math.min(...counts)} to ${Math.max(...counts)}`);
  // ar1Paths: x0 = 0, then x_t = phi x_(t-1) + sd sqrt(1 - phi^2) z_t, by hand on the same stream
  const g = MCM.mulberry32(9), e = 0.04 * Math.sqrt(1 - 0.5 ** 2);
  let x = 0; const hand = [0.03];
  for (let t = 1; t < 5; t++) { x = 0.5 * x + e * MCM.normal(g); hand.push(0.03 + x); }
  assert.deepEqual(MCM.ar1Paths(1, 5, { mean: 0.03, phi: 0.5, sd: 0.04, seed: 9 }), [hand]);
  assert.deepEqual(MCM.ar1Paths(3, 4, { mean: 0.02, phi: 0, sd: 0, seed: 1 }), [[0.02, 0.02, 0.02, 0.02], [0.02, 0.02, 0.02, 0.02], [0.02, 0.02, 0.02, 0.02]]);
});

test("#35 years picked from history: only real years, all classes from the same year, set to the plan's averages", () => {
  const o = { stocks: 0.07, bonds: 0.04, cash: 0.02, inflation: 0.03, seed: 1 };
  const a = MC.historySequences(400, 30, o);
  assert.deepEqual(a, MC.historySequences(400, 30, o), "the same seed, the same years");
  assert.notDeepEqual(a.seqs, MC.historySequences(400, 30, { ...o, seed: 2 }).seqs);
  const M = MC.HISTORY.mean;
  const k = { stocks: 1.07 / (1 + M.stocks), bonds: 1.04 / (1 + M.bonds), cash: 1.02 / (1 + M.cash), inflation: 1.03 / (1 + M.inflation) };
  const back = (v, c) => (1 + v) / k[c] - 1;
  a.seqs.forEach((path, p) => path.forEach((y, t) => {
    const real = RETURNS[a.picks[p][t]];
    assert.ok(real, "a real year");
    // every class from that one year (stocks, bonds and cash move together as they did)
    for (const [c, f] of [["stocks", "stocks"], ["bonds", "bonds"], ["cash", "bills"], ["inflation", "inflation"]]) assert.ok(Math.abs(back(y[c], c) - real[f]) < 1e-12, `${real.year} ${c}`);
  }));
  // and the year can be read back from the stock return alone: one of the 98, never a made-up figure
  const stocks = new Set(RETURNS.map((r) => r.stocks.toFixed(9)));
  assert.ok(a.seqs.flat().every((y) => stocks.has(back(y.stocks, "stocks").toFixed(9))));
  // over the 98 years each class averages exactly the plan's own figure
  const all = MC.historySequences(1, 98, o);   // (any picks) -> check the transformation of every real year instead
  void all;
  for (const [c, f] of [["stocks", "stocks"], ["bonds", "bonds"], ["cash", "bills"], ["inflation", "inflation"]]) {
    assert.ok(Math.abs(mean(RETURNS.map((r) => (1 + r[f]) * k[c] - 1)) - o[c]) < 1e-12, c);
  }
  // and the drawn years, 12,000 of them, average it within 4 standard errors (stocks swing 18.6%: 4 x 0.186 / sqrt(12,000) = 0.0068)
  const drawn = a.seqs.flat();
  assert.ok(Math.abs(mean(drawn.map((y) => y.stocks)) - 0.07) < 0.0068);
  assert.ok(Math.abs(mean(drawn.map((y) => y.inflation)) - 0.03) < 4 * 0.039 / Math.sqrt(12000));
});

test("#35 prices that rise unevenly: the usual returns, inflation drawn around the plan's figure with history's swing", () => {
  const o = { stocks: 0.07, bonds: 0.04, stdevStocks: 0.15, stdevBonds: 0.05, inflation: 0.03, seed: 1 };
  const a = MC.pricesSequences(2000, 40, o);
  assert.deepEqual(a, MC.pricesSequences(2000, 40, o), "the same seed, the same prices");
  // the returns are the usual draw's, year for year: only prices differ
  const usual = MC.drawSequences(2000, 40, o);
  a.forEach((path, p) => path.forEach((y, t) => { assert.equal(y.stocks, usual[p][t].stocks); assert.equal(y.bonds, usual[p][t].bonds); }));
  assert.ok(a.every((path) => path[0].inflation === 0.03), "this year rises by the plan's figure");
  // 80,000 drawn years average the plan's figure within 0.002 (a year's draw swings by 3.9% and carries on, so the standard
  // error of the mean is about 0.039 x sqrt(1.61 / 0.39) / sqrt(80,000) = 0.0003; 0.002 is over six of them)
  const infl = a.flatMap((path) => path.map((y) => y.inflation));
  assert.ok(Math.abs(mean(infl) - 0.03) < 0.002, `${mean(infl)}`);
  // settled (from year 10), the swing is history's 3.9% and a year carries on into the next by history's 0.61
  const dev = a.map((path) => path.map((y) => y.inflation - 0.03).slice(10));
  const sd = Math.sqrt(mean(dev.flat().map((x) => x * x)));
  assert.ok(Math.abs(sd - MC.HISTORY.inflationSd) < 0.002, `swing ${sd}`);
  let num = 0, den = 0;
  for (const d of dev) for (let t = 0; t + 1 < d.length; t++) { num += d[t] * d[t + 1]; den += d[t] * d[t]; }
  assert.ok(Math.abs(num / den - MC.HISTORY.inflationLag1) < 0.02, `carries on ${num / den}`);
  // a second stream: another seed draws other prices
  assert.notDeepEqual(MC.pricesSequences(50, 10, { ...o, seed: 2 }).map((p) => p.map((y) => y.inflation)), a.slice(0, 50).map((p) => p.slice(0, 10).map((y) => y.inflation)));
});

test("#35 compute: each way says so and moves the chance; the usual way, an unknown way or none is the old answer, byte for byte", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = migrate(familyPlan(T35));
  const o = { today: T35, paths: 2000, careful: false };
  const u = compute(p, o);
  assert.equal("draw" in u, false);
  for (const w of ["usual", "lottery", undefined, null]) assert.equal(JSON.stringify(compute(p, { ...o, draw: w })), JSON.stringify(u), String(w));
  const h = compute(p, { ...o, draw: "history" }), pr = compute(p, { ...o, draw: "prices" });
  assert.equal(h.draw, "history"); assert.equal(pr.draw, "prices");
  // the family (Ana and Bo, the money to 2085): 80 of 100 the usual way, 69 with years picked from history, 72 with prices
  // that rise unevenly (history's swings are wider than the plan's 15% and 5%; uneven prices raise the spending in bad stretches)
  assert.deepEqual([u, h, pr].map((d) => perHundredOf(d.successRate)), [80, 69, 72]);
  // the same seed, the same answer
  assert.equal(JSON.stringify(compute(p, { ...o, draw: "history" })), JSON.stringify(h));
  // how the runs end and every run as a file follow the way
  const e = compute(p, { ...o, paths: 300, draw: "history", endings: true, runs: true });
  assert.equal(e.endings.ranOut + e.endings.lasted, 300);
  assert.equal(e.runs.length, 300);
  assert.equal(e.endings.lasted / 300, e.successRate);
  // the draw is the one drawFor gives (every class, every year) and the projection is run on it as it is
  const I = (await import("../projection/compute.js")).buildInputs(p, { today: T35 }).inputs;
  const seqs = MC.drawFor("history", 300, I.endYear - I.startYear + 1, I, 1);
  const { project } = await import("../../../core/math/retirement.js");
  assert.equal(seqs.filter((q) => project(I, { sequence: q }).success).length / 300, e.successRate);
  assert.deepEqual(MC.drawFor("usual", 30, 5, I, 1), MC.drawSequences(30, 5, { stocks: I.returns.stocks, bonds: I.returns.bonds, stdevStocks: I.stdev.stocks, stdevBonds: I.stdev.bonds, seed: 1 }));
  assert.deepEqual([MC.asDraw("history"), MC.asDraw("prices"), MC.asDraw("usual"), MC.asDraw("History"), MC.asDraw(3)], ["history", "prices", "usual", "usual", "usual"]);
  assert.deepEqual([MC.drawOf({}), MC.drawOf({ assumptions: { chanceDraw: "prices" } }), MC.drawOf({ assumptions: { chanceDraw: "x" } })], ["usual", "prices", "usual"]);
});
const perHundredOf = (s) => Math.floor(s * 100 + 1e-9);

test("#35 the careful figure is always the usual way's, whatever way the page draws (one figure on every page)", () => {
  const p = migrate(retirementPlan());
  const o = { today: T17, paths: 300 };
  const c = compute(p, o).careful;
  assert.ok(c && c.yearly > 0);
  assert.deepEqual(compute(p, { ...o, draw: "history" }).careful, c);
  assert.deepEqual(compute(p, { ...o, draw: "prices" }).careful, c);
});

test("#35 the words: one sentence per way and per case, the chips with their chance, the hero's line, Keep, its question and its lines", () => {
  assert.deepEqual(view.DRAWS ?? MC.DRAWS, ["usual", "history", "prices"]);
  // the chance never breaks across lines in a chip (no-break spaces)
  assert.deepEqual(["usual", "history", "prices"].map((w) => view.chipWords(w, 0.802)), ["The usual way: 80\u00a0of\u00a0100", "Years picked from history: 80\u00a0of\u00a0100", "Prices that rise unevenly: 80\u00a0of\u00a0100"]);
  assert.equal(view.chipWords("prices", 0.004), "Prices that rise unevenly: under\u00a01\u00a0of\u00a0100");
  assert.equal(view.chipWords("history", undefined), "Years picked from history");
  assert.deepEqual([1, 0.995, 0.004, 0].map(view.chanceValue), ["100 of 100", "99 of 100", "under 1 of 100", "0 of 100"]);
  // q1 fix P2, P3: a heading of its own, apart from how careful; the figure on a chip counted like the answer at the top; what a
  // tap does, said before any tap
  assert.equal(view.DRAW_TITLE, "How the pretend years are drawn");
  assert.equal(view.DRAW_ASK, "Each way tests the same plan with its own pretend years. The figure on each is how many of 100 pretend futures the money lasts in, like the answer at the top. Tap one to try it and see what it means; nothing is saved unless you keep it.");
  assert.deepEqual(view.WAY_WORDS, {
    usual: "Each year's returns are drawn at random around your own averages and swings, and prices rise steadily by your figure.",
    history: "Each pretend year is a real year from 1928 to 2025, picked at random: its stocks, bonds, cash and prices move together as they did that year, set to average your own figures.",
    prices: "Returns as the usual way, but prices rise unevenly around your figure, with swings like those since 1928: a year of high prices tends to be followed by another.",
  });
  // the hero's line: nothing the usual way; kept; tried
  assert.deepEqual([["usual", "usual"], ["history", "history"], ["prices", "prices"], ["history", "usual"], ["prices", "history"], ["usual", "prices"]].map(([w, k]) => view.wayNote(w, k)), [
    null, "Drawn with years picked from history, as you chose.", "Drawn with prices that rise unevenly, as you chose.",
    "Trying years picked from history: this page only, nothing saved.", "Trying prices that rise unevenly: this page only, nothing saved.", "Trying the usual way: this page only, nothing saved."]);
  assert.deepEqual(["usual", "history", "prices"].map(view.keepWords), ["Keep the usual way", "Keep years picked from history", "Keep prices that rise unevenly"]);
  assert.deepEqual(["usual", "history", "prices"].map(view.confirmWords), [
    "Keep the usual way? This page will draw its pretend years the usual way again. No other page changes.",
    "Keep years picked from history? This page will draw its pretend years this way from now on. No other page changes.",
    "Keep prices that rise unevenly? This page will draw its pretend years this way from now on. No other page changes."]);
  assert.deepEqual(["usual", "history", "prices"].map((w) => view.keptWords(w, 0.698)), [
    "Saved. This page is back to the usual way: the money lasts in 69 of 100 pretend futures.",
    "Saved. This page now draws years picked from history: the money lasts in 69 of 100 pretend futures.",
    "Saved. This page now has prices that rise unevenly: the money lasts in 69 of 100 pretend futures."]);
  assert.equal(view.keptWords("history", undefined), "Saved. This page now draws years picked from history.");
  assert.deepEqual([view.backWords("usual", 0.802), view.backWords("history", 0.698), view.backWords("prices", undefined)], [
    "Back to the usual way: the money lasts in 80 of 100 pretend futures.", "Back to years picked from history: the money lasts in 69 of 100 pretend futures.", "Back to prices that rise unevenly."]);
  assert.equal(view.TRY_WORDS, "You are trying this on this page only; your plan is not changed.");
  // q1 fix P1, P6: while a way is tried, the hero says a different answer is normal and has the way back
  assert.equal(view.TRY_NORMAL, "Neither way is the right one: they are two ways to test the same plan, so a different answer is normal.");
  assert.deepEqual(["usual", "history", "prices"].map(view.backToWords), ["Back to the usual way", "Back to years picked from history", "Back to prices that rise unevenly"]);
  assert.equal(view.SAME_FIGURE, "The spending that lasts, above, is always worked out the usual way, so every page shows the same figure.");
  assert.equal(view.DRAW_BUSY, "Working out the chance with each way...");
  assert.equal(view.DRAW_FAILED, "The chance with each way could not be worked out. Reload the page to try again.");
  // How this is done: the usual way's sentence is the one the page always had; one for each other way
  const A = { returnStocks: 0.07, returnBonds: 0.04, returnCash: 0.02, stdevStocks: 0.15, stdevBonds: 0.05, inflation: 0.03 };
  const pct = fmt.pct;
  assert.equal(view.methodWords("usual", A, pct), "Each pretend future picks a random return for stocks and bonds every year, averaging 7.0% and 4.0%, with typical swings of 15% and 5%, and inflation steady at 3.0%. The random picks are the same each time, so the answer does not change when you reopen the page.");
  assert.equal(view.methodWords("history", A, pct), "Each pretend future picks, for every year, one real year from 1928 to 2025 at random and takes its stock, bond and cash returns and its rise in prices together, set to average your own 7.0%, 4.0%, 2.0% and 3.0%; the swings are history's own. The random picks are the same each time, so the answer does not change when you reopen the page.");
  assert.equal(view.methodWords("prices", A, pct), "Each pretend future picks a random return for stocks and bonds every year, averaging 7.0% and 4.0%, with typical swings of 15% and 5%, and prices that rise by 3.0% a year on average but unevenly, by about 3.9% more or less in a typical year as from 1928 to 2025; a year of high prices tends to be followed by another. The random picks are the same each time, so the answer does not change when you reopen the page.");
});

test("#35 the page: try a way (nothing saved), keep it (asked first, one field, the green line with Undo), Undo puts it back", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { knownChance } = await import("../careful.js");
  // the family with cash earning 2.1%: a plan no other test here draws, so each way's chance is not known yet on this visit
  const base = () => { const q = familyPlan(T35); q.assumptions.returnCash = 0.021; return q; };
  const s = await page(base(), { query: { show: "careful" } });
  const part = () => partOf(s.root, "careful");
  const body = () => seen(part().querySelector(".fold-body"));
  // (the other ways are asked for once the spending that lasts is worked out: thousands of runs here, a few seconds)
  const wait = async (re) => { for (let i = 0; i < 3000 && re.test(body()); i++) await new Promise((r) => setTimeout(r, 10)); };
  const at = (w) => compute(migrate(base()), { today: T17, paths: 200, careful: false, ...(w === "usual" ? {} : { draw: w }) }).successRate;
  const R = { usual: at("usual"), history: at("history"), prices: at("prices") };
  const asked = [], had = globalThis.window.confirm;
  try {
    assert.ok(opened(part()));
    // the spending that lasts first (as soon as it always came), then the other ways' chances
    assert.equal(s.runs.filter((r) => r.params.draw).length, 0, "no other way asked for before the spending that lasts");
    assert.match(body(), /Working out the chance with each way\.\.\./);
    await wait(/Working out the chance with each way/);
    assert.match(body(), /the money can pay for about \$[\d,]+ a year/);
    // the three ways, each with its chance; the other two were asked for, one after the other, with the same pretend futures
    const chips = ["usual", "history", "prices"].map((w) => view.chipWords(w, R[w]));
    assert.match(body(), new RegExp(`${view.DRAW_TITLE} ${view.DRAW_ASK.replace(/[.()]/g, "\\$&")} ${chips.join(" ").replace(/\u00a0/g, " ").replace(/[()]/g, "\\$&")} ${view.WAY_WORDS.usual.replace(/[.()]/g, "\\$&")}`));
    assert.deepEqual(s.runs.filter((r) => r.params.draw).map((r) => [r.params.draw, r.params.paths, r.params.careful]), [["history", 2000, false], ["prices", 2000, false]]);
    assert.equal(chipOf(s.root, chips[0]).getAttribute("aria-pressed"), "true");
    assert.ok(!/Keep /.test(body()), "nothing to keep while the way shown is the one kept");
    assert.equal(knownChance({ store: { get: () => s.plan() }, fmt: { today: () => T17 } }), R.usual, "Compare's figure: the usual way's");
    // try years picked from history: the page runs again that way, nothing is written, the part stays open
    chipOf(s.root, chips[1]).dispatch("click");
    await s.settle();
    assert.equal(s.saved.length, 0, "trying writes nothing");
    assert.equal(s.runs.at(-1).params.draw, "history");
    assert.ok(opened(part()), "Set my own numbers stays open");
    assert.deepEqual(rowsOf(s.root).map((r) => r[4]), [false, false, true, false]);
    const hero = seen(s.root).split(" 8 more numbers")[0];
    assert.ok(hero.includes(`${view.answerFor({ successRate: R.history, endYear: 2085 }).value} pretend futures where the money lasts to 2085`), hero);
    assert.ok(hero.endsWith(`Trying years picked from history: this page only, nothing saved. ${view.TRY_NORMAL} Back to the usual way`), hero);
    assert.equal(chipOf(s.root, view.chipWords("history", R.history)).getAttribute("aria-pressed"), "true");
    assert.match(body(), /Each pretend year is a real year from 1928 to 2025, picked at random: .* You are trying this on this page only; your plan is not changed\. Keep years picked from history The spending that lasts, above, is always worked out the usual way, so every page shows the same figure\./);
    assert.match(seen(partOf(s.root, "how").querySelector(".fold-body")), /one real year from 1928 to 2025 at random/);
    assert.equal(knownChance({ store: { get: () => s.plan() }, fmt: { today: () => T17 } }), R.usual, "a way tried is never Compare's figure");
    const keep = () => everything(s.root).find((e) => e.tagName === "BUTTON" && e.textContent === "Keep years picked from history");
    assert.equal(keep().className, "secondary", "outlined: never a second filled button");
    // Keep asks first; a No saves nothing
    globalThis.window.confirm = (t) => { asked.push(t); return false; };
    keep().dispatch("click");
    assert.equal(s.saved.length, 0);
    assert.deepEqual(asked, [view.confirmWords("history")]);
    // a Yes: one change, the one field
    globalThis.window.confirm = (t) => { asked.push(t); return true; };
    keep().dispatch("click");
    assert.equal(s.saved.length, 1);
    assert.equal(s.plan().assumptions.chanceDraw, "history");
    const before = migrate(base()); before.assumptions.chanceDraw = "history";
    assert.equal(JSON.stringify({ ...s.plan(), meta: null }), JSON.stringify({ ...before, meta: null }), "nothing else in the plan changed");
    await s.settle();
    await wait(/Working out the chance with each way/);
    assert.ok(opened(part()));
    assert.equal(statusOf(part()), "1 set by you");
    const ok = everything(part()).filter((e) => e.className === "notice ok");
    assert.equal(ok.length, 1);
    assert.ok(ok[0].textContent.startsWith(view.keptWords("history", R.history)), ok[0].textContent);
    assert.ok(seen(s.root).split(" 8 more numbers")[0].endsWith("Drawn with years picked from history, as you chose."));
    assert.ok(!keep(), "kept: no Keep button");
    // the next visit opens drawn that way, asked for by the page (compute never reads the field)
    const next = await page(s.plan());
    assert.equal(next.runs[0].params.draw, "history");
    assert.ok(seen(next.root).includes("Drawn with years picked from history, as you chose."));
    // Undo: the field goes, the green line says what the plan reads again
    const undo = everything(ok[0]).find((e) => e.tagName === "BUTTON" && e.textContent === "Undo");
    undo.dispatch("click");
    assert.equal("chanceDraw" in s.plan().assumptions, false);
    await s.settle();
    assert.equal(s.runs.at(-1).params.draw, undefined, "the usual way again");
    const back = everything(part()).filter((e) => e.className === "notice ok");
    assert.deepEqual(back.map((n) => n.textContent), [view.backWords("usual", R.usual)]);
    assert.ok(!seen(s.root).includes("as you chose"));
  } finally {
    globalThis.window.confirm = had;
    // the way tried is kept for the visit (module state): back to the usual way for the tests after this one
    const usualChip = everything(s.root).find((e) => e.tagName === "BUTTON" && e.className.includes("chip") && e.textContent.startsWith("The usual way"));
    if (usualChip && usualChip.getAttribute("aria-pressed") !== "true") { usualChip.dispatch("click"); await s.settle(); }
  }
});

test("#35 a way kept, then the usual way kept again: the field goes; trying the kept way again is no try", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p0 = familyPlan(T35); p0.assumptions.chanceDraw = "prices";
  const s = await page(p0, { query: { show: "careful" } });
  const had = globalThis.window.confirm;
  try {
    assert.equal(s.runs[0].params.draw, "prices");
    assert.equal(statusOf(partOf(s.root, "careful")), "1 set by you");
    const chip = (start) => everything(s.root).find((e) => e.tagName === "BUTTON" && e.className.includes("chip") && e.textContent.startsWith(start));
    chip("The usual way").dispatch("click");
    await s.settle();
    assert.ok(seen(s.root).includes("Trying the usual way: this page only, nothing saved."));
    globalThis.window.confirm = () => true;
    everything(s.root).find((e) => e.tagName === "BUTTON" && e.textContent === "Keep the usual way").dispatch("click");
    assert.equal("chanceDraw" in s.plan().assumptions, false);
    await s.settle();
    assert.match(seen(partOf(s.root, "careful")), /Saved\. This page is back to the usual way(: the money lasts in \d+ of 100 pretend futures)?\./);
    // tapping the way the plan keeps is no try: nothing to keep
    chip("The usual way").dispatch("click");
    await s.settle();
    assert.ok(!seen(s.root).includes("Trying"));
  } finally { globalThis.window.confirm = had; }
});

test("q1 fix P1: while a way is only tried, the sentence keeps its verdict but not the advice to change the plan", () => {
  const usual = { good: 0.85, ok: 0.7 }, high = { good: 0.95, ok: 0.8 };
  const tried = (successRate, lines) => view.answerFor({ successRate, endYear: 2085 }, lines, { trying: true }).lede;
  assert.deepEqual([[1, usual], [0.93, usual], [0.8, usual], [0.5, usual], [0, usual], [0.86, high], [0.75, high]].map(([r, l]) => tried(r, l)), [
    "Strong: the money lasted in every pretend future.",
    "Strong: the money lasted in nearly every pretend future.",
    "Fair: it lasted in most pretend futures, but not all.",
    "Weak: it ran out in many pretend futures.",
    "Weak: the money ran out in every pretend future.",
    "Fair: under the 95 of 100 you call strong, at or above the 80 you call fair.",
    "Weak: under the 80 of 100 you call fair."]);
  // the key and the figure are the way kept's own cases (the same words up to the advice)
  for (const [r, l] of [[1, usual], [0.8, usual], [0.5, usual], [0, usual], [0.86, high], [0.75, high]]) {
    const a = view.answerFor({ successRate: r, endYear: 2085 }, l), t = view.answerFor({ successRate: r, endYear: 2085 }, l, { trying: true });
    assert.deepEqual([t.key, t.value, t.label], [a.key, a.value, a.label]);
    assert.ok(a.lede.startsWith(t.lede), `${a.lede} | ${t.lede}`);
  }
});

test("q1 fix P1, P6: a way tried: the hero drops the advice, says a different answer is normal, and Back to ... returns, writing nothing", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const lines = { good: 0.85, ok: 0.7 };
  const at = (p, w) => compute(migrate(p), { today: T17, paths: 200, careful: false, ...(w === "usual" ? {} : { draw: w }) });
  for (const keptWay of ["usual", "history"]) {
    const p0 = familyPlan(T35); if (keptWay !== "usual") p0.assumptions.chanceDraw = keptWay;
    const s = await page(p0, { query: { show: "careful" } });
    const hero = () => seen(s.root).split(" 8 more numbers")[0];
    const backBtn = () => everything(s.root).find((e) => e.tagName === "BUTTON" && e.textContent.startsWith("Back to ")) ?? null;
    const chip = (start) => everything(s.root).find((e) => e.tagName === "BUTTON" && e.className.includes("chip") && e.textContent.startsWith(start));
    try {
      // the way the plan keeps: the full sentence, advice and all; no way back, nothing said about a test
      assert.ok(hero().includes(view.answerFor(at(p0, keptWay), lines).lede), hero());
      assert.ok(!backBtn() && !hero().includes(view.TRY_NORMAL));
      // try prices that rise unevenly
      chip("Prices that rise unevenly").dispatch("click");
      await s.settle();
      assert.equal(s.runs.at(-1).params.draw, "prices");
      const t = view.answerFor(at(p0, "prices"), lines, { trying: true });
      assert.ok(hero().includes(`${t.value} pretend futures where the money lasts to 2085 ${t.lede} Trying prices that rise unevenly: this page only, nothing saved. ${view.TRY_NORMAL}`), hero());
      assert.ok(!/Look at spending|A little less spending/.test(hero()), "no advice to change the plan while a way is only tried");
      const b = backBtn();
      assert.equal(b.textContent, view.backToWords(keptWay));
      assert.equal(b.className, "secondary small", "outlined: never a second filled button");
      // the way back: the way the plan keeps, nothing written, Set my own numbers as it was
      b.dispatch("click");
      await s.settle();
      assert.equal(s.saved.length, 0, "the way back writes nothing");
      assert.equal(s.runs.at(-1).params.draw, keptWay === "usual" ? undefined : keptWay);
      assert.ok(!hero().includes("Trying") && !backBtn(), hero());
      assert.ok(hero().includes(view.answerFor(at(p0, keptWay), lines).lede));
      assert.ok(opened(partOf(s.root, "careful")), "Set my own numbers stays open");
    } finally {
      // the way tried is kept for the visit (module state): back to the way kept for the tests after this one
      backBtn()?.dispatch("click");
      await s.settle();
    }
  }
});

// ---------------------------------------------------------------- money and the odds of living (gap next-60 #37)
const LG = await import("../longevity/compute.js");

test("#37 per100: whole numbers of 100 that add to 100, the units left over to the largest remainders (hand cases)", () => {
  // 55.5, 3, 41.5: 55 + 3 + 41 = 99, one left; remainders 0.5, 0, 0.5: the earlier of the tie
  assert.deepEqual(MC.per100([0.555, 0.03, 0.415]), [56, 3, 41]);
  assert.deepEqual(MC.per100([1 / 3, 1 / 3, 1 / 3]), [34, 33, 33]);
  // 0.4, 0.6, 99: the 0.6 rounds up
  assert.deepEqual(MC.per100([0.004, 0.006, 0.99]), [0, 1, 99]);
  assert.deepEqual(MC.per100([1, 0, 0]), [100, 0, 0]);
  assert.deepEqual(MC.per100([0.5755697, 0.0296561, 0.3947742]), [58, 3, 39]);
});

test("#37 livingOdds: the three shares add to 1 at every age; alive is How long to plan for's own chance, money is this page's runs", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { widowPlan } = await import("../../../qa/fixtures/widow-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  let rows = 0;
  for (const [name, p0, whose] of [["family", familyPlan(T35), "either"], ["widow", widowPlan(T35), "one"], ["retiredCouple", retiredCouplePlan(T35), "either"], ["renterDebt", renterDebtPlan(T35), "one"]]) {
    const p = migrate(p0);
    const d = compute(p, { today: T35, paths: 300, careful: false, living: true });
    const L = d.living;
    assert.equal(L.whose, whose, name);
    const lg = LG.compute(p, { today: T35 });
    const first = lg.people.find((x) => x.name === L.clock);
    // the ages: the first three of 85, 90, 95, 100 above today's age and within the plan
    assert.deepEqual(L.ages.map((r) => r.age), MC.LIVING_AGES.filter((m) => m > first.age && m <= d.bands.at(-1).age).slice(0, 3), name);
    assert.ok(L.ages.length >= 2, name);
    for (const r of L.ages) {
      rows++;
      assert.ok(Math.abs(r.rich + r.broke + r.dead - 1) < 1e-12, `${name} ${r.age}: the three add to 1`);
      assert.equal(r.per100.reduce((t, x) => t + x, 0), 100, `${name} ${r.age}: and to 100 of 100`);
      assert.deepEqual(r.per100, MC.per100([r.rich, r.broke, r.dead]));
      // money: this page's own share still funded in the year the first adult turns that age
      const b = d.byAge.find((x) => x.age === r.age);
      assert.deepEqual([r.funded, r.year], [b.funded, b.year], name);
      // alive: How long to plan for's own figure at that age (one adult: theirs; a couple: at least one of the two)
      const want = whose === "either" ? lg.either.ages.find((a) => a.age === r.age).p : first.ages.find((a) => a.age === r.age).p;
      assert.ok(Math.abs(r.alive - want) < 1e-12, `${name} ${r.age}: alive ${r.alive} against ${want}`);
      assert.ok(Math.abs(r.rich - r.alive * r.funded) < 1e-15 && Math.abs(r.broke - r.alive * (1 - r.funded)) < 1e-15 && Math.abs(r.dead - (1 - r.alive)) < 1e-15);
    }
  }
  assert.ok(rows >= 10);
  // the family (Ana and Bo, at least one alive, Ana's ages): at 90 (2080), 31 alive with money left, 4 with the money gone, 65
  // neither alive (2,000 pretend futures)
  const fam = compute(migrate(familyPlan(T35)), { today: T35, paths: 2000, careful: false, living: true }).living;
  assert.deepEqual(fam.ages.map((r) => [r.age, r.year, r.per100]), [[85, 2075, [58, 3, 39]], [90, 2080, [31, 4, 65]], [95, 2085, [10, 3, 87]]]);
  // the sex and health chosen on How long to plan for move it
  const q = migrate(familyPlan(T35)); q.retirement = { ...(q.retirement ?? {}), longevity: { "p-ana": { sex: "f", health: "better" }, "p-bo": { sex: "m", health: "better" } } };
  const better = compute(q, { today: T35, paths: 300, careful: false, living: true }).living;
  assert.ok(better.ages[1].alive > compute(migrate(familyPlan(T35)), { today: T35, paths: 300, careful: false, living: true }).living.ages[1].alive);
  // not asked: no key; no date: null
  assert.equal("living" in compute(migrate(familyPlan(T35)), { today: T35, paths: 100, careful: false }), false);
  assert.equal(MC.livingOdds(migrate(familyPlan(T35)), [{ age: 90, year: 2080, funded: 1 }], { today: null, inputs: { people: [{ id: "p-ana" }] } }), null);
});

test("#37 livingOdds by hand: an adult aged 87 sees 90, 95 and 100; a plan that ends at 92 shows 85 and 90 only", () => {
  const plan = (birthDate) => ({ household: { people: [{ id: "x", name: "Lou", role: "self", birthDate }] }, retirement: {} });
  const byAge = (from, to, f) => Array.from({ length: to - from + 1 }, (_, i) => ({ age: from + i, year: 2026 + i, funded: f(from + i) }));
  const old = MC.livingOdds(plan("1939-06-01"), byAge(87, 100, (a) => (a < 95 ? 1 : 0.5)), { today: T35, inputs: { people: [{ id: "x" }] } });
  assert.deepEqual(old.ages.map((r) => r.age), [90, 95, 100]);
  assert.equal(old.whose, "one");
  const s90 = LG.survival(87, 90, { sex: "", health: "average" });
  assert.ok(Math.abs(old.ages[0].alive - s90) < 1e-15);
  assert.deepEqual([old.ages[0].rich, old.ages[0].broke], [s90, 0]);
  const s95 = LG.survival(87, 95, { sex: "", health: "average" });
  assert.ok(Math.abs(old.ages[1].broke - s95 * 0.5) < 1e-15);
  const short = MC.livingOdds(plan("1966-06-01"), byAge(60, 92, () => 1), { today: T35, inputs: { people: [{ id: "x" }] } });
  assert.deepEqual(short.ages.map((r) => r.age), [85, 90]);
  // older than every age shown: no rows
  assert.deepEqual(MC.livingOdds(plan("1925-01-01"), byAge(101, 105, () => 1), { today: T35, inputs: { people: [{ id: "x" }] } }).ages, []);
});

test("#37 the sentence that reads the picture: one written out per case, for one adult and for a couple, with you and with names", () => {
  const row = (age, funded, alive) => { const rich = alive * funded, broke = alive * (1 - funded), dead = 1 - alive; return { age, year: 2000 + age, alive, funded, rich, broke, dead, per100: MC.per100([rich, broke, dead]) }; };
  const one = (clock, ages) => ({ whose: "one", names: [clock], clock, ages });
  const two = (clock, other, ages) => ({ whose: "either", names: [clock, other], clock, ages });
  const lasted = [row(85, 1, 0.55), row(90, 1, 0.3), row(95, 1, 0.12)];
  const gone = [row(85, 0, 0.41), row(90, 0, 0.23), row(95, 0, 0.09)];
  const few = [row(85, 0.999, 0.55), row(90, 0.995, 0.3), row(95, 0.99, 0.12)];
  const some = [row(85, 0.951, 0.605), row(90, 0.8825, 0.3526), row(95, 0.802, 0.1317)];
  const cases = [
    [one("Ruth", lasted), "lasted", "The money lasted to 95 in every pretend future, so at these ages the only question is whether Ruth is alive."],
    [one("Me", lasted), "lasted", "The money lasted to 95 in every pretend future, so at these ages the only question is whether you are alive."],
    [two("Ruth", "Sam", lasted), "lastedBoth", "The money lasted to 95 in every pretend future, so at these ages the only question is whether at least one of Ruth and Sam is alive."],
    [one("Riley", gone), "gone", "The money ran out by 85 in every pretend future: at 85, Riley is alive with the money gone in 41 of 100 pretend futures and no longer alive in 59."],
    [one("Me", gone), "gone", "The money ran out by 85 in every pretend future: at 85, you are alive with the money gone in 41 of 100 pretend futures and no longer alive in 59."],
    [two("Ana", "Bo", gone), "goneBoth", "The money ran out by 85 in every pretend future: when Ana would be 85, at least one of Ana and Bo is alive with the money gone in 41 of 100 pretend futures, and both have died in 59."],
    [one("Sam", few), "few", "At these ages, fewer than 1 in 100 pretend futures have Sam alive with the money gone."],
    [two("Me", "Bo", few), "fewBoth", "At these ages, fewer than 1 in 100 pretend futures have at least one of you and Bo alive with the money gone."],
    [one("Ana", some), "some", "At 90, Ana is alive with money left in 31 of 100 pretend futures, alive with the money gone in 4, and no longer alive in 65."],
    [one("Me", some), "some", "At 90, you are alive with money left in 31 of 100 pretend futures, alive with the money gone in 4, and no longer alive in 65."],
    [two("Ana", "Bo", some), "someBoth", "When Ana would be 90, at least one of Ana and Bo is alive with money left in 31 of 100 pretend futures, alive with the money gone in 4, and both have died in 65."],
    [two("Me", "Bo", some), "someBoth", "When you would be 90, at least one of you and Bo is alive with money left in 31 of 100 pretend futures, alive with the money gone in 4, and both have died in 65."],
  ];
  for (const [L, key, sentence] of cases) assert.deepEqual(view.livingFor(L), { key, sentence }, `${key} ${L.clock}`);
  // q1 fix P5: a couple's third count is "both have died", never "neither is alive"
  for (const [L] of cases) assert.ok(!/neither/.test(view.livingFor(L).sentence + view.livingKey(L).join(" ") + view.livingNote(L)), view.livingFor(L).sentence);
  // the counts under a bar, the line under the heading (q1 fix P4: out of 100, the bars above out of all), and the note: whose
  // life counts and where the odds come from, by the page's name (q1 fix P5: no "How long to plan for's", no "life tables")
  assert.deepEqual(view.livingRowWords(one("Ana", some), some[1]), ["31 alive, money left", "4 alive, money gone", "65 no longer alive"]);
  assert.deepEqual(view.livingRowWords(two("Ana", "Bo", some), some[1]), ["31 alive, money left", "4 alive, money gone", "65 both have died"]);
  assert.equal(view.livingScale(one("Ruth", lasted), 2000), "Out of 100 pretend futures at each age (the bars above count all 2,000).");
  assert.equal(view.livingScale(two("Ana", "Bo", some), 10000), "Out of 100 pretend futures at each of Ana's ages (the bars above count all 10,000).");
  assert.equal(view.livingScale(two("Me", "Bo", some), 1000), "Out of 100 pretend futures at each of your ages (the bars above count all 1,000).");
  assert.equal(view.livingScale(one("Ruth", lasted)), "Out of 100 pretend futures at each age.");
  assert.equal(view.livingNote(one("Ruth", lasted)), "The odds of living come from the How long to plan for page, with the sex and health chosen there.");
  assert.equal(view.livingNote(two("Ana", "Bo", some)), "Alive means at least one of Ana and Bo is. The odds of living come from the How long to plan for page, with the sex and health chosen there.");
  assert.equal(view.livingNote(two("Me", "Bo", some)), "Alive means at least one of you and Bo is. The odds of living come from the How long to plan for page, with the sex and health chosen there.");
  // what the three colours stand for, said once over the rows
  assert.deepEqual(view.livingKey(one("Ruth", lasted)), ["alive, money left", "alive, money gone", "no longer alive"]);
  assert.deepEqual(view.livingKey(two("Ana", "Bo", some)), ["alive, money left", "alive, money gone", "both have died"]);
  assert.equal(view.LIVING_TITLE, "Money and the odds of living");
});

test("#37 the page: in How the pretend futures end, the heading, the sentence, a bar in three parts per age with its counts, the note", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await page(familyPlan(T35));
  assert.equal(s.runs[0].params.living, true, "asked for with the page's one run");
  const d = compute(migrate(familyPlan(T35)), { today: T17, paths: 200, careful: false, endings: true, living: true });
  const L = d.living;
  const p = partOf(s.root, "endings");
  assert.equal(opened(p), false, "one tap away: the first view is as it was");
  assert.equal(titleOf(p), "How the pretend futures end");
  const body = seen(p.querySelector(".fold-body"));
  // each row: the age, its three counts in the colours' order (a screen reader hears them in words), then the bar; out of 100 is
  // said right under the heading, before any count (q1 fix P4), with the bars above counting all of the pretend futures (200 here)
  assert.equal(view.livingScale(L, d.endings.paths), "Out of 100 pretend futures at each of Ana's ages (the bars above count all 200).");
  const tail = ["Money and the odds of living", view.livingScale(L, d.endings.paths), view.livingFor(L).sentence, ...view.livingKey(L),
    ...L.ages.flatMap((r) => [`At ${r.age} (${r.year})`, r.per100.join(" · "), view.livingRowWords(L, r).join(", ")]), view.livingNote(L)].join(" ");
  assert.ok(body.endsWith(tail), body);
  assert.equal(L.whose, "either");
  assert.deepEqual(L.ages.map((r) => r.age), [85, 90, 95]);
  // each age's bar: three parts as wide as their shares, green, red and grey, adding to the whole bar
  const bars = everything(p).filter((e) => e.className === "progress").slice(-L.ages.length);
  bars.forEach((b, i) => {
    const r = L.ages[i];
    assert.equal(b.style.display, "flex");
    assert.deepEqual(b.childNodes.map((x) => x.style.width), [r.rich, r.broke, r.dead].map((x) => `${Math.round(1000 * x) / 10}%`));
    assert.deepEqual(b.childNodes.map((x) => x.style.background), ["var(--ok)", "var(--bad)", "var(--line-2)"]);
    assert.ok(Math.abs(b.childNodes.reduce((t, x) => t + parseFloat(x.style.width), 0) - 100) <= 0.15);
  });
  // a plan with nothing to show (the adult older than every age shown) has no block
  const ninety = migrate(familyPlan(T35));
  ninety.household.people = ninety.household.people.filter((x) => x.role !== "partner");
  ninety.household.people[0].birthDate = "1924-01-01"; ninety.household.people[0].lifeExpectancy = 104;
  const n = await page(ninety);
  const nb = partOf(n.root, "endings");
  if (nb) assert.ok(!seen(nb.querySelector(".fold-body")).includes("Money and the odds of living"));
  assert.equal(s.saved.length, 0, "reading changes nothing in the plan");
});
