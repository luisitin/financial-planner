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
  assert.equal(t, `Chance the money lasts ${a.value} ${a.label} ${a.lede} 8 more numbers › Set my own numbers 9 in 10 › How this is done ›`);
  assert.deepEqual(rowsOf(s.root), [["numbers", "more", "8 more numbers", "", false], ["careful", "own", "Set my own numbers", "9 in 10", false], ["how", "how", "How this is done", "", false]]);
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
  assert.match(all("how"), /How many pretend futures to try: 1,000 \(quick\) 2,000 10,000$/);
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
  assert.deepEqual(rowsOf(s.root).map((r) => r[4]), [false, true, false], "no other part opens");
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
  assert.deepEqual(before, { numbers: false, careful: false, how: false });
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
