// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs); here the
// money put in or taken out each year (gap list, next 60, item 52) by hand on a made-up history, its sentences, the
// drawn row, and invariance over every household.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, withFlows, flowChoices, median, HISTORY, FLOW_YEARS, FLOW_YEARS_FIRST } from "./compute.js";
import { flowSentence, otherSentence, flowCaveat, flowPrompt, flowSays, flowAsk, flowShown, flowPicked, bothInSight, resetFlow, FLOW_TITLE } from "./view.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";

const T = "2026-11-15";
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const STOCKS = { stocks: 1, bonds: 0, bills: 0 };
// a made-up history: three years, all stocks, prices up 10% in the second year
const TINY = [
  { year: 2001, stocks: 0.10, bonds: 0, bills: 0, inflation: 0 },
  { year: 2002, stocks: -0.20, bonds: 0, bills: 0, inflation: 0.10 },
  { year: 2003, stocks: 0.30, bonds: 0, bills: 0, inflation: 0 },
];

test("backtest: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("median: the middle one, or the mean of the two middle ones", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test("money put in at the start of each year, raised with prices: by hand on the made-up history", () => {
  const f = withFlows(STOCKS, { from: 2001, start: 100, yearly: 10, dir: "in", years: 2, history: TINY });
  assert.equal(f.n, 2); assert.deepEqual(f.starts.map((x) => x.start), [2001, 2002]); assert.equal(f.history, 3);
  // 2001 start: (100 + 10) x 1.10 = 121; (121 + 10) x (0.80 / 1.10) = 95.2727...
  near(f.starts[0].end, 131 * 0.8 / 1.1);
  // the same in each year's dollars: 131 x 0.80 = 104.80, worth 104.80 / 1.10 in 2001's dollars
  near(f.starts[0].end, 104.8 / 1.1);
  // 2002 start: (100 + 10) x (0.80 / 1.10) = 80; (80 + 10) x 1.30 = 117. In each year's dollars: 110 x 0.80 = 88, then
  // the amount raised by 2002's 10% to 11: (88 + 11) x 1.30 = 128.70, over 1.10 = 117
  near(f.starts[1].end, 117); near(f.starts[1].end, 128.7 / 1.1);
  assert.equal(f.worst.start, 2001); assert.equal(f.best.start, 2002);
  near(f.middle, (131 * 0.8 / 1.1 + 117) / 2);
  assert.equal(f.ranOut, 0); assert.equal(f.minLasted, null);
  assert.ok(f.starts.every((x) => x.ranOut === null && x.lasted === 2));
});

test("money taken out: lasting, running out part way, and paid down to nothing exactly", () => {
  // 30 a year from 100 over the three years: (100 - 30) x 1.10 = 77; (77 - 30) x 0.80 / 1.10 = 34.18...; (34.18 - 30) x 1.30
  const a = withFlows(STOCKS, { from: 2001, start: 100, yearly: 30, dir: "out", years: 3, history: TINY });
  assert.equal(a.n, 1); assert.equal(a.ranOut, 0);
  near(a.starts[0].end, ((77 - 30) * 0.8 / 1.1 - 30) * 1.3); assert.equal(a.starts[0].lasted, 3);
  // 40 a year: (100 - 40) x 1.10 = 66; (66 - 40) x 0.80 / 1.10 = 18.91, less than 40 in 2003: it ran out in 2003 after two years
  const b = withFlows(STOCKS, { from: 2001, start: 100, yearly: 40, dir: "out", years: 3, history: TINY });
  assert.deepEqual(b.starts[0], { start: 2001, end: 0, ranOut: 2003, lasted: 2 });
  assert.equal(b.ranOut, 1); assert.equal(b.minLasted, 2); assert.equal(b.maxLasted, 2); assert.equal(b.worst.start, 2001);
  // exactly paid down: 30 from 30 in a flat year leaves 0, and the next year cannot be paid
  const flat = [{ year: 2001, stocks: 0, bonds: 0, bills: 0, inflation: 0 }, { year: 2002, stocks: 0, bonds: 0, bills: 0, inflation: 0 }];
  assert.deepEqual(withFlows(STOCKS, { from: 2001, start: 30, yearly: 30, dir: "out", years: 2, history: flat }).starts[0], { start: 2001, end: 0, ranOut: 2002, lasted: 1 });
  // the worst start is the one that ran out soonest, before a lower end of one that lasted
  const two = withFlows(STOCKS, { from: 2001, start: 100, yearly: 45, dir: "out", years: 2, history: TINY });
  // 2001: 55 x 1.1 = 60.5; 15.5 x 0.727 = 11.27 (lasted); 2002: 55 x 0.727 = 40 < 45: ran out in 2003 after one year
  assert.equal(two.starts[0].ranOut, null); assert.deepEqual(two.starts[1], { start: 2002, end: 0, ranOut: 2003, lasted: 1 });
  assert.equal(two.worst.start, 2002); assert.equal(two.best.start, 2001);
  // critic M2: the last year's amount paid out exactly lasts, with nothing left (the sentence says so, below)
  const exact = withFlows({ stocks: 0, bonds: 0, bills: 1 }, { dir: "out", yearly: 100, start: 100, years: 1, from: 2001, history: flat });
  assert.deepEqual(exact.starts[0], { start: 2001, end: 0, ranOut: null, lasted: 1 }); assert.equal(exact.ranOut, 0);
});

test("critic M3: a way other than in or out is no run; an amount that is not a finite number counts as nothing", () => {
  const mix = { stocks: 0.6, bonds: 0.4, bills: 0 };
  assert.equal(withFlows(mix, { dir: "sideways", yearly: 1 }), null);
  assert.equal(withFlows(mix, { dir: undefined, yearly: 1 }).dir, "in", "no way given: the default, money in");
  const inf = withFlows(mix, { dir: "in", yearly: Infinity, start: 1e308 * 10 });
  assert.equal(inf.yearly, 0); assert.equal(inf.start, 0); assert.ok(inf.starts.every((x) => x.end === 0));
  assert.ok(Number.isFinite(withFlows(mix, { dir: "in", yearly: 1e9, start: 1e9 }).best.end), "the box's own ceiling (a billion) stays finite");
  const plan = migrate(emptyPlan());
  const plain = compute(plan, { today: T });
  for (const dir of ["sideways", null, "", 1]) assert.deepEqual(Object.keys(compute(plan, { today: T, flow: { dir, yearly: 1, start: 0, years: 30 } })), Object.keys(plain), String(dir));
});

test("a stretch longer than the history: no start fits; the mix and its rebalancing are the page's own", () => {
  const f = withFlows(STOCKS, { from: 2001, start: 100, yearly: 10, dir: "in", years: 4, history: TINY });
  assert.equal(f.n, 0); assert.equal(f.history, 3); assert.equal(f.worst, null); assert.equal(f.middle, null);
  // a 60/40 year is 0.6 of the stocks' return and 0.4 of the bonds', as runMix does
  const mixed = withFlows({ stocks: 0.6, bonds: 0.4, bills: 0 }, { from: 2001, start: 100, yearly: 0, dir: "in", years: 1, history: [{ year: 2001, stocks: 0.1, bonds: 0.05, bills: 0.01, inflation: 0.02 }] });
  near(mixed.starts[0].end, 100 * (1.08 / 1.02));
  // on the real history: every 30-year stretch since 1928 is 2025 - 1928 - 30 + 2 = 69 starts
  const real = withFlows(STOCKS, { from: 1928, start: 1000, yearly: 0, dir: "in", years: 30 });
  assert.equal(real.n, 69); assert.equal(real.starts[0].start, 1928); assert.equal(real.starts.at(-1).start, 1996);
  assert.deepEqual(FLOW_YEARS, [10, 20, 30]); assert.equal(FLOW_YEARS_FIRST, 30); assert.equal(HISTORY.at(-1).year, 2025);
});

test("the plan's own figures for the chips: the family saves $18,870 a year, plans to spend $84,000, has $177,000 invested", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  // the family's spending is before the health insurance Will the money last? adds on top (critic M1), so the row says so
  assert.deepEqual(flowChoices(familyPlan(T), { today: T }), { saving: 18870, spending: 84000, healthOnTop: true, invested: 177000 });
  assert.deepEqual(flowChoices(migrate(emptyPlan()), { today: T }), { saving: null, spending: null, healthOnTop: false, invested: null });
  // the investments fixture: $78,000 a year, health about $313,841 over retirement on top of it
  assert.equal(flowChoices(investmentsPlan(), { today: T }).healthOnTop, true);
  // "my spending figure already includes health insurance": nothing on top, nothing to say
  const covered = migrate(familyPlan(T)); covered.retirement.healthIncluded = true;
  assert.deepEqual(flowChoices(covered, { today: T }), { saving: 18870, spending: 84000, healthOnTop: false, invested: 177000 });
  const c = { saving: 18870, spending: 84000, invested: 177000 };
  assert.equal(flowAsk({ dir: null, amount: null, start: null, years: 30 }, c), null);
  assert.deepEqual(flowAsk({ dir: "in", amount: "plan", start: null, years: 30 }, c), { dir: "in", yearly: 18870, start: 177000, years: 30 });
  assert.deepEqual(flowAsk({ dir: "out", amount: "plan", start: 0, years: 20 }, c), { dir: "out", yearly: 84000, start: 0, years: 20 });
  assert.deepEqual(flowAsk({ dir: "out", amount: 40000, start: 1000000, years: 10 }, c), { dir: "out", yearly: 40000, start: 1000000, years: 10 });
  assert.equal(flowAsk({ dir: "in", amount: "plan", start: null, years: 30 }, { saving: null, spending: null, invested: null }), null);
  // critic P1: the choices carry figures, never the words "plan" or "invested", so "Type my own" opens on a figure
  assert.deepEqual(flowShown({ dir: "out", amount: "plan", start: null }, c), { amount: 84000, start: 177000 });
  assert.deepEqual(flowShown({ dir: "in", amount: "plan", start: "invested" }, c), { amount: 18870, start: 177000 });
  assert.deepEqual(flowShown({ dir: "in", amount: 40000, start: 0 }, c), { amount: 40000, start: 0 });
  assert.deepEqual(flowShown({ dir: "out", amount: null, start: null }, { saving: null, spending: null, invested: null }), { amount: null, start: 0 });
  // and back: the plan's own figure is kept as "plan" / "invested", anything else as typed
  assert.equal(flowPicked.amount(84000, { dir: "out" }, c), "plan"); assert.equal(flowPicked.amount(18870, { dir: "out" }, c), 18870);
  assert.equal(flowPicked.amount(18870, { dir: "in" }, c), "plan");
  assert.equal(flowPicked.start(177000, c), "invested"); assert.equal(flowPicked.start(0, c), 0); assert.equal(flowPicked.start(5, { invested: null }), 5);
});

test("one written sentence for each case (R5)", () => {
  const L = "Your plan's mix";
  const base = { yearly: 40000, start: 1000000, years: 30, from: 1928, history: 98, n: 69, minLasted: null, maxLasted: null };
  assert.equal(flowSentence({ ...base, dir: "out", n: 0, from: 2010, history: 16 }, { money, label: L }),
    "From 2010 there are 16 years of history, fewer than 30: pick a shorter stretch, or an earlier start above.");
  assert.equal(flowSentence({ ...base, dir: "out", start: 0 }, { money, label: L }), "There is nothing at the start to take money out of: pick how much there is at the start.");
  assert.equal(flowSentence({ ...base, dir: "out", start: 30000 }, { money, label: L }),
    "$30,000 at the start is less than one year's $40,000, so the money runs out in the first year: pick a larger start or a smaller amount.");
  assert.equal(flowSentence({ ...base, dir: "out", yearly: 84000, start: 177000, ranOut: 69, minLasted: 1, maxLasted: 2 }, { money, label: L }),
    "Taking out $84,000 a year from $177,000, your plan's mix ran out in all 69 stretches of 30 years since 1928: it lasted 1 to 2 years.");
  assert.equal(flowSentence({ ...base, dir: "out", yearly: 84000, start: 177000, ranOut: 69, minLasted: 2, maxLasted: 2 }, { money, label: L }),
    "Taking out $84,000 a year from $177,000, your plan's mix ran out in all 69 stretches of 30 years since 1928: it lasted 2 years each time.");
  assert.equal(flowSentence({ ...base, dir: "out", ranOut: 4, worst: { start: 1966, ranOut: 1992, end: 0 } }, { money, label: L }),
    "Taking out $40,000 a year from $1,000,000, your plan's mix ran out in 4 of the 69 stretches of 30 years since 1928. The worst start was 1966: the money ran out in 1992.");
  assert.equal(flowSentence({ ...base, dir: "out", yearly: 30000, ranOut: 0, worst: { start: 1965, end: 697195 }, middle: 2688711 }, { money, label: L }),
    "Taking out $30,000 a year from $1,000,000, your plan's mix lasted the full 30 years in all 69 stretches since 1928. The worst start, 1965, ended with $697,195 in today's dollars; the middle one with $2,688,711.");
  assert.equal(flowSentence({ ...base, dir: "in", yearly: 18870, start: 177000, ranOut: 0, worst: { start: 1952, end: 1233779 }, best: { start: 1970, end: 4187105 }, middle: 2796845 }, { money, label: L }),
    "Putting in $18,870 a year on top of $177,000, after 30 years your plan's mix ended with between $1,233,779 (the 1952 start) and $4,187,105 (the 1970 start) in today's dollars; the middle start with $2,796,845.");
  assert.match(flowSentence({ ...base, dir: "in", yearly: 6000, start: 0, ranOut: 0, worst: { start: 1952, end: 1 }, best: { start: 1970, end: 2 }, middle: 1 }, { money, label: "What you hold" }), /^Putting in \$6,000 a year from nothing, after 30 years what you hold ended with between/);
  // critic M2: the last amount paid out exactly: it lasted, with nothing left (never "ended with $0")
  assert.equal(flowSentence({ ...base, dir: "out", yearly: 100, start: 100, years: 10, n: 1, ranOut: 0, worst: { start: 2001, end: 0 }, middle: 0 }, { money, label: L }),
    "Taking out $100 a year from $100, your plan's mix lasted the full 10 years in the one stretch since 1928. The worst start, 2001, ended with nothing left; the middle one with nothing left.");
  assert.equal(otherSentence({ ...base, dir: "out", ranOut: 0, worst: { end: 0.2 } }, { money, label: "60 / 40" }), "60 / 40 lasted in all 69; its worst start ended with nothing left.");
  // critic P3 and M1: what the answer leaves out, said with it when money comes out; the health insurance only for the plan's figure
  const out69 = { ...base, dir: "out", yearly: 84000, start: 177000, ranOut: 69 };
  assert.equal(flowCaveat(out69, { planSpending: true, healthOnTop: true }),
    "This leaves out Social Security, pensions, pay and the health insurance your plan adds on top: all of it comes from this money and rises with prices.");
  assert.equal(flowCaveat(out69, { planSpending: false, healthOnTop: true }), "This leaves out Social Security, pensions and pay: all of it comes from this money and rises with prices.");
  assert.equal(flowCaveat(out69, { planSpending: true, healthOnTop: false }), flowCaveat(out69));
  for (const f of [{ ...out69, dir: "in" }, { ...out69, n: 0 }, { ...out69, start: 0 }, { ...out69, start: 1000 }, null]) assert.equal(flowCaveat(f, { planSpending: true, healthOnTop: true }), null);
  // the second mix in one sentence; none where the first mix's sentence says there is nothing to run
  assert.equal(otherSentence({ ...base, dir: "out", ranOut: 69 }, { money, label: "60 / 40" }), "60 / 40 ran out in all 69.");
  assert.equal(otherSentence({ ...base, dir: "out", ranOut: 8 }, { money, label: "60 / 40" }), "60 / 40 ran out in 8 of the 69.");
  assert.equal(otherSentence({ ...base, dir: "out", ranOut: 0, worst: { end: 410000 } }, { money, label: "all bonds" }), "All bonds lasted in all 69; its worst start ended with $410,000.");
  assert.equal(otherSentence({ ...base, dir: "in", worst: { end: 10 }, best: { end: 30 }, middle: 20 }, { money, label: "60 / 40" }), "60 / 40 ended with between $10 and $30; the middle start with $20.");
  assert.equal(otherSentence({ ...base, dir: "out", start: 0 }, { money, label: "60 / 40" }), null);
  assert.equal(otherSentence({ ...base, dir: "out", n: 0 }, { money, label: "60 / 40" }), null);
  // what is still to pick, and the row's status
  assert.equal(flowPrompt({ dir: null }), "Pick whether money goes in or comes out each year.");
  assert.equal(flowPrompt({ dir: "out" }), "Pick or type how much each year.");
  assert.equal(flowSays(null, money), "");
  assert.equal(flowSays({ dir: "out", yearly: 84000 }, money), "$84,000 out a year");
  assert.equal(flowSays({ dir: "in", yearly: 1250000 }, money), "$1,250,000 in a year", "20 characters fit");
  assert.equal(flowSays({ dir: "in", yearly: 12500000 }, money), "money in a year");
  assert.equal(FLOW_TITLE, "Add or take out money each year");
});

// ---------------------------------------------------------------- invariance: nothing asked, nothing moves
const KEYS_81A5288 = ["a", "b", "mixA", "mixB", "own", "held", "ownSource", "defaultA", "from", "real", "firstYear", "lastYear", "presets", "startYears", "notes"];
async function everyPlan() {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  return [investmentsPlan(), familyPlan(T), renterDebtPlan(), retiredCouplePlan(T), emptyPlan(), ...ARCHETYPES.map((a) => a.build())].map((p) => migrate(structuredClone(p)));
}
test("invariance: without a flow the output has 81a5288's keys only; with one, one key more and every other byte the same", async () => {
  for (const p of await everyPlan()) {
    for (const params of [{}, { from: 1871, real: true, mixA: "100-0", mixB: "0-100" }]) {
      const a = compute(p, { today: T, ...params });
      assert.deepEqual(Object.keys(a), KEYS_81A5288);
      const before = JSON.stringify(p);
      const b = compute(p, { today: T, ...params, flow: { dir: "out", yearly: 40000, start: 1000000, years: 30 } });
      flowChoices(p, { today: T });
      assert.equal(JSON.stringify(p), before, "nothing in the plan is touched");
      assert.deepEqual(Object.keys(b), [...KEYS_81A5288, "flow"]);
      const { flow, ...rest } = b;
      assert.equal(JSON.stringify(rest), JSON.stringify(a));
      assert.equal(flow.a.from, a.from); assert.equal(flow.a.n, a.a.years - 30 + 1);
    }
  }
});

// ---------------------------------------------------------------- the page (stand-in DOM)
async function page(plan, today = T) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const revealed = [];
  const ui = { ...(await import("../../../core/ui/dom.js")), reveal: (el, o) => { revealed.push([el, o]); return true; } };
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 140 });
  const P = { plan: migrate(structuredClone(plan)), saved: [], root: null };
  P.route = { group: "investments", id: "backtest", rest: [], query: {} };
  P.draw = () => { P.root = new FakeElement("main"); render(P.root, { ui, fmt: { ...fmt, today: () => today }, plan: P.plan, route: P.route, module: { group: "investments", id: "backtest" },
    store: { get: () => P.plan, update: (fn) => { const d = structuredClone(P.plan); fn(d); P.saved.push(d); P.plan = d; P.draw(); } }, redraw: P.draw }); return P; };
  P.part = (id) => P.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  P.states = () => P.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open"), textOf(e.querySelector(".fold-title")), e.querySelector(".fold-status")?.textContent ?? ""]);
  P.textOf = textOf;
  P.tap = (label, within = P.part("flow")) => { const b = within.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label); assert.ok(b, `a button "${label}"`); b.click(); return P; };
  P.chips = (id) => P.root.all().find((e) => e.dataset?.choice === id)?.all().filter((e) => e.tagName === "BUTTON").map((e) => [textOf(e), e.getAttribute("aria-pressed")]);
  P.answer = () => textOf(P.root.all().find((e) => e.dataset?.flowAnswer !== undefined));
  P.revealed = revealed;
  return P.draw();
}

test("the page: two quiet rows, shut; the side by side figures moved into \"9 more numbers\"", async () => {
  resetFlow();
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const P = await page(familyPlan(T));
  assert.deepEqual(P.states(), [["numbers", false, "9 more numbers", ""], ["flow", false, FLOW_TITLE, ""]]);
  assert.match(P.textOf(P.part("numbers")), /Ended at \$[\d,]+ 60 \/ 40: \$[\d,]+ Average growth a year/);
  assert.ok(!P.root.all().some((e) => e.tagName === "H2" && P.textOf(e) === "Side by side"), "no card of its own any more");
  // the mix chips, the chart and the growth line stay on the first view
  assert.ok(P.root.all().some((e) => e.tagName === "H2" && P.textOf(e) === "Which mixes"));
  assert.match(P.textOf(P.root), /Solid: your plan's mix\. Dashed: 60 \/ 40\./);
});

test("S11: Add or take out money each year: one tap to an answer, typed figures, the stretch, Clear; nothing is saved, and only this row changes", async () => {
  resetFlow();
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const P = await page(familyPlan(T));
  assert.equal(P.answer(), "Pick whether money goes in or comes out each year.");
  assert.ok(!P.chips("flowAmount"), "how much is asked once the way is picked");
  // one tap: the plan's own saving, on top of what is invested, over every 30-year stretch since 1928
  P.tap("Put money in");
  assert.deepEqual(P.states(), [["numbers", false, "9 more numbers", ""], ["flow", true, FLOW_TITLE, "$18,870 in a year"]], "the row stays open and says what is in it; the other row is as it was");
  assert.deepEqual(P.chips("flowAmount"), [["Your yearly saving: $18,870", "true"], ["Type my own", "false"]]);
  assert.deepEqual(P.chips("flowStart"), [["What you have invested: $177,000", "true"], ["Nothing", "false"], ["Type my own", "false"]]);
  const inFamily = compute(P.plan, { today: T, flow: { dir: "in", yearly: 18870, start: 177000, years: 30 } }).flow;
  assert.equal(P.answer().split(". ")[0] + ".", flowSentence(inFamily.a, { money, label: "Your plan's mix" }).replace(/\.$/, "") + ".");
  assert.match(P.answer(), /^Putting in \$18,870 a year on top of \$177,000, after 30 years your plan's mix ended with between \$[\d,]+ \(the \d{4} start\) and \$[\d,]+ \(the \d{4} start\) in today's dollars; the middle start with \$[\d,]+\. 60 \/ 40 ended with between/);
  // the other way: the plan's spending in retirement, from what is invested: it runs out within two years every time
  P.tap("Take money out");
  assert.deepEqual(P.chips("flowAmount"), [["Your retirement spending: $84,000", "true"], ["Type my own", "false"]]);
  // critic P3 and M1: what is left out is the answer's second line, health insurance included for the plan's own spending
  assert.match(P.answer(), /^Taking out \$84,000 a year from \$177,000, your plan's mix ran out in all 69 stretches of 30 years since 1928: it lasted 1 to 2 years\. This leaves out Social Security, pensions, pay and the health insurance your plan adds on top: all of it comes from this money and rises with prices\. 60 \/ 40 ran out in all 69\.$/);
  // critic P7: the way to the whole plan is a link a thumb can hit, right under the answer
  const link = P.part("flow").all().find((e) => e.tagName === "A" && P.textOf(e) === "If history repeated runs your whole plan ›");
  assert.ok(link && link.getAttribute("href") === "#/retirement/historical" && link.style.minHeight === "44px");
  // critic P2: the answer sits right under the chips of the way it answers, before how much, the start and how long
  const body = P.part("flow").querySelector(".fold-body").children;
  const at = (fn) => body.findIndex(fn);
  const holds = (e, fn) => fn(e) || (e.all?.() ?? []).some(fn);
  const ways = at((e) => holds(e, (x) => x.getAttribute?.("aria-label") === "Each year")), ans = at((e) => e.dataset?.flowAnswer !== undefined), much = at((e) => holds(e, (x) => x.dataset?.choice === "flowAmount"));
  assert.ok(ways >= 0 && ans === ways + 1 && much > ans, `${ways} ${ans} ${much}`);
  // critic P4: the row says a reload starts it over
  assert.match(P.textOf(P.part("flow")), /Nothing is saved: a reload starts it over\./);
  // a typed amount and a typed start: $40,000 a year from $1,000,000; critic P1: each box opens on the figure the chip shows
  P.tap("Type my own", P.root.all().find((e) => e.dataset?.choice === "flowAmount"));
  let box = P.part("flow").all().find((e) => e.tagName === "INPUT" && e.getAttribute("name") === "flowAmount");
  assert.equal(box.value, "84,000");
  box.value = "40000"; box.dispatch("input"); box.dispatch("change");
  P.tap("Type my own", P.root.all().find((e) => e.dataset?.choice === "flowStart"));
  box = P.part("flow").all().find((e) => e.tagName === "INPUT" && e.getAttribute("name") === "flowStart");
  assert.equal(box.value, "177,000");
  box.value = "1000000"; box.dispatch("input"); box.dispatch("change");
  assert.deepEqual(P.chips("flowAmount"), [["Your retirement spending: $84,000", "false"], ["Yours: $40,000", "true"], ["Type my own", "false"]]);
  const typed = compute(P.plan, { today: T, flow: { dir: "out", yearly: 40000, start: 1000000, years: 30 } }).flow;
  assert.equal(P.answer().split(/(?<=\.) (?=This leaves out)/)[0], flowSentence(typed.a, { money, label: "Your plan's mix" }));
  assert.match(P.answer(), /ran out in \d+ of the 69 stretches of 30 years since 1928\. The worst start was \d{4}: the money ran out in \d{4}\. This leaves out Social Security, pensions and pay: all of it/, "a typed amount: no word on the plan's health insurance");
  // the plan's own figure again from its chip: kept as "plan", so the health insurance is named again
  P.tap("Your retirement spending: $84,000", P.root.all().find((e) => e.dataset?.choice === "flowAmount"));
  assert.match(P.answer(), /^Taking out \$84,000 a year from \$1,000,000, .* pay and the health insurance your plan adds on top/);
  box = (P.tap("Type my own", P.root.all().find((e) => e.dataset?.choice === "flowAmount")), P.part("flow").all().find((e) => e.tagName === "INPUT" && e.getAttribute("name") === "flowAmount"));
  box.value = "40000"; box.dispatch("input"); box.dispatch("change");
  // a chip above the row (the first mix) draws the page again: the row stays open, its answer for the new mix
  P.tap("All stocks", P.root.all().find((e) => e.tagName === "SECTION" && e.querySelector("h2") && P.textOf(e.querySelector("h2")) === "Which mixes"));
  assert.deepEqual(P.states()[1].slice(0, 2), ["flow", true]);
  assert.match(P.answer(), /^Taking out \$40,000 a year from \$1,000,000, all stocks /);
  P.tap("Your plan's mix", P.root.all().find((e) => e.tagName === "SECTION" && e.querySelector("h2") && P.textOf(e.querySelector("h2")) === "Which mixes"));
  // a typed amount stays when the way changes; a shorter stretch has more starts
  P.tap("Put money in");
  assert.deepEqual(P.states()[1].slice(1, 4), [true, FLOW_TITLE, "$40,000 in a year"]);
  P.tap("10 years");
  assert.match(P.answer(), /^Putting in \$40,000 a year on top of \$1,000,000, after 10 years/);
  // nothing was ever written to the plan
  assert.equal(P.saved.length, 0);
  // Clear: back to the first question, said in green, the row still open
  P.tap("Clear");
  assert.equal(P.answer(), "Pick whether money goes in or comes out each year.");
  assert.match(P.textOf(P.part("flow")), /^Add or take out money each year › Cleared\. Nothing was saved\. Money going in/, "the green line first in the row");
  assert.deepEqual(P.states()[1], ["flow", true, FLOW_TITLE, ""]);
  assert.equal(P.saved.length, 0);
});

test("the start from 2010 is too short for 30 years; another plan starts the row over", async () => {
  resetFlow();
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const P = await page(familyPlan(T));
  P.tap("2010", P.root);
  P.tap("Take money out");
  assert.equal(P.answer(), "From 2010 there are 16 years of history, fewer than 30: pick a shorter stretch, or an earlier start above.");
  P.tap("10 years");
  assert.match(P.answer(), /^Taking out \$84,000 a year from \$177,000, your plan's mix ran out in all 7 stretches of 10 years since 2010/);
  P.tap("1928", P.root);
  // the empty plan: no figures of its own, so the amount is typed; nothing at the start to take out of
  const E = await page(emptyPlan());
  assert.deepEqual(E.states()[1], ["flow", false, FLOW_TITLE, ""], "a new plan: nothing carried over");
  E.tap("Take money out");
  assert.deepEqual(E.chips("flowAmount"), [["Type my own", "false"]]);
  assert.deepEqual(E.chips("flowStart"), [["Nothing", "true"], ["Type my own", "false"]]);
  assert.equal(E.answer(), "Pick or type how much each year.");
  E.tap("Type my own", E.root.all().find((e) => e.dataset?.choice === "flowAmount"));
  const box = E.part("flow").all().find((e) => e.tagName === "INPUT" && e.getAttribute("name") === "flowAmount");
  box.value = "30000"; box.dispatch("input"); box.dispatch("change");
  assert.equal(E.answer(), "There is nothing at the start to take money out of: pick how much there is at the start.");
  resetFlow();
});

test("critic P2: a pick inside the row brings its answer into sight; a chip above the row and the first draw do not", async () => {
  // only when the answer and the chips just tapped fit on one screen with the top bar (80 px): the thumb's chips stay
  assert.equal(bothInSight({ top: 868, bottom: 1045 }, { top: 790, bottom: 846 }, 844), true, "a way tapped at the foot of a 390 phone");
  assert.equal(bothInSight({ top: -238, bottom: -38 }, { top: 434, bottom: 478 }, 844), true, "20 years tapped below the answer: 716 px fit");
  assert.equal(bothInSight({ top: -421, bottom: -176 }, { top: 296, bottom: 340 }, 568), false, "a 320 phone: the chips would leave the screen");
  assert.equal(bothInSight(null, { top: 0, bottom: 1 }, 844), false); assert.equal(bothInSight({ top: 0, bottom: 1 }, { top: 0, bottom: 1 }, undefined), false);
  const was = globalThis.innerHeight;
  globalThis.innerHeight = 844;
  resetFlow();
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const P = await page(familyPlan(T));
  await tick();
  assert.equal(P.revealed.length, 0, "drawing the page scrolls nothing");
  P.tap("Take money out");
  await tick();
  assert.equal(P.revealed.length, 1);
  assert.equal(P.revealed[0][0].dataset.flowAnswer, ""); assert.deepEqual(P.revealed[0][1], { block: "nearest" });
  assert.match(P.textOf(P.revealed[0][0]), /^Taking out \$84,000 a year/, "the answer drawn for the pick");
  P.tap("20 years");
  await tick();
  assert.equal(P.revealed.length, 2);
  P.tap("All stocks", P.root.all().find((e) => e.tagName === "SECTION" && e.querySelector("h2") && P.textOf(e.querySelector("h2")) === "Which mixes"));
  await tick();
  assert.equal(P.revealed.length, 2, "a mix chip above keeps the page where it is");
  P.tap("Clear");
  await tick();
  assert.equal(P.revealed.length, 2, "Clear says so in green at the row's top; nothing to bring into sight");
  P.tap("Your plan's mix", P.root.all().find((e) => e.tagName === "SECTION" && e.querySelector("h2") && P.textOf(e.querySelector("h2")) === "Which mixes"));
  globalThis.innerHeight = was;
  resetFlow();
});
