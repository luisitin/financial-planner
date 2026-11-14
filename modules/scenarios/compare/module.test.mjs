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

// ---- gap design #25 (2026-11-14): more levers, and "Make this my plan" ---------------------------------------------------------
const T25 = "2026-11-14";
const fresh25 = async () => {
  const { migrate } = await import("../../../core/schema/migrate.js");
  return migrate(structuredClone(familyPlan(T25)));
};
const ALL25 = { "retireAge:p-ana": 60, "claimAge:p-bo": 68, spendingMonthly: 5500, extraSavingMonthly: 500, fee: 0.01, lumpSum: 50000, lumpYear: 2030,
  spendingEase: 0.01, strategy: "guardrails", homeYear: 2045, homeBuyFor: 250000, lessWho: "p-bo", lessFrom: 2030, lessUntil: 2032, lessShare: 0.5 };

test("#25 new levers: each gives the engine exactly what the plan's own field or line gives (test 4)", async () => {
  const { saveHappening } = await import("../../retirement/happenings.js");
  const p = await fresh25();
  const eq = (changes, mutate) => {
    const q = structuredClone(p); mutate(q);
    const a = project(applyChanges(p, changes, { today: T25 }).inputs), b = project(buildInputs(q, { today: T25 }).inputs);
    assert.equal(a.success, b.success, JSON.stringify(changes)); assert.equal(a.endBalanceReal, b.endBalanceReal, JSON.stringify(changes)); assert.deepEqual(a.rows.map((r) => r.totalReal), b.rows.map((r) => r.totalReal));
    assert.notEqual(a.endBalanceReal, project(buildInputs(p, { today: T25 }).inputs).endBalanceReal, `${JSON.stringify(changes)} moves the answer`);
  };
  eq({ homeYear: 2045, homeBuyFor: 250000 }, (q) => saveHappening(q, { id: "h1", kind: "home", year: 2045, buyFor: 250000 }));
  eq({ homeYear: 2045, homeRent: 1500 }, (q) => saveHappening(q, { id: "h1", kind: "home", year: 2045, buyFor: 0, rentMonthly: 1500 }));
  eq({ homeYear: 2045 }, (q) => saveHappening(q, { id: "h1", kind: "home", year: 2045, buyFor: 0, rentMonthly: 0 }));
  eq({ lessWho: "p-bo", lessFrom: 2030, lessUntil: 2032, lessShare: 0.5 }, (q) => saveHappening(q, { id: "h1", kind: "less", personId: "p-bo", year: 2030, untilYear: 2032, share: 0.5 }));
  eq({ lessFrom: 2030 }, (q) => saveHappening(q, { id: "h1", kind: "less", personId: "p-ana", year: 2030, untilYear: 2030, share: 0 }));
  eq({ strategy: "guardrails" }, (q) => { q.retirement.strategy = "guardrails"; });
  eq({ strategy: "vpw" }, (q) => { q.retirement.strategy = "vpw"; });
  eq({ spendingEase: 0.01 }, (q) => { q.retirement.spendingEase = 0.01; });
  eq({ spendingEase: 0.02 }, (q) => { q.retirement.spendingEase = 0.02; });
});

test("#25 happeningsOf: nothing without a year; the home sold here takes the place of one sold in the plan", async () => {
  const { happeningsOf, HAPPENING_KEYS } = await import("./compute.js");
  const p = await fresh25();
  assert.deepEqual(happeningsOf(p, { homeBuyFor: 250000, homeRent: 900, lessUntil: 2031, lessShare: 0.5, lessWho: "p-bo" }), []);
  assert.deepEqual(happeningsOf(p, { homeYear: 2045, homeBuyFor: 250000, homeRent: 900 }), [{ kind: "home", year: 2045, buyFor: 250000, rentMonthly: null }]);
  assert.deepEqual(happeningsOf(p, { homeYear: "2045" }), [{ kind: "home", year: 2045, buyFor: 0, rentMonthly: 0 }]);
  assert.deepEqual(happeningsOf(p, { lessFrom: 2030, lessShare: 1.4 }), [{ kind: "less", personId: "p-ana", year: 2030, untilYear: 2030, share: 1 }]);
  assert.deepEqual(HAPPENING_KEYS, ["homeYear", "homeBuyFor", "homeRent", "lessWho", "lessFrom", "lessUntil", "lessShare"]);
  p.retirement.happenings = [{ id: "h1", kind: "home", year: 2050, buyFor: 0, rentMonthly: 0 }, { id: "h2", kind: "out", year: 2031, amount: 9000 }];
  const a = applyChanges(p, { homeYear: 2045, homeRent: 1500 }, { today: T25 });
  assert.deepEqual(a.plan.retirement.happenings, [{ id: "h1", kind: "home", year: 2045, buyFor: 0, rentMonthly: 1500 }, { id: "h2", kind: "out", year: 2031, amount: 9000 }]);
  assert.equal(p.retirement.happenings.length, 2, "the plan itself is untouched");
});

test("#25 describe and notesOf: the words of each new lever, and one sentence per thing the sums leave out", async () => {
  const { notesOf } = await import("./compute.js");
  const p = await fresh25();
  assert.deepEqual(describe(p, { spendingEase: 0.01, strategy: "guardrails", homeYear: 2045, homeBuyFor: 250000, lessWho: "p-bo", lessFrom: 2030, lessUntil: 2032, lessShare: 0.5 }),
    ["spending eases 1% a year as you age", "money is taken out this way: Trim after bad years", "sell the home in 2045 and buy one for $250,000", "Bo works half-time 2030 to 2032"]);
  assert.deepEqual(describe(p, { spendingEase: 0, homeYear: 2045, homeRent: 1500, lessFrom: 2030 }), ["spending stays the same as you age", "sell the home in 2045 and rent for $1,500 a month", "Ana takes a break from work in 2030"]);
  assert.deepEqual(describe(p, { homeYear: 2045, strategy: "no such way", lessWho: "p-bo" }), ["sell the home in 2045 with no housing cost after"]);
  const I = (ch) => applyChanges(p, ch, { today: T25 }).inputs;
  assert.deepEqual(notesOf(p, { homeYear: 2045 }, I({ homeYear: 2045 }), { today: T25 }), []);
  assert.deepEqual(notesOf(p, { homeYear: 2020 }, I({ homeYear: 2020 }), { today: T25 }), ["Selling the home is left out of this version. 2020 has passed. Pick a year from 2026 to " + I({}).endYear + ", when the plan ends."]);
  const stops = I({}).people[0].birthYear + I({}).people[0].retireAge;
  assert.deepEqual(notesOf(p, { lessFrom: stops + 1 }, I({ lessFrom: stops + 1 }), { today: T25 }), [`Working less is left out of this version. Ana stops work in ${stops} in this plan. Pick years before that, or change the age on the People page.`]);
  assert.deepEqual(notesOf(p, { spendingEase: 0.01, strategy: "percent" }, I({ spendingEase: 0.01, strategy: "percent" }), { today: T25 }), ["Spending as you age is left out of this version: this way of taking money out sets its own spending."]);
  assert.deepEqual(notesOf(p, { spendingEase: 0.01 }, I({ spendingEase: 0.01 }), { today: T25 }), []);
  const renter = structuredClone(p); renter.accounts = renter.accounts.filter((a) => a.type !== "property"); renter.property = [];
  assert.deepEqual(notesOf(renter, { homeYear: 2045 }, applyChanges(renter, { homeYear: 2045 }, { today: T25 }).inputs, { today: T25 }), ["Selling the home is left out of this version. The plan has no home to sell. Add it under What you own first."]);
  // compute hands the notes to the page only when there are some
  const q = structuredClone(p); q.scenarios = [{ id: "a", name: "A", changes: { homeYear: 2020 } }, { id: "b", name: "B", changes: { homeYear: 2045 } }];
  const d = compute(q, { today: T25, paths: 0 });
  assert.equal(d.scenarios[0].notes.length, 1); assert.ok(!("notes" in d.scenarios[1]));
});

test("#25 carry: what would change, what the plan already has, what is not carried and why (test 3)", async () => {
  const { carry, NOT_CARRIED } = await import("./compute.js");
  const p = await fresh25();
  const c = carry(p, ALL25, { today: T25 });
  assert.deepEqual(c.carried, ["Ana retires at 60", "Bo starts Social Security at 68", "spend $5,500 a month in retirement", "spending eases 1% a year as you age", "money is taken out this way: Trim after bad years",
    "sell the home in 2045 and buy one for $250,000", "Bo works half-time 2030 to 2032", "$50,000 arrives in 2030"]);
  assert.deepEqual(c.not, [NOT_CARRIED.saving, NOT_CARRIED.fee]);
  assert.equal(NOT_CARRIED.fee, "Not carried: fees are set on the Fees page.");
  assert.equal(NOT_CARRIED.saving, "Not carried: saving more each month is set on the Retirement contributions page.");
  assert.equal(c.same, 0);
  // what the plan already has is not counted; a fee or extra saving of 0 is nothing
  const s = carry(p, { "retireAge:p-ana": 65, "claimAge:p-bo": 67, inflation: 0.035, fee: 0, extraSavingMonthly: 0, lumpSum: 0 }, { today: T25 });
  assert.deepEqual([s.carried, s.same, s.not], [["prices rise 3.5% a year"], 2, []]);
  // a line the plan could not count is not written, and says why; a cost is a cost
  const bad = carry(p, { lumpSum: -20000, lumpYear: 2020, homeYear: 2020, lessFrom: 2030, lessUntil: 2029 }, { today: T25 });
  assert.deepEqual(bad.carried, []);
  assert.equal(bad.not.length, 3);
  assert.match(bad.not[0], /^Not carried: sell the home in 2020 with no housing cost after\. 2020 has passed\. Pick a year from 2026 to \d{4}, when the plan ends\.$/);
  assert.equal(bad.not[1], "Not carried: Ana takes a break from work 2030 to 2029. The last year cannot be before the first (2030).");
  assert.match(bad.not[2], /^Not carried: \$20,000 is spent in 2020\. 2020 has passed\./);
  assert.deepEqual(carry(p, { lumpSum: -20000 }, { today: T25 }).carried, ["$20,000 is spent this year"]);
  // a person who is no longer in the plan: nothing to write
  assert.deepEqual(carry(p, { "retireAge:p-gone": 60 }, { today: T25 }).carried, []);
});

test("#25 the sentences: the question, the green line, the line after putting back (one per case)", async () => {
  const { askWords, madeWords, backWords } = await import("./compute.js");
  assert.equal(askWords({ carried: ["Ana retires at 63", "spend $5,500 a month in retirement", "Ana starts Social Security at 68"], same: 0, not: [] }), "This changes 3 things in your plan: Ana retires at 63; spend $5,500 a month in retirement; Ana starts Social Security at 68. You can undo it.");
  assert.equal(askWords({ carried: ["Ana retires at 63"], same: 2, not: ["x"] }), "This changes 1 thing in your plan: Ana retires at 63. You can undo it.");
  assert.equal(askWords({ carried: [], same: 2, not: ["x"] }), "Nothing in this version can be put into your plan from here.");
  assert.equal(askWords({ carried: [], same: 2, not: [] }), "Your plan already has everything in this version.");
  assert.equal(askWords({ carried: [], same: 0, not: [] }), "This version changes nothing yet. Tap Edit to change something first.");
  assert.equal(madeWords("Retire at 60", 3, { lasts: true, endAge: 95 }), 'Your plan now has the 3 changes from "Retire at 60". At average markets the money now lasts to the end (age 95).');
  assert.equal(madeWords("Retire at 60", 1, { lasts: false, age: 88 }), 'Your plan now has the 1 change from "Retire at 60". At average markets the money now runs out at 88.');
  assert.equal(madeWords("Retire at 60", 2, null), 'Your plan now has the 2 changes from "Retire at 60".');
  assert.equal(backWords("Retire at 60", { done: 3, kept: 0 }), 'Your plan is back as it was before "Retire at 60".');
  assert.equal(backWords("Retire at 60", { done: 2, kept: 1 }), 'Your plan is back as it was before "Retire at 60", except what you changed after that: that was left as it is.');
  assert.equal(backWords("Retire at 60", { done: 0, kept: 3 }), "Nothing to put back: all of it was changed again after that.");
});

test("#25 Make this my plan writes exactly the lever fields, and the plan then gives the version's answer (test 1)", async () => {
  const { makeMyPlan, answerFor } = await import("./compute.js");
  const p = await fresh25();
  p.scenarios = [{ id: "s1", name: "All of it", changes: ALL25, createdAt: T25 }, { id: "s2", name: "Other", changes: { inflation: 0.04 } }];
  p.guide = { ...(p.guide ?? {}), setup: { ...(p.guide?.setup ?? {}), retireAuto: true } };
  const before = structuredClone(p);
  const r = makeMyPlan(p, "s1", { today: T25 });
  assert.equal(r.carried.length, 8); assert.equal(r.not.length, 2);
  // every path that moved, and nothing else
  const paths = r.changes.map((c) => c.path.map((s) => (typeof s === "object" ? s.id : s)).join("."));
  assert.deepEqual(paths.sort(), ["guide.setup.retireAuto", "guide.setup.retireHeld", "household.people.p-ana.retirementAge", "retirement.happenings", "retirement.socialSecurity.p-bo.claimAge", "retirement.spendingEase", "retirement.spendingMonthly", "retirement.strategy"].sort());
  assert.equal(p.household.people.find((x) => x.id === "p-ana").retirementAge, 60); assert.equal(p.retirement.socialSecurity["p-bo"].claimAge, 68);
  assert.equal(p.retirement.spendingMonthly, 5500); assert.equal(p.guide.setup.retireAuto, false, "a typed figure, as in the version");
  assert.equal(p.retirement.spendingEase, 0.01); assert.equal(p.retirement.strategy, "guardrails");
  assert.deepEqual(p.retirement.happenings, [{ id: "h1", kind: "home", year: 2045, buyFor: 250000 }, { id: "h2", kind: "less", year: 2030, personId: "p-bo", untilYear: 2032, share: 0.5 }, { id: "h3", kind: "in", year: 2030, amount: 50000 }]);
  // not carried: no saving row, no fee anywhere; the other version and every other section are as they were
  assert.ok(!(p.retirement.contributions ?? []).some((c) => c.id === "scenario-extra"));
  assert.deepEqual(p.scenarios[1], before.scenarios[1]); assert.deepEqual(p.scenarios[0].changes, ALL25);
  for (const k of Object.keys(before)) if (!["household", "retirement", "guide", "scenarios"].includes(k)) assert.deepEqual(p[k], before[k], k);
  assert.deepEqual(p.scenarios[0].madePlan, { on: T25, words: r.carried, changes: r.changes });
  // the plan now answers as the version did, less what was not carried (the fee and the extra saving). The one-time sum is
  // set apart: as a line of the plan it is also seen by the health line before 65 (help with marketplace insurance follows
  // income), which a sum added to a what-if is not, so with an early retirement the two can differ a little (README)
  const answers = (changes) => {
    const q = structuredClone(before); q.scenarios = [{ id: "x", name: "x", changes }];
    const was = project(applyChanges(q, changes, { today: T25 }).inputs);
    makeMyPlan(q, "x", { today: T25 });
    return [was, project(buildInputs(q, { today: T25 }).inputs)];
  };
  const { fee, extraSavingMonthly, lumpSum, lumpYear, ...kept } = ALL25;
  void fee; void extraSavingMonthly;
  for (const changes of [kept, { lumpSum, lumpYear }, { lumpSum: -20000 }]) {
    const [was, now] = answers(changes);
    assert.equal(now.success, was.success); assert.equal(now.endBalanceReal, was.endBalanceReal, JSON.stringify(changes));
  }
  { const [was, now] = answers({ ...kept, lumpSum, lumpYear }); assert.equal(now.success, was.success); near(now.endBalanceReal, was.endBalanceReal, 0.03 * was.endBalanceReal); }
  assert.equal(answerFor(p, { today: T25 }).lasts, project(buildInputs(p, { today: T25 }).inputs).success);
  // a version with nothing to carry leaves the draft alone; an unknown version is no version
  const q = structuredClone(before); q.scenarios.push({ id: "s3", name: "Fee", changes: { fee: 0.01 } });
  const text = JSON.stringify(q);
  assert.deepEqual(makeMyPlan(q, "s3", { today: T25 }), { carried: [], same: 0, not: ["Not carried: fees are set on the Fees page."], changes: [] });
  assert.equal(makeMyPlan(q, "nope", { today: T25 }), null); assert.equal(JSON.stringify(q), text);
});

test("#25 putting the plan back restores it byte for byte, for every invented household (test 2)", async () => {
  const { makeMyPlan, putBack } = await import("./compute.js");
  const { migrate, emptyPlan } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const plans = [["family", familyPlan(T25)], ["retired couple", retiredCouplePlan(T25)], ["renter", renterDebtPlan(T25)], ["empty", emptyPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  let moved = 0;
  for (const [name, raw] of plans) {
    const p = migrate(structuredClone(raw));
    const adults = (p.household?.people ?? []).filter((x) => x.role !== "dependent");
    const changes = { spendingMonthly: 4321, stocksNow: 0.55, stocksRetired: 0.35, returnStocks: 0.061, returnBonds: 0.031, inflation: 0.027, fee: 0.01, extraSavingMonthly: 250, lumpSum: -15000, lumpYear: 2028,
      spendingEase: 0.02, strategy: "vpw", homeYear: 2040, homeRent: 1200, lessFrom: 2027, lessUntil: 2028, lessShare: 0.5 };
    for (const a of adults) { changes[`retireAge:${a.id}`] = 61; changes[`claimAge:${a.id}`] = 69; }
    p.scenarios = [...(p.scenarios ?? []), { id: "v1", name: "Everything", changes, createdAt: T25 }];
    const before = JSON.stringify(p);
    const r = makeMyPlan(p, "v1", { today: T25 });
    if (r.carried.length) { moved++; assert.notEqual(JSON.stringify(p), before, name); assert.ok(p.scenarios.at(-1).madePlan, name); }
    const back = putBack(p, "v1");
    assert.equal(JSON.stringify(p), before, `${name}: the plan of before, byte for byte`);
    assert.equal(back.kept, 0, name); assert.equal(back.done, r.changes.length, name);
    assert.deepEqual(putBack(p, "v1"), { done: 0, kept: 0 }, "nothing left to put back");
  }
  assert.ok(moved >= plans.length - 1, `${moved} of ${plans.length} plans had something to carry`);
  // a plan that already holds lines and a home sale: the lines of before come back in their places
  const p = await fresh25();
  p.retirement.happenings = [{ id: "h1", kind: "home", year: 2050, buyFor: 0, rentMonthly: 0 }, { id: "h2", kind: "out", year: 2031, amount: 9000, name: "A new roof" }];
  p.scenarios = [{ id: "v1", name: "Sell sooner", changes: { homeYear: 2045, homeRent: 1500, lumpSum: 1000 } }];
  const before = JSON.stringify(p);
  makeMyPlan(p, "v1", { today: T25 });
  assert.deepEqual(p.retirement.happenings.map((h) => [h.id, h.kind, h.year]), [["h1", "home", 2045], ["h2", "out", 2031], ["h3", "in", 2026]]);
  putBack(p, "v1");
  assert.equal(JSON.stringify(p), before);
});

test("#25 putting back never overwrites what was changed since; through the app's own store it is one undo (core/ui/undo.js)", async () => {
  const { makeMyPlan, putBack } = await import("./compute.js");
  const p = await fresh25();
  p.scenarios = [{ id: "v1", name: "Retire at 60", changes: { "retireAge:p-ana": 60, spendingMonthly: 5500 } }];
  const before = structuredClone(p);
  makeMyPlan(p, "v1", { today: T25 });
  p.retirement.spendingMonthly = 6100;            // the person changes one of them again, elsewhere
  p.income[0].amount = 1;                         // and something the version never touched
  const r = putBack(p, "v1");
  assert.deepEqual(r, { done: 1, kept: 1 });
  assert.equal(p.household.people.find((x) => x.id === "p-ana").retirementAge, before.household.people.find((x) => x.id === "p-ana").retirementAge);
  assert.equal(p.retirement.spendingMonthly, 6100); assert.equal(p.income[0].amount, 1);
  assert.ok(!("madePlan" in p.scenarios[0]));
});

// ---- #25 on the page: one quiet row per version, the question in words, the green line, the way back --------------------------
async function page25(plan0) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const s = { p: plan0, saved: [], root: null, textOf };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  s.draw = () => { s.root = new FakeElement("main"); render(s.root, { ui, fmt: { ...fmt, today: () => T25 }, plan: s.p, route: { group: "scenarios", id: "compare", rest: [], query: {} }, module: { group: "scenarios", id: "compare" },
    store: { get: () => s.p, update: (fn) => { const d = structuredClone(s.p); fn(d); s.saved.push(d); s.p = d; s.draw(); } }, redraw: s.draw,
    computeRemote: async (key, params) => compute(s.p, { ...params, paths: 0 }) }); };
  s.draw();
  s.settle = async () => { await tick(); await tick(); };
  await s.settle();
  s.narrow = () => s.root.all().find((e) => /\bonly-narrow\b/.test(e.className));
  s.parts = (within = s.root) => within.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part !== undefined);
  s.button = (text, within = s.root) => within.all().find((e) => e.tagName === "BUTTON" && e.textContent === text);
  return s;
}

test("#25 page: the row is shut and quiet, only on a version the plan can take; opened it asks in words and lists what is not carried", async () => {
  const { structure, handWritten } = await import("../../../qa/first-view-lib.mjs");
  const p = await fresh25();
  p.scenarios = [{ id: "a", name: "Retire at 60", changes: { "retireAge:p-ana": 60, "retireAge:p-bo": 60, spendingMonthly: 5500, fee: 0.01 } }, { id: "b", name: "Pay a 1% advisor fee", changes: { fee: 0.01 } }, { id: "c", name: "As it is", changes: { "retireAge:p-ana": 65 } }];
  const s = await page25(p);
  const rows = s.parts(s.narrow());
  assert.deepEqual(rows.map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open"), e.querySelector(".fold-title").textContent, e.querySelector(".fold-status").textContent]), [["use-a", "item", false, "Make this my plan", "3 changes"]],
    "one row, on the one version with something to carry: a fee alone, or what the plan already has, gets none");
  const body = s.textOf(rows[0].querySelector(".fold-body"));
  assert.match(body, /This changes 3 things in your plan: Ana retires at 60; Bo retires at 60; spend \$5,500 a month in retirement\. You can undo it\./);
  assert.match(body, /Not carried: fees are set on the Fees page\./, "the input-only list is shown (test 3)");
  assert.ok(s.button("Make this my plan", rows[0]) && /secondary/.test(s.button("Make this my plan", rows[0]).className), "one outlined button");
  // a wide screen has the same, one row per version, named for it
  const wide = s.parts().filter((e) => !rows.includes(e));
  assert.deepEqual(wide.map((e) => [e.dataset.part, e.querySelector(".fold-title").textContent]), [["usew-a", "Retire at 60"]]);
  assert.deepEqual([...structure(s.root, { key: "scenarios/compare" }), ...handWritten(s.root)], [], "the helper's parts, worth a tap, nothing folded that must be seen");
  assert.equal(s.saved.length, 0, "drawing and reading change nothing");
});

test("S11: #25 page: one tap makes it the plan and says so in green with the new answer; the way back survives a redraw and restores the plan exactly", async () => {
  const p = await fresh25();
  p.scenarios = [{ id: "a", name: "Retire at 60", changes: { "retireAge:p-ana": 60, "retireAge:p-bo": 60, spendingMonthly: 5500, fee: 0.01 } }, { id: "b", name: "Lower returns", changes: { returnStocks: 0.06 } }];
  const before = JSON.stringify(p);
  const s = await page25(p);
  s.button("Make this my plan", s.narrow()).click();
  await s.settle();
  assert.equal(s.saved.length, 1, "one change of the plan");
  assert.equal(s.p.household.people[0].retirementAge, 60); assert.equal(s.p.retirement.spendingMonthly, 5500);
  let row = s.parts(s.narrow()).find((e) => e.dataset.part === "use-a");
  assert.ok(row.hasAttribute("open"), "the part just used stays open (R17)");
  // the row says what it now is, and where the way back is (critic P1): not "Make this my plan" any more
  assert.deepEqual([row.querySelector(".fold-title").textContent, row.querySelector(".fold-status").textContent], ["This is your plan now", "you can undo it"]);
  const green = row.all().find((e) => /\bnotice\b/.test(e.className) && /\bok\b/.test(e.className));
  // the fee was not carried, so the plan's new answer is not the version's: the green line says so (critic M2)
  assert.match(green.textContent, /^Your plan now has the 3 changes from "Retire at 60"\. At average markets the money now (lasts to the end \(age \d+\)|runs out at \d+)\. That is without what was not carried\.$/);
  // Undo is the first thing under the green line, and is called Undo (critic P4)
  const inBody = row.querySelector(".fold-body").all().filter((e) => e === green || e.tagName === "BUTTON" || e.tagName === "P");
  assert.equal(inBody[0], green); assert.deepEqual([inBody[1].tagName, inBody[1].textContent], ["BUTTON", "Undo: put my plan back"]);
  assert.ok(/secondary/.test(inBody[1].className), "outlined");
  assert.ok(!s.button("Make this my plan", row), "nothing to make twice");
  assert.match(s.textOf(row), /Not carried: fees are set on the Fees page\./, "what the green line means by 'not carried' is still said under it");
  assert.match(s.textOf(row), /You made this your plan on .*2026\. It changed 3 things: Ana retires at 60; Bo retires at 60; spend \$5,500 a month in retirement\./);
  assert.deepEqual(s.parts(s.narrow()).map((e) => [e.dataset.part, e.hasAttribute("open")]), [["use-a", true], ["use-b", false]], "no other part opened");
  // a later visit (a fresh draw, nothing pending): the row is shut, says where it stands, and still holds the way back
  s.draw(); await s.settle();
  row = s.parts(s.narrow()).find((e) => e.dataset.part === "use-a");
  assert.ok(!row.hasAttribute("open")); assert.equal(row.querySelector(".fold-title").textContent, "This is your plan now");
  assert.equal(s.parts().find((e) => e.dataset.part === "usew-a").querySelector(".fold-status").textContent, "in your plan", "a wide screen names the version and says where it stands");
  assert.ok(!row.all().some((e) => /\bnotice\b/.test(e.className)), "the green line was said once");
  s.button("Undo: put my plan back", row).click();
  await s.settle();
  assert.equal(JSON.stringify(s.p), before, "the plan of before, byte for byte");
  row = s.parts(s.narrow()).find((e) => e.dataset.part === "use-a");
  assert.ok(row.hasAttribute("open"));
  assert.equal(row.all().find((e) => /\bnotice\b/.test(e.className)).textContent, 'Your plan is back as it was before "Retire at 60".');
  assert.deepEqual([row.querySelector(".fold-title").textContent, row.querySelector(".fold-status").textContent], ["Make this my plan", "3 changes"], "and it can be made the plan again");
});

test("#25 page: Remove says what goes with a version that is in the plan", async () => {
  const { removeWords } = await import("./view.js");
  assert.equal(removeWords("Retire at 60", false), "Remove Retire at 60?");
  assert.equal(removeWords("Retire at 60", true), "Remove Retire at 60? Your plan stays as it is now. The way to put it back as it was goes with this version.");
});

test("#25 form: five boxes first, the rest under More details (optional), the new levers last; a version left out of the sums says why", async () => {
  const { offers } = await import("./compute.js");
  const p = await fresh25();
  p.scenarios = [{ id: "a", name: "Sell and slow down", changes: { homeYear: 2020, lessWho: "p-bo", lessFrom: 2030, lessUntil: 2032, lessShare: 0.5, spendingEase: 0.01, strategy: "guardrails" } }];
  const s = await page25(p);
  assert.match(s.textOf(s.narrow()), /sell the home in 2020 with no housing cost after; Bo works half-time 2030 to 2032/);
  const warn = s.narrow().all().filter((e) => /\bnotice\b/.test(e.className) && /\bwarn\b/.test(e.className)).map((e) => e.textContent);
  assert.equal(warn.length, 1); assert.match(warn[0], /^Selling the home is left out of this version\. 2020 has passed\./);
  s.button("Edit", s.narrow()).click();
  const form = s.root.querySelector("form");
  const fold = form.all().find((e) => e.tagName === "DETAILS" && /form-more/.test(e.className));
  const names = (el) => el.all().filter((e) => /^(INPUT|SELECT)$/.test(e.tagName)).map((e) => e.getAttribute("name"));
  const folded = names(fold);
  assert.deepEqual(names(form).filter((n) => !folded.includes(n)), ["name", "retireAge:p-ana", "retireAge:p-bo", "spendingMonthly", "extraSavingMonthly"]);
  assert.deepEqual(folded.slice(-9), ["spendingEase", "strategy", "homeYear", "homeBuyFor", "homeRent", "lessWho", "lessFrom", "lessUntil", "lessShare"]);
  assert.ok(fold.hasAttribute("open"), "it holds something, so it is open");
  assert.equal(form.elements.strategy.value, "guardrails"); assert.equal(form.elements.spendingEase.value, "0.01"); assert.equal(form.elements.lessWho.value, "p-bo");
  for (const label of ["Spending as you age", "How money is taken out", "Year I sell or downsize the home", "Work less from"]) assert.ok(s.textOf(fold).includes(label), label);
  // every choice of the two lists fits a 320 px screen (critic P3: "As the plan has it (stays the ..." was cut off), and the
  // one sentence under each list says what the choice it shows does (P2), following the list as it changes
  for (const key of ["spendingEase", "strategy"]) {
    const labels = form.elements[key].all().filter((e) => e.tagName === "OPTION").map((e) => e.textContent);
    assert.equal(labels[0], "Same as my plan");
    assert.ok(labels.every((x) => x.length <= 36), `${key}: ${labels.join(" | ")}`);
  }
  const helpOf = (key) => form.elements[key].closest("label").querySelector(".help").textContent;
  assert.equal(helpOf("strategy"), "What you plan, trimmed by a tenth after bad years and raised back after good ones.");
  assert.equal(helpOf("spendingEase"), "Each year you spend 1% less than the year before, in today's dollars. Health insurance is not eased.");
  form.elements.strategy.value = ""; form.elements.strategy.dispatch("change");
  assert.equal(helpOf("strategy"), "Your plan: same spending every year. Pick another to see what it does.");
  form.elements.strategy.value = "vpw"; form.elements.strategy.dispatch("change");
  assert.equal(helpOf("strategy"), "What savings can pay over the years left, on top of your income.");
  form.elements.strategy.value = "guardrails"; form.elements.strategy.dispatch("change");
  assert.ok(!s.textOf(fold).includes("a year\n") && !/home in\b/.test(s.textOf(fold)), "the home's year box is named whole (critic P5)");
  // what the form offers follows the plan: no home, no home boxes; nobody still at work, no working-less boxes
  const o = offers(p, { today: T25 });
  assert.equal(o.home, true); assert.deepEqual(o.workers.map((w) => w.id), ["p-ana", "p-bo"]); assert.equal(o.strategy, "fixed-real"); assert.equal(o.ease, 0);
  const q = structuredClone(p); q.accounts = q.accounts.filter((a) => a.type !== "property"); q.household.people.forEach((x) => { if (x.role !== "dependent") x.retirementAge = 30; });
  assert.deepEqual([offers(q, { today: T25 }).home, offers(q, { today: T25 }).workers], [false, []]);
  // saving the form writes the version (numbers as numbers, the list choice as its word), never the plan
  form.reset = () => {};
  form.elements.homeYear.value = "2044"; form.elements.homeRent.value = "1500";
  form.dispatch("submit");
  const saved = s.saved.at(-1);
  assert.deepEqual(saved.scenarios[0].changes, { spendingEase: 0.01, strategy: "guardrails", homeYear: 2044, homeRent: 1500, lessWho: "p-bo", lessFrom: 2030, lessUntil: 2032, lessShare: 0.5 });
  const { scenarios: a, meta: m1, ...restA } = saved; const { scenarios: b, meta: m2, ...restB } = p;
  void a; void b; void m1; void m2;
  assert.deepEqual(restA, restB, "only the version moved");
});

test("#25 form: a price or a share with no year is held back at Save, in words", async () => {
  const p = await fresh25();
  const s = await page25(p);
  s.button("+ Make your own").click();
  const form = s.root.querySelector("form");
  form.reset = () => {};
  form.elements.name.value = "Rent later"; form.elements.homeRent.value = "1500";
  form.dispatch("submit");
  assert.equal(s.saved.length, 0);
  assert.match(s.textOf(s.root), /Type the year the home is sold, or clear the price and the rent\./);
  form.elements.homeRent.value = ""; form.elements.lessShare.value = "50";
  form.dispatch("submit");
  assert.equal(s.saved.length, 0);
  assert.match(s.textOf(s.root), /Type the first year of working less, or clear the last year and the share\./);
  form.elements.lessFrom.value = "2030";
  form.dispatch("submit");
  assert.deepEqual(s.saved.at(-1).scenarios.at(-1).changes, { lessWho: "p-ana", lessFrom: 2030, lessShare: 0.5 });
});

// ---- the critics' round (2026-11-14): each finding with the test that would have caught it ----------------------------------
test("#25 M3: a way of taking money out is one of the ways' own keys, never a name every object has", async () => {
  const { carry, makeMyPlan, offers } = await import("./compute.js");
  for (const bad of ["__proto__", "constructor", "toString", "hasOwnProperty", "no such way"]) {
    const p = await fresh25();
    p.scenarios = [{ id: "v", name: "V", changes: { strategy: bad } }];
    assert.deepEqual(describe(p, { strategy: bad }), [], bad);
    assert.deepEqual(carry(p, { strategy: bad }, { today: T25 }).carried, [], bad);
    const before = JSON.stringify(p);
    assert.deepEqual(makeMyPlan(p, "v", { today: T25 }).carried, []);
    assert.equal(JSON.stringify(p), before, `${bad}: nothing written`);
    assert.equal(applyChanges(p, { strategy: bad }, { today: T25 }).plan.retirement?.strategy, p.retirement?.strategy);
    p.retirement.strategy = bad;          // and a plan that holds one reads as the usual way
    assert.equal(LEVERS.find((l) => l.key === "strategy").get(p), "fixed-real"); assert.equal(offers(p, { today: T25 }).strategy, "fixed-real");
  }
});

test("#25 M4: Make this my plan twice (a second tab) writes once and keeps the first way back", async () => {
  const { makeMyPlan, putBack } = await import("./compute.js");
  const p = await fresh25();
  p.scenarios = [{ id: "v", name: "V", changes: { lumpSum: -5000, spendingMonthly: 5500 } }];
  const before = JSON.stringify(p);
  assert.equal(makeMyPlan(p, "v", { today: T25 }).carried.length, 2);
  const once = JSON.stringify(p);
  const again = makeMyPlan(p, "v", { today: T25 });
  assert.deepEqual(again, { carried: [], same: 0, not: [], changes: [], already: true });
  assert.equal(JSON.stringify(p), once, "the second tap wrote nothing: one line of a big cost, the first record");
  assert.equal(p.retirement.happenings.filter((h) => h.kind === "out").length, 1);
  putBack(p, "v");
  assert.equal(JSON.stringify(p), before, "and the first way back still restores the plan of before");
});

test("#25 M5: putting back a record edited by hand never throws; what it can read it still puts back", async () => {
  const { makeMyPlan, putBack } = await import("./compute.js");
  for (const junk of [[null], [{}], ["x", 7, { path: "retirement" }], { 0: null }, null]) {
    const p = await fresh25();
    p.scenarios = [{ id: "v", name: "V", changes: {}, madePlan: { changes: junk } }];
    const before = JSON.stringify({ ...p, scenarios: null });
    assert.deepEqual(putBack(p, "v"), { done: 0, kept: 0 }, JSON.stringify(junk));
    assert.ok(!("madePlan" in p.scenarios[0])); assert.equal(JSON.stringify({ ...p, scenarios: null }), before);
  }
  const p = await fresh25();
  p.scenarios = [{ id: "v", name: "V", changes: { spendingMonthly: 5500 } }];
  const was = p.retirement.spendingMonthly;
  makeMyPlan(p, "v", { today: T25 });
  p.scenarios[0].madePlan.changes.push(null, {});
  assert.equal(putBack(p, "v").kept, 0); assert.equal(p.retirement.spendingMonthly, was);
});

test("#25 M6: a year of the one-time sum that is no year reads as this year, in words, in the version and in the plan alike", async () => {
  const { carry } = await import("./compute.js");
  const p = await fresh25();
  for (const bad of ["abc", "", null, 0, -3, "NaN"]) {
    assert.deepEqual(describe(p, { lumpSum: 100, lumpYear: bad }), ["$100 arrives this year"], String(bad));
    const I = applyChanges(p, { lumpSum: 100, lumpYear: bad }, { today: T25 }).inputs;
    assert.equal(I.events.find((e) => e.label === "one-time").year, I.startYear);
    const q = structuredClone(p);
    const c = carry(q, { lumpSum: 100, lumpYear: bad }, { today: T25 });
    assert.deepEqual(c.carried, ["$100 arrives this year"]);
    c.write(q);
    assert.equal(q.retirement.happenings.at(-1).year, 2026);
  }
  assert.deepEqual(describe(p, { lumpSum: -100, lumpYear: "2031" }), ["$100 is spent in 2031"]);
});

test("#25 M2: what is not carried is not in the plan's new answer, and the green line says so", async () => {
  const { makeMyPlan, madeWords, NOT_CARRIED } = await import("./compute.js");
  const a = { lasts: true, endAge: 95 };
  assert.equal(madeWords("Save more", 1, a, 1), 'Your plan now has the 1 change from "Save more". At average markets the money now lasts to the end (age 95). That is without what was not carried.');
  assert.equal(madeWords("Save more", 1, a, 0), madeWords("Save more", 1, a));
  assert.equal(madeWords("Save more", 2, { lasts: false, age: 88 }, 2), 'Your plan now has the 2 changes from "Save more". At average markets the money now runs out at 88. That is without what was not carried.');
  // saving more is a what-if only: the version holds more at retirement than the plan does once it is made the plan
  const p = await fresh25();
  p.scenarios = [{ id: "v", name: "V", changes: { "retireAge:p-ana": 63, extraSavingMonthly: 500 } }];
  const ver = compute(p, { today: T25, paths: 0 }).scenarios[0].results;
  const r = makeMyPlan(p, "v", { today: T25 });
  assert.deepEqual(r.not, [NOT_CARRIED.saving]); assert.deepEqual(r.carried, ["Ana retires at 63"]);
  assert.ok(!(p.retirement.contributions ?? []).some((c) => c.id === "scenario-extra"), "no contribution row is written");
  assert.ok(compute(p, { today: T25, paths: 0 }).base.atRetirementReal < ver.atRetirementReal - 1000);
});

test("#25 P2: one plain sentence for every choice of the two lists; P6: the first screen says when the plan changes", async () => {
  const { choiceHelp, offers, STRATEGY_CHOICES, EASE_CHOICES, SAME_AS_PLAN } = await import("./compute.js");
  const p = await fresh25();
  const o = offers(p, { today: T25 });
  assert.equal(SAME_AS_PLAN, "Same as my plan");
  assert.deepEqual(STRATEGY_CHOICES.map((c) => choiceHelp("strategy", c.value, o)), [
    "The same each year, raised with prices, whatever markets do.",
    "A set share of savings each year on top of your income, so it moves with markets.",
    "What you plan, trimmed by a tenth after bad years and raised back after good ones.",
    "What savings can pay over the years left, on top of your income."]);
  assert.equal(choiceHelp("strategy", "", o), "Your plan: same spending every year. Pick another to see what it does.");
  assert.equal(choiceHelp("strategy", "constructor", o), choiceHelp("strategy", "", o));
  assert.equal(choiceHelp("strategy", "", { ...o, strategy: "vpw" }), "Your plan: spend what the years left can afford. Pick another to see what it does.");
  assert.deepEqual(EASE_CHOICES.map((c) => choiceHelp("spendingEase", c.value, o)), [
    "You spend the same every year of retirement, raised with prices.",
    "Each year you spend 1% less than the year before, in today's dollars. Health insurance is not eased.",
    "Each year you spend 2% less than the year before, in today's dollars. Health insurance is not eased."]);
  assert.equal(choiceHelp("spendingEase", "", o), "Your plan: stays the same. Many people spend a little less each year as they get older.");
  assert.equal(choiceHelp("spendingEase", "", { ...o, ease: 0.015 }), "Your plan: 1.5% less each year. Many people spend a little less each year as they get older.");
  // the plan's own numbers for "Trim after bad years" are the ones the sentence names
  p.retirement.guard = { cut: 0.05 };
  const own = offers(p, { today: T25 });
  if (own.guard) assert.match(choiceHelp("strategy", "guardrails", own), /^What you plan, trimmed by /);
  const fresh = await fresh25(); fresh.scenarios = [];
  const s = await page25(fresh);
  assert.match(s.textOf(s.root), /Your plan only changes if you tap Make this my plan on one of them\./);
  assert.ok(!/never changes/.test(s.textOf(s.root)));
});
