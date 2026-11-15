// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs); here the
// longer stretches, the Sharpe ratio and the correlations (gap list, next 60, item 52) by hand on a made-up history,
// their sentences, the drawn rows, and invariance over every household.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, rolling, sharpe, correlation, together, togetherWords, STRETCHES, STRETCH_FIRST, BILLS_FROM, RECENT_FROM } from "./compute.js";
import { stretchSentence, stretchRealSentence, sharpeSentence, pairRow, stripWords, longerLead, resetStretch, LONGER_TITLE } from "./view.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";

const T = "2026-11-15";
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const STOCKS = { stocks: 1, bonds: 0, bills: 0 };
// a made-up history: four years; prices up 10% in the second
const TINY = [
  { year: 2001, stocks: 0.10, bonds: 0.02, bills: 0.01, inflation: 0 },
  { year: 2002, stocks: -0.20, bonds: 0.06, bills: 0.02, inflation: 0.10 },
  { year: 2003, stocks: 0.30, bonds: -0.01, bills: 0.02, inflation: 0 },
  { year: 2004, stocks: 0.05, bonds: 0.03, bills: 0.01, inflation: 0 },
];

test("risk: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("rolling stretches by hand: one, two and three years on the made-up history", () => {
  const one = rolling(STOCKS, { years: 1, from: 2001, history: TINY });
  assert.equal(one.n, 4); near(one.worst.rate, -0.20); near(one.best.rate, 0.30);
  assert.deepEqual([one.worst.from, one.worst.to, one.best.from, one.best.to], [2002, 2002, 2003, 2003]);
  near(one.middle, (0.05 + 0.10) / 2);                 // four stretches: the mean of the two middle ones
  assert.equal(one.lost, 1); assert.equal(one.lostShare, 0.25);
  assert.equal(one.lostReal, 1);                         // 2002 after its 10% inflation: 0.8 / 1.1 - 1 = -27.3%
  const two = rolling(STOCKS, { years: 2, from: 2001, history: TINY });
  assert.equal(two.n, 3);
  near(two.worst.rate, Math.sqrt(1.1 * 0.8) - 1); assert.equal(two.worst.from, 2001); assert.equal(two.worst.to, 2002);
  near(two.best.rate, Math.sqrt(1.3 * 1.05) - 1); assert.equal(two.best.from, 2003);
  near(two.middle, Math.sqrt(0.8 * 1.3) - 1);            // three stretches: the middle one, 2002-2003, +2.0% a year
  assert.equal(two.lost, 1);
  // after inflation 2001-2002 (sqrt(1.1 x 0.8 / 1.1) - 1 = -10.6%) and 2002-2003 (sqrt(0.8 / 1.1 x 1.3) - 1 = -2.8%) both lost
  assert.equal(two.lostReal, 2); near(two.lostRealShare, 2 / 3);
  const three = rolling(STOCKS, { years: 3, from: 2001, history: TINY });
  assert.equal(three.n, 2); near(three.middle, (Math.cbrt(1.1 * 0.8 * 1.3) - 1 + Math.cbrt(0.8 * 1.3 * 1.05) - 1) / 2);
  assert.equal(three.lost, 0);
  // a mix: 60/40 rebalanced each year, 0.6 of the stocks' year and 0.4 of the bonds'
  near(rolling({ stocks: 0.6, bonds: 0.4, bills: 0 }, { years: 1, from: 2001, history: TINY }).worst.rate, 0.6 * -0.20 + 0.4 * 0.06);
  // longer than the history: nothing to show
  assert.equal(rolling(STOCKS, { years: 5, from: 2001, history: TINY }).n, 0);
  // on the bundled history: 155 single years, 151 five-year and 146 ten-year stretches since 1871
  assert.deepEqual([1, 5, 10].map((k) => rolling(STOCKS, { years: k }).n), [155, 151, 146]);
  assert.deepEqual(STRETCHES, [1, 5, 10]); assert.equal(STRETCH_FIRST, 10);
});

test("the Sharpe ratio by hand: the average return over bills for each unit of their ups and downs", () => {
  const s = sharpe(STOCKS, { from: 2001, history: TINY });
  // the yearly returns over bills: 0.09, -0.22, 0.28, 0.04; their mean 0.0475; squared distances from it sum to 0.127475
  near(s.excess, 0.0475); near(s.spread, Math.sqrt(0.127475 / 3)); near(s.ratio, 0.0475 / Math.sqrt(0.127475 / 3));
  assert.equal(s.n, 4); assert.equal(s.from, 2001); assert.equal(s.to, 2004);
  // all cash has no ups and downs above the bills: no ratio
  assert.equal(sharpe({ stocks: 0, bonds: 0, bills: 1 }, { from: 2001, history: TINY }).ratio, null);
  // on the bundled history it starts where the true bill record does: 1928 to 2025, 98 years
  const real = sharpe(STOCKS);
  assert.equal(BILLS_FROM, 1928); assert.equal(real.from, 1928); assert.equal(real.n, 98);
  assert.ok(real.ratio > 0.3 && real.ratio < 0.6, String(real.ratio));
});

test("correlation by hand, and the plain words at each cut-off", () => {
  assert.equal(correlation([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(correlation([1, 2, 3], [6, 4, 2]), -1);
  near(correlation([1, 2, 3, 4], [1, 3, 2, 4]), 0.8);   // 4 / sqrt(5 x 5)
  assert.equal(correlation([1, 1, 1], [1, 2, 3]), null);
  // stocks and bonds on the made-up history: -0.01775 / sqrt(0.126875 x 0.0025)
  const rows = together({ from: 2001, recent: 2003, history: TINY });
  assert.deepEqual(rows.map((r) => [r.a, r.b]), [["stocks", "bonds"], ["stocks", "bills"], ["bonds", "bills"]]);
  near(rows[0].r, -0.01775 / Math.sqrt(0.126875 * 0.0025));
  assert.equal(rows[0].words, "move closely in opposite directions");
  assert.equal(rows[0].recentR, -1);                     // two years only: a straight line
  assert.equal(rows[0].from, 2001); assert.equal(rows[0].recent, 2003);
  const cases = [[0.8, "move closely together"], [0.79, "often move together"], [0.5, "often move together"], [0.49, "move a little together"], [0.2, "move a little together"],
    [0.19, "barely move together"], [0, "barely move together"], [-0.19, "barely move together"], [-0.2, "move a little in opposite directions"], [-0.49, "move a little in opposite directions"],
    [-0.5, "often move in opposite directions"], [-0.79, "often move in opposite directions"], [-0.8, "move closely in opposite directions"], [null, "cannot be told apart"]];
  for (const [r, w] of cases) assert.equal(togetherWords(r), w, String(r));
  // the bundled history: since 1928 and again since 2000
  const all = together();
  assert.equal(all[0].from, BILLS_FROM); assert.equal(all[0].recent, RECENT_FROM);
  assert.equal(all[0].words, "barely move together"); assert.equal(all[0].recentWords, "move a little in opposite directions");
  assert.equal(all[2].words, "move a little together");
});

test("one written sentence for each case (R5)", () => {
  assert.equal(stretchSentence({ years: 10, n: 146, from: 1871, lost: 0, lostShare: 0, middle: 0.0732 }), "Over the 146 ten-year stretches since 1871, this mix never lost money; the middle one grew 7.3% a year.");
  assert.equal(stretchSentence({ years: 5, n: 151, from: 1871, lost: 5, lostShare: 5 / 151, middle: 0.0832 }), "Over the 151 five-year stretches since 1871, this mix lost money in 5 (3%); the middle one grew 8.3% a year.");
  assert.equal(stretchSentence({ years: 1, n: 155, from: 1871, lost: 36, lostShare: 36 / 155, middle: 0.0887 }), "Of the 155 years since 1871, this mix lost money in 36 (23%); the middle year grew 8.9%.");
  assert.equal(stretchSentence({ years: 1, n: 155, from: 1871, lost: 1, lostShare: 1 / 155, middle: -0.004 }), "Of the 155 years since 1871, this mix lost money in 1 (1%); the middle year grew -0.4%.");
  assert.equal(stretchRealSentence({ lostReal: 16, lostRealShare: 16 / 146 }), "After inflation, 16 of them (11%) lost buying power.");
  assert.equal(stretchRealSentence({ lostReal: 0, lostRealShare: 0 }), "After inflation, none of them lost buying power.");
  assert.equal(stripWords({ worst: { rate: -0.3 } }), "From the worst stretch to the best: red is a loss, the mark is the middle.");
  assert.equal(stripWords({ worst: { rate: 0.011 } }), "From the worst stretch to the best, with the middle marked: none lost money.");
  const s = { main: { ratio: 0.4496, excess: 0.0633, spread: 0.1408, from: 1928 }, stocks: { ratio: 0.4283 }, bonds: { ratio: 0.1844 } };
  // critic P6: the sentence itself says why it starts in 1928 while the stretches start in 1871
  assert.equal(sharpeSentence(s), "Since 1928, when the record of 3-month Treasury bills begins, this mix earned 6.3% a year more than those bills on average, with ups and downs of 14.1% a year around that, so 0.45 for each unit. Higher is better: all stocks 0.43, all bonds 0.18.");
  // critic P5: the row names the mix the way the headline does; the plan's own 70% says where it comes from
  const w = { stocks: 0.7, bonds: 0.3, bills: 0 };
  assert.equal(longerLead({ label: "Your plan's mix", weights: w }, 1871), "Every stretch of years since 1871 for your plan's mix (70% stocks, from the Will the money last? page, where you can change it), before fees and taxes.");
  assert.equal(longerLead({ label: "Your target mix", weights: w }, 1871), "Every stretch of years since 1871 for your target mix (70% stocks), before fees and taxes.");
  assert.equal(longerLead({ label: "What you hold", weights: { stocks: 0.9, bonds: 0.05, bills: 0.05 } }, 1871), "Every stretch of years since 1871 for what you hold (90% stocks), before fees and taxes.");
  assert.equal(sharpeSentence({ ...s, main: { ratio: null, from: 1928 } }), "A mix that is all cash has no ups and downs above Treasury bills, so this number does not apply to it.");
  assert.deepEqual(pairRow({ a: "stocks", b: "bonds", r: 0.0183, recentR: -0.365, words: "barely move together", recentWords: "move a little in opposite directions", from: 1928, recent: 2000 }),
    { title: "Stocks and bonds", words: "barely move together", sub: "0.02 since 1928; -0.36 since 2000 (lately they move a little in opposite directions)" });
  assert.deepEqual(pairRow({ a: "bonds", b: "bills", r: 0.279, recentR: 0.2, words: "move a little together", recentWords: "move a little together", from: 1928, recent: 2000 }),
    { title: "Bonds and cash", words: "move a little together", sub: "0.28 since 1928; 0.20 since 2000" });
  assert.equal(pairRow({ a: "stocks", b: "bills", r: -0.001, recentR: null, words: "barely move together", recentWords: "cannot be told apart", from: 1928, recent: 2000 }).sub, "0.00 since 1928; - since 2000 (lately they cannot be told apart)");
});

// ---------------------------------------------------------------- invariance: nothing asked, nothing moves
const KEYS_81A5288 = ["ready", "amount", "held", "target", "plan", "comparison", "yearsToRetire", "verdict", "main", "notes", "hasHoldings", "targetSource"];
async function everyPlan() {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  return [investmentsPlan(), familyPlan(T), renterDebtPlan(), retiredCouplePlan(T), emptyPlan(), ...ARCHETYPES.map((a) => a.build())].map((p) => migrate(structuredClone(p)));
}
test("invariance: without a stretch the output has 81a5288's keys only; with one, one key more and every other byte the same", async () => {
  for (const p of await everyPlan()) {
    const a = compute(p, { today: T });
    assert.deepEqual(Object.keys(a), KEYS_81A5288);
    const before = JSON.stringify(p);
    for (const k of [1, 5, 10, 7]) {
      const b = compute(p, { today: T, stretch: k });
      assert.equal(JSON.stringify(p), before, "nothing in the plan is touched");
      assert.deepEqual(Object.keys(b), [...KEYS_81A5288, "longer"]);
      const { longer, ...rest } = b;
      assert.equal(JSON.stringify(rest), JSON.stringify(a));
      assert.equal(longer.rolling.years, k === 7 ? STRETCH_FIRST : k, "a stretch not offered reads as the first one");
      assert.deepEqual(longer.rolling, rolling(a.main.weights, { years: k === 7 ? 10 : k }));
    }
  }
});

// ---------------------------------------------------------------- the page (stand-in DOM)
async function page(plan, today = T) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 140 });
  const P = { plan: migrate(structuredClone(plan)), saved: [], root: null };
  P.route = { group: "investments", id: "risk", rest: [], query: {} };
  P.draw = () => { P.root = new FakeElement("main"); render(P.root, { ui, fmt: { ...fmt, today: () => today }, plan: P.plan, route: P.route, module: { group: "investments", id: "risk" },
    store: { get: () => P.plan, update: (fn) => { const d = structuredClone(P.plan); fn(d); P.saved.push(d); P.plan = d; P.draw(); } }, redraw: P.draw }); return P; };
  P.part = (id) => P.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  P.states = () => P.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open"), textOf(e.querySelector(".fold-title")), e.querySelector(".fold-status")?.textContent ?? ""]);
  P.textOf = textOf;
  P.tap = (label, within = P.part("longer")) => { const b = within.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label); assert.ok(b, `a button "${label}"`); b.click(); return P; };
  return P.draw();
}

test("the page: the first view keeps the headline, the tiles and the first thing to do; three quiet rows after it", async () => {
  resetStretch();
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const P = await page(familyPlan(T));
  assert.deepEqual(P.states(), [["mixes", false, "6 more mixes", ""], ["longer", false, LONGER_TITLE, "10-year stretches"], ["how", false, "How this is worked out", ""]]);
  const cards = P.root.children.map((c) => P.textOf(c.querySelector?.("h2") ?? c.querySelector?.("h1") ?? c).slice(0, 30));
  assert.ok(cards.includes("What to do with this"), cards.join(" | "));
  const todo = P.root.children.find((c) => P.textOf(c.querySelector?.("h2") ?? c) === "What to do with this");
  assert.equal(todo.querySelectorAll("li").length, 1, "the first line of what to do stays; the other two moved");
  assert.match(P.textOf(P.part("how")), /Time heals stocks, not always bonds .* Money needed soon is not investment money/);
  assert.match(P.textOf(P.part("how")), /Since 1970 the same mix has swung about \d+% a year/);
  assert.match(P.textOf(P.part("mixes")), /100 \/ 0 stocks \/ bonds .* 0 \/ 100 stocks \/ bonds/);
  assert.ok(!P.root.all().some((e) => e.tagName === "H2" && P.textOf(e) === "The standard mixes, on your money"));
});

test("S11: Ups and downs over longer stretches: the chips change the stretch, the row stays open, nothing is saved, the other rows are as they were", async () => {
  resetStretch();
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const P = await page(familyPlan(T));
  const d = compute(P.plan, { today: T, stretch: 10 });
  const body = () => P.textOf(P.part("longer"));
  assert.ok(body().includes(stretchSentence(d.longer.rolling)), body());
  assert.match(body(), /Over the 146 ten-year stretches since 1871, this mix never lost money; the middle one grew 7\.3% a year\. After inflation, 16 of them \(11%\) lost buying power\./);
  assert.match(body(), /Worst 1\.1% a year 1929-1938 Middle 7\.3% a year half did better, half worse Best 16\.5% a year 1989-1998/);
  assert.match(body(), /Return for each unit of ups and downs Since 1928, when the record of 3-month Treasury bills begins, this mix earned 6\.3% a year more than those bills on average, with ups and downs of 14\.1% a year around that, so 0\.45 for each unit\. Higher is better: all stocks 0\.43, all bonds 0\.18\. Its usual name is the Sharpe ratio\./);
  // critic P7: the plain words come before the usual name
  assert.match(body(), /Each figure says how closely the two move together \(its usual name is the correlation\): 1 always together, 0 no link, -1 always opposite\./);
  assert.match(body(), /How the parts move together Stocks and bonds barely move together 0\.02 since 1928; -0\.36 since 2000 \(lately they move a little in opposite directions\) Stocks and cash barely move together .* Bonds and cash move a little together 0\.28 since 1928; 0\.15 since 2000 \(lately they barely move together\)/);
  // one year at a time: the family's 70% stocks lost money in 36 of the 155 years
  P.part("longer").setAttribute("open", "");
  P.tap("1 year");
  assert.match(body(), /Of the 155 years since 1871, this mix lost money in 36 \(23%\); the middle year grew 8\.9%\. After inflation, 46 of them \(30%\) lost buying power\./);
  assert.match(body(), /Worst -31\.5% 1931 Middle 8\.9% half did better, half worse Best 37\.8% 1954/);
  assert.deepEqual(P.states().map((s) => s[3]), ["", "year by year", ""], "the row says which stretch it shows");
  P.tap("5 years");
  assert.match(body(), /Over the 151 five-year stretches since 1871, this mix lost money in 5 \(3%\); the middle one grew 8\.3% a year\./);
  assert.equal(P.saved.length, 0, "a choice of view: nothing written");
  assert.deepEqual(P.states().map((s) => s.slice(0, 2)), [["mixes", false], ["longer", false], ["how", false]], "a redraw by a chip changes no other row (the shell keeps this one open)");
  // the picture: a strip from the worst to the best, red below zero, with the middle marked
  const strip = P.part("longer").all().find((e) => e.dataset?.spread !== undefined);
  assert.ok(strip.all().some((e) => e.style?.background === "var(--bad)") && strip.all().some((e) => e.style?.background === "var(--accent)"));
  resetStretch();
});

test("the empty plan: the same rows, no dollars; nothing breaks", async () => {
  resetStretch();
  const P = await page(emptyPlan());
  assert.deepEqual(P.states().map((s) => s[2]), ["6 more mixes", LONGER_TITLE, "How this is worked out"]);
  // critic P5: no mix of their own yet: the row says it is the plan's 70% and where to change it, never "like yours"
  assert.match(P.textOf(P.part("longer")), /for your plan's mix \(70% stocks, from the Will the money last\? page, where you can change it\)/);
  assert.doesNotMatch(P.textOf(P.part("longer")), /like yours/);
  assert.ok(!/bad year/.test(P.textOf(P.root.children[0])), "no money: the headline names no bad year, so its meaning is not drawn");
  assert.match(P.textOf(P.part("how")), /A "bad year" is one swing below zero/);
  assert.ok(!/NaN|undefined|null/.test(P.textOf(P.root)));
});

test("critic P5: a household with holdings reads \"what you hold\" in the row, by the same name as the headline", async () => {
  resetStretch();
  const P = await page(investmentsPlan());
  assert.match(P.textOf(P.root.children[0]), /^.*What you hold \(/);
  assert.match(P.textOf(P.part("longer")), /Every stretch of years since 1871 for what you hold \(\d+% stocks\), before fees and taxes\./);
  assert.doesNotMatch(P.textOf(P.part("longer")), /like yours|Will the money last/);
});
