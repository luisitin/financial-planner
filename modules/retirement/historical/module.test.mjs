// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("historical: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

// ---------------------------------------------------------------- the rate that never touches the starting money (gap next-60 #53)
const H = await import("./compute.js");
const { RETURNS } = await import("./data/returns.js");
const { buildInputs } = await import("../projection/compute.js");
const T = "2026-11-14";
const near = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;
/** The window played out year by year: take w x B x the year's price level at the start, then the year's return; the end in
 * today's dollars. */
function playOut(window, s, w, B = 100) {
  let bal = B, P = 1;
  for (const y of window) { bal -= w * B * P; bal *= 1 + s * y.stocks + (1 - s) * y.bonds; P *= 1 + y.inflation; }
  return bal / P;
}

test("#53 perpetualRate against a hand calculation on short invented returns", () => {
  // two years, 10% then 20%, no inflation: G = 1.1 x 1.2 = 1.32, H = 1.1 x 1.2 + 1.2 = 2.52, so w = 0.32 / 2.52
  const a = [{ stocks: 0.1, bonds: 0.1, inflation: 0 }, { stocks: 0.2, bonds: 0.2, inflation: 0 }];
  assert.ok(near(H.perpetualRate(a, 0.5), 0.32 / 2.52), `${H.perpetualRate(a, 0.5)}`);
  // by hand with $100: take $12.698 -> 87.302 x 1.1 = 96.032; take 12.698 -> 83.333 x 1.2 = 100.000
  assert.ok(near(playOut(a, 0.5, 0.32 / 2.52), 100, 1e-9));
  // prices up 10% in the first year, returns 10% and 21%: P = 1, 1.1, 1.1 at the end; G = 1.1 x 1.21 / 1.1 = 1.21;
  // H = (1 x 1.331 + 1.1 x 1.21) / 1.1 = 2.42, so w = 0.21 / 2.42 = 8.678%
  const b = [{ stocks: 0.1, bonds: 0.1, inflation: 0.1 }, { stocks: 0.21, bonds: 0.21, inflation: 0 }];
  assert.ok(near(H.perpetualRate(b, 0.5), 0.21 / 2.42));
  assert.ok(near(playOut(b, 0.5, 0.21 / 2.42), 100, 1e-9), "the end in today's dollars is the start");
  // the mix: stocks 20%, bonds 0% at half and half is 10% a year; all in stocks, 20%
  const c = [{ stocks: 0.2, bonds: 0, inflation: 0 }];
  assert.ok(near(H.perpetualRate(c, 0.5), 0.1 / 1.1) && near(H.perpetualRate(c, 1), 0.2 / 1.2));
  // a year that loses after prices: nothing can be taken (0, never below); no window: null
  assert.equal(H.perpetualRate([{ stocks: -0.1, bonds: -0.1, inflation: 0 }], 0.5), 0);
  assert.equal(H.perpetualRate([{ stocks: 0.02, bonds: 0.02, inflation: 0.03 }], 0.5), 0);
  assert.equal(H.perpetualRate([], 0.5), null);
});

test("#53 perpetualRate on real history: at the rate the end is the start in today's dollars, a hair more ends below", () => {
  for (const [from, n, s] of [[1929, 30, 0.5], [1966, 30, 0.6], [1974, 31, 0.5], [2000, 20, 0.4], [1928, 60, 0.7]]) {
    const k = RETURNS.findIndex((r) => r.year === from);
    const win = RETURNS.slice(k, k + n);
    const w = H.perpetualRate(win, s);
    assert.ok(w > 0, `${from}: ${w}`);
    assert.ok(near(playOut(win, s, w), 100, 1e-7), `${from}: ${playOut(win, s, w)}`);
    assert.ok(playOut(win, s, w + 0.0001) < 100, `${from}: more than the rate touches the starting money`);
    // and it never ran out on the way
    let bal = 100, P = 1; for (const y of win) { bal -= w * 100 * P; assert.ok(bal > 0, `${from}: ran out`); bal *= 1 + s * y.stocks + (1 - s) * y.bonds; P *= 1 + y.inflation; }
  }
});

test("#53 perpetualOf: the plan's years of taking money out, every start year history has room for, the worst and a middle one", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const I = buildInputs(familyPlan(T), { today: T }).inputs;
  const p = H.perpetualOf(I);
  assert.deepEqual([p.from, p.to, p.years], [I.retireYear, I.endYear, I.endYear - I.retireYear + 1]);
  assert.equal(p.stocks, I.rates.stocksRetired);
  assert.equal(p.windows, RETURNS.length - p.years + 1);
  const all = RETURNS.slice(0, p.windows).map((r, k) => ({ startYear: r.year, rate: H.perpetualRate(RETURNS.slice(k, k + p.years), p.stocks) }));
  const sorted = [...all].sort((a, b) => a.rate - b.rate || a.startYear - b.startYear);
  assert.deepEqual(p.worst, sorted[0]);
  assert.deepEqual(p.middle, sorted[Math.floor((sorted.length - 1) / 2)]);
  assert.ok(all.filter((x) => x.rate < p.middle.rate).length <= Math.floor(all.length / 2) && all.filter((x) => x.rate > p.middle.rate).length <= Math.floor(all.length / 2), "the middle");
  // a household already retired takes money out from this year
  const R = buildInputs(retiredCouplePlan(T), { today: T }).inputs;
  const q = H.perpetualOf(R);
  assert.equal(q.from, R.startYear);
  assert.equal(q.years, R.endYear - R.startYear + 1);
  // too many years for history: none
  assert.equal(H.perpetualOf({ ...I, startYear: 1900, retireYear: 1900, endYear: 2100 }), null);
  console.log(`# #53 family: ${p.years} years from ${p.from}, worst ${p.worst.startYear} ${(p.worst.rate * 100).toFixed(2)}%, middle ${p.middle.startYear} ${(p.middle.rate * 100).toFixed(2)}%, plan ${(p.plan.rate * 100).toFixed(2)}% in ${p.plan.year}`);
});

test("#53 planRate: what the average-market run takes from savings in its first retired year, over the savings then", async () => {
  const { project } = await import("../../../core/math/retirement.js");
  const { firstYear } = await import("../withdrawal-strategy/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  for (const plan of [familyPlan(T), retiredCouplePlan(T)]) {
    const I = buildInputs(plan, { today: T }).inputs;
    const q = H.planRate(I);
    const rows = project(I).rows, k = rows.findIndex((r) => r.retired), row = rows[k];
    const start = k > 0 ? rows[k - 1].total : I.balances.cash + I.balances.taxable + I.balances.deferred + I.balances.free;
    assert.equal(q.year, row.year);
    // How much to take out's own first-year need (today's dollars), at that year's prices, over the savings at its start
    const f = firstYear(plan, { today: T });
    assert.equal(f.year, q.year);
    assert.ok(near(q.rate, (f.need * row.priceLevel) / start, 1e-9), `${q.rate} vs ${(f.need * row.priceLevel) / start}`);
  }
  // no savings at all: no rate of its own
  const I = buildInputs(familyPlan(T), { today: T }).inputs;
  assert.equal(H.planRate({ ...I, balances: { cash: 0, taxable: 0, deferred: 0, free: 0 }, contributions: [], retireYear: I.startYear }).rate, null);
});

test("#53 the words: one sentence per case for history and for the plan, the status, and the how", () => {
  const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
  const P = (worst, middle, plan, years = 31, from = 2055, to = 2085) => ({ years, from, to, stocks: 0.5, windows: 68, worst: { startYear: 1964, rate: worst }, middle: { startYear: 1974, rate: middle }, plan });
  // one sentence per start (n1 fix P5: it was one sentence of about 60 words)
  const both = "In the worst start in history (1964), you could take out 2.5% of the savings in the first year, then the same amount raised with prices each year, and still have at least as much at the end of the 31 years from 2055 to 2085, in today's dollars. In a middle start (1974), you could take out 4.0%.";
  const Y = "2.5% to 4.0% a year";
  const cases = [
    [P(0.0249, 0.0401, { year: 2055, rate: 0.0526 }), "both", Y, both, "above", "Your plan takes out 5.3% of its savings in its first year retired (2055), more than even a middle start could."],
    [P(0.0249, 0.0401, { year: 2055, rate: 0.038 }), "both", Y, both, "between", "Your plan takes out 3.8% of its savings in its first year retired (2055), between the two."],
    // as shown, 2.5% is the worst start's own figure: between, not "less"
    [P(0.0249, 0.0401, { year: 2055, rate: 0.0251 }), "both", Y, both, "between", "Your plan takes out 2.5% of its savings in its first year retired (2055), between the two."],
    [P(0.0249, 0.0401, { year: 2055, rate: 0.0121 }), "both", Y, both, "below", "Your plan takes out 1.2% of its savings in its first year retired (2055), less than even the worst start could."],
    [P(0.0249, 0.0401, { year: 2026, rate: 0 }), "both", Y, both, "nothing", "Your plan takes nothing from its savings in its first year retired (2026): its income pays for the spending."],
    [P(0.0249, 0.0401, { year: 2067, rate: 44.3 }), "both", Y, both, "all", "In its first year retired (2067) your plan needs more than all of its savings."],
    [P(0.0249, 0.0401, { year: 2067, rate: 1 }), "both", Y, both, "all", "In its first year retired (2067) your plan needs more than all of its savings."],
    // a quarter or more (n1 fix F2: 65.7% read "more than even a middle start could", beside 4.0%)
    [P(0.0249, 0.0401, { year: 2062, rate: 0.6573 }), "both", Y, both, "far", "Your plan takes out 65.7% of its savings in its first year retired (2062), far more than even a middle start could."],
    [P(0.0249, 0.0401, { year: 2062, rate: 0.25 }), "both", Y, both, "far", "Your plan takes out 25.0% of its savings in its first year retired (2062), far more than even a middle start could."],
    [P(0.0249, 0.0401, { year: 2062, rate: 0.2499 }), "both", Y, both, "above", "Your plan takes out 25.0% of its savings in its first year retired (2062), more than even a middle start could."],
    [P(0.0249, 0.0401, { year: 2067, rate: null }), "both", Y, both, "noSavings", "Your plan has no savings to take from when it retires, so it has no rate of its own to set beside these."],
    [P(0, 0.031, { year: 2026, rate: 0.02 }, 6, 2026, 2031), "worstNone", "up to 3.1% a year", "In the worst start in history (1964), the savings ended the 6 years from 2026 to 2031 smaller than they began, in today's dollars, even with nothing taken out. In a middle start (1974), you could take out 3.1% of the savings in the first year, then the same amount raised with prices each year, and still have at least as much at the end.", "between", "Your plan takes out 2.0% of its savings in its first year retired (2026), between the two."],
    [P(0, 0, null, 1, 2026, 2026), "allNone", "", "Over the one year 2026, the savings ended smaller than they began, in today's dollars, in at least half of the start years in history even with nothing taken out, so there is no such amount to give.", "", ""],
    // a status never over 20 characters (R25): two two-digit rates drop "a year"
    [P(0.1012, 0.1234, null), "both", "10.1% to 12.3%", "In the worst start in history (1964), you could take out 10.1% of the savings in the first year, then the same amount raised with prices each year, and still have at least as much at the end of the 31 years from 2055 to 2085, in today's dollars. In a middle start (1974), you could take out 12.3%.", "", ""],
  ];
  for (const [p, key, says, history, planKey, plan] of cases) {
    assert.deepEqual(view.growthWords(p, pct), { key, says, history, planKey, plan }, `${key}/${planKey}`);
    assert.ok(says.length <= 20, says);
    // n1 fix P4: no jargon on screen
    assert.ok(!/perpetual|withdrawal rate|below where/.test(`${history} ${plan}`));
  }
  assert.equal(view.growthHow(P(0.0249, 0.0401, null), pct), "How: for each start year since 1928, the share of the savings that could be taken out in the first year, then the same amount raised each year with that year's prices, so that after the 31 years from 2055 to 2085 the savings, in today's dollars, are at least what they were at the start. The savings grow with each year's stock and bond returns at your mix once retired (50% in stocks); no taxes, fees or income are counted. Your plan's own rate is what Will the money last? takes from savings in its first year retired (the spending, health insurance and tax, less your income) as a share of the savings then, if markets do as well as average. Taking out more than this rate does not mean the money runs out: only that the savings end smaller than they began, as a plan meant to be spent down does (the chance it lasts is the answer at the top).");
  assert.ok(!/perpetual/.test(view.growthHow(P(0.0249, 0.0401, null), pct)), "n1 fix P4: the term stays in the README");
});

test("simple first (R3 to R5): the answer and one written sentence per case", () => {
  const run = (n, ok) => Array.from({ length: n }, (_, i) => ({ startYear: 1928 + i, success: i < ok }));
  const D = (n, ok) => ({ windows: n, runs: run(n, ok), successRate: ok / n, verdict: ok / n >= 0.9 ? "strong" : ok / n >= 0.75 ? "fair" : "weak", dataRange: [1928, 2025] });
  const label = "start years since 1928 in which the money lasts to the end";
  assert.deepEqual(view.answerFor(D(68, 68)), { key: "every", value: "68 of 68", label, lede: "Strong: it lasted from every start year since 1928, through the Depression and the 1970s." });
  assert.deepEqual(view.answerFor(D(68, 64)), { key: "strong", value: "64 of 68", label, lede: "Strong: it lasted from nearly every start year, but not all." });
  assert.deepEqual(view.answerFor(D(68, 55)), { key: "fair", value: "55 of 68", label, lede: "Fair: most start years were fine, but the hardest ones ran it dry." });
  assert.deepEqual(view.answerFor(D(68, 20)), { key: "weak", value: "20 of 68", label, lede: "Weak: many stretches of real history would have run this plan dry." });
  assert.deepEqual(view.answerFor(D(68, 0)), { key: "none", value: "0 of 68", label, lede: "Weak: the money ran out from every start year since 1928." });
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const view = await import("./view.js");
const settle = () => new Promise((r) => setTimeout(r, 0));
async function page(plan0) {
  const plan = migrate(structuredClone(plan0));
  const s = { runs: [], saved: [] };
  s.root = new FakeElement("main");
  view.render(s.root, { ui, fmt: { ...fmt, today: () => T }, plan, view: { build: false }, module: { group: "retirement", id: "historical" }, route: { group: "retirement", id: "historical", rest: [], query: {} },
    store: { get: () => plan, backend: () => "local", update: (fn) => s.saved.push(fn) },
    computeRemote: async (key, params) => { s.runs.push({ key, params }); return compute(plan, params); } });
  await settle(); await settle();
  return s;
}
const everything = (el) => [el, ...el.all()];
const partsOf = (root) => everything(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const opened = (d) => d.hasAttribute("open");
const rowsOf = (root) => partsOf(root).map((p) => [p.dataset.part, p.dataset.kind, p.querySelector(".fold-title").textContent, p.querySelector(".fold-status")?.textContent ?? "", opened(p)]);
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden || /^(svg|STYLE)$/i.test(n.tagName ?? "") ? "" : n.tagName === "DETAILS" && !opened(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/​/g, "").replace(/\s+/g, " ").trim();
}

test("simple first (opt C14, with #53): the answer, the chart, then one card of three quiet rows; every figure moved, none deleted", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await page(familyPlan(T));
  assert.deepEqual(s.runs.map((r) => r.params), [{ today: T, perpetual: true }]);
  const d = compute(migrate(familyPlan(T)), { today: T, perpetual: true });
  const a = view.answerFor(d);
  const pct = (x) => fmt.pct(x, 1);
  const g = view.growthWords(d.perpetual, pct);
  assert.equal(seen(s.root), `If history repeated itself ${a.value} ${a.label} ${a.lede} Money left at the end, by the year the plan would have started Today's dollars. Zero means the money ran out before the end. ${2 + d.worst.length} more numbers › ${view.GROWTH_TITLE} ${g.says} › How this is worked out ›`);
  assert.deepEqual(rowsOf(s.root), [["numbers", "more", `${2 + d.worst.length} more numbers`, "", false], ["growth", "more", "Never run the savings down", "2.5% to 4.0% a year", false], ["how", "how", "How this is worked out", "", false]]);
  assert.equal(everything(s.root).filter((e) => e.dataset?.parts !== undefined).length, 1, "one parts card");
  assert.ok(!everything(s.root).some((e) => e.tagName === "DETAILS" && !e.dataset.part), "no hand-written fold");
  const body = (id) => seen(partOf(s.root, id).querySelector(".fold-body"));
  // the tiles and the hardest starts, moved into "N more numbers"
  const money = (n) => fmt.money(n, "USD");
  assert.match(body("numbers"), new RegExp(`^${money(d.safeSpending).replace(/\$/g, "\\$")} Spending that lasted in every start year a year, today's dollars; you plan on .* Typical amount left middle start year, today's dollars The hardest starts Starting in ${d.worst[0].startYear}`));
  // the growth part: its sentences and the how
  assert.equal(g.says, "2.5% to 4.0% a year");
  assert.equal(body("growth"), [g.history, g.plan, view.growthHow(d.perpetual, pct)].filter(Boolean).join(" "));
  // how: the old lede and the data line
  assert.match(body("how"), /^Your plan replayed through every stretch of actual US history since 1928, with the stock and bond returns and inflation of those years, starting in 1929, in 1966, in 2000 and so on\. Each start year is one run: \d+ of them, from 1928 to \d{4}\./);
  assert.match(body("how"), /Data: Aswath Damodaran's yearly returns \(S&P 500 with dividends, 10-year Treasuries, 3-month bills, CPI\), 1928 to 2025\./);
  assert.equal(s.saved.length, 0, "drawing changes nothing in the plan");
});

test("simple first: while history is replayed the page says so; a plan that cannot run says what it needs, with no parts", async () => {
  const root = new FakeElement("main");
  let release;
  const plan = migrate(emptyPlan());
  view.render(root, { ui, fmt: { ...fmt, today: () => T }, plan, view: { build: false }, module: { group: "retirement", id: "historical" }, route: { group: "retirement", id: "historical", rest: [], query: {} },
    store: { get: () => plan, backend: () => "local", update() {} }, computeRemote: () => new Promise((r) => { release = r; }) });
  assert.match(seen(root), /If history repeated itself Replaying history\.\.\.$/);
  release(null);
  const e = await page(emptyPlan());
  assert.match(seen(e.root), /If history repeated itself First, the plan needs three things: a birth date on the People page/);
  assert.equal(partsOf(e.root).length, 0);
});

test("S11: the page saves nothing; opening a part writes nothing to the plan and moves no other part", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await page(familyPlan(T));
  const states = () => partsOf(s.root).map((p) => [p.dataset.part, opened(p)]);
  assert.deepEqual(states(), [["numbers", false], ["growth", false], ["how", false]]);
  const g = partOf(s.root, "growth");
  g.setAttribute("open", ""); g.dispatch("toggle");
  assert.deepEqual(states(), [["numbers", false], ["growth", true], ["how", false]]);
  assert.equal(s.saved.length, 0);
  assert.equal(everything(s.root).filter((e) => e.tagName === "FORM" || /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)).length, 0, "no box on this page");
});
