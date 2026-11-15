// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, PERIODS, askedStart, nearestIndex, windowOf, ownBenchmark, benchmarkMix, mixOver, benchmarkOver, drivers, COMPARE_PRESETS, YTD_SLACK_DAYS, LAST_RETURN_YEAR } from "./compute.js";
import * as W from "./words.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { RETURNS } from "../../retirement/historical/data/returns.js";
import { xirr } from "../../../core/math/returns.js";

const T = "2026-11-13";
const near = (a, b, tol = 1e-9, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);

test("performance: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// ---- simple first (docs/OPTIONAL.md): "How this is worked out" is a part drawn by core/ui/more.js, title unchanged --------------
test("S11: picking a period saves nothing and keeps its row open; How this is worked out is the helper's part, shut, and no fold is by hand", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(!/\.update\(/.test(src), "the view writes the plan only through ui.undoable (Compare with)");
  assert.ok(!/<details|h\("details"/.test(src), "no <details> by hand");
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render, _test } = await import("./view.js");
  _test.reset();
  const p = migrate(investmentsPlan());
  const was = JSON.stringify(p);
  const saved = [];
  let root = null;
  const ctx = { ui, fmt: { ...fmt, today: () => "2026-09-16" }, plan: p, route: { group: "investments", id: "performance", rest: [], query: {} }, module: { group: "investments", id: "performance" },
    store: { get: () => p, update: (fn) => { const dr = structuredClone(p); fn(dr); saved.push(dr); } }, redraw: () => { root = draw(); } };
  const draw = () => { const r = new FakeElement("main"); render(r, ctx); return r; };
  const states = (r) => r.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  root = draw();
  const b = draw();
  assert.deepEqual(states(root), [["drivers", "more", false], ["period", "own", false], ["compare", "own", false], ["how", "how", false]], "four parts, in the helper's order, shut on the first view");
  assert.deepEqual(states(b), states(root), "drawn again, nothing opens or shuts");
  const how = root.all().find((e) => e.dataset.part === "how");
  assert.equal(how.querySelector(".fold-title").textContent, "How this is worked out", "the title is unchanged");
  assert.match(textOf(how), /time-weighted return/);
  // a chip: the page measures the stretch, "Pick the period" stays open, nothing else opens, nothing is saved
  const chip = (r, part, label) => r.all().find((e) => e.dataset.part === part).querySelectorAll("button").find((x) => x.textContent === label);
  chip(root, "period", "This year so far").click();
  assert.deepEqual(states(root), [["drivers", "more", false], ["period", "own", true], ["compare", "own", false], ["how", "how", false]]);
  assert.equal(_test.period, "ytd");
  assert.match(textOf(root.all().find((e) => e.dataset.part === "period")), /From 3\/16\/2026 to 9\/16\/2026: your first saved point this year and the one nearest to today\./);
  assert.equal(root.all().find((e) => e.dataset.part === "period").querySelector(".fold-status").textContent, "this year so far");
  assert.equal(saved.length, 0, "a period is never saved");
  assert.equal(JSON.stringify(p), was, "drawing and picking changed nothing in the plan");
  // the next draw (no pick): the row is shut again, the stretch still measured for this visit
  root = draw();
  assert.deepEqual(states(root).map((s) => s[2]), [false, false, false, false]);
  assert.match(textOf(root.querySelector("h1")), /a year so far/);
  _test.reset();
});

// ---------------------------------------------------------------- the period picked
// one brokerage, no deposits, a point every 6 months for five years: each period's return is end / start - 1
function pointsPlan(points) {
  const p = migrate(emptyPlan());
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: points.at(-1)[1], history: points.map(([date, balance]) => ({ date, balance })) });
  return p;
}
const FIVE = [["2021-10-31", 100000], ["2022-04-30", 90000], ["2022-10-31", 95000], ["2023-04-30", 104000], ["2023-10-31", 110000], ["2024-04-30", 121000],
  ["2024-10-31", 130000], ["2025-04-30", 126000], ["2025-10-31", 140000], ["2026-04-30", 150000], ["2026-10-31", 160000]];

test("the asked start of each quick period: 1 January, the same day N years back (29 February -> 28 February), the first saved point", () => {
  assert.deepEqual(PERIODS.map((p) => p.key), ["ytd", "1y", "3y", "5y", "all"]);
  assert.deepEqual(PERIODS.map((p) => p.label), ["This year so far", "1 year", "3 years", "5 years", "Since the first saved point"]);
  assert.equal(askedStart("ytd", T), "2026-01-01");
  assert.equal(askedStart("1y", T), "2025-11-13");
  assert.equal(askedStart("3y", T), "2023-11-13");
  assert.equal(askedStart("5y", T), "2021-11-13");
  assert.equal(askedStart("1y", "2028-02-29"), "2027-02-28");
  assert.equal(askedStart("all", T, "2021-10-31"), "2021-10-31");
});

test("the nearest saved point: the fewest days either way, the earlier on a tie; a stretch is from the point nearest its start to the point nearest its end", () => {
  const pts = [{ date: "2026-01-01" }, { date: "2026-01-11" }, { date: "2026-02-01" }];
  assert.equal(nearestIndex(pts, "2026-01-06"), 0, "5 days each way: the earlier");
  assert.equal(nearestIndex(pts, "2026-01-07"), 1);
  assert.equal(nearestIndex(pts, "2030-01-01"), 2);
  assert.equal(nearestIndex([], "2026-01-01"), -1);
  assert.deepEqual(windowOf(pts, "2025-12-01", "2026-01-20").map((x) => x.date), ["2026-01-01", "2026-01-11"]);
  assert.deepEqual(windowOf(pts, "2026-01-30", "2026-02-02").map((x) => x.date), ["2026-02-01"], "one point: nothing to measure");
  // with a floor, the start is the nearest point on or after it
  assert.deepEqual(windowOf(pts, "2026-01-06", "2026-02-01", "2026-01-02").map((x) => x.date), ["2026-01-11", "2026-02-01"]);
  assert.deepEqual(windowOf(pts, "2026-01-06", "2026-02-01", "2027-01-01"), [], "no point on or after the floor");
});

test("each period measures from the saved point nearest its start to the point nearest today, and says so", () => {
  const p = pointsPlan(FIVE);
  const run = (period) => compute(p, { today: T, period, parts: true });
  const cases = {
    ytd: ["2026-04-30", "2026-10-31", 160 / 150],   // October 2025 is 62 days before 1 January: more than a month, so the year starts at April (critic M2)
    "1y": ["2025-10-31", "2026-10-31", 160 / 140],
    "3y": ["2023-10-31", "2026-10-31", 160 / 110],
    "5y": ["2021-10-31", "2026-10-31", 160 / 100],
  };
  for (const [key, [from, to, growth]] of Object.entries(cases)) {
    const d = run(key);
    assert.equal(d.overall.from, from, key); assert.equal(d.overall.to, to, key);
    near(d.accounts[0].twr, growth - 1, 1e-9, key);
    assert.equal(d.period.key, key); assert.equal(d.period.moved, true, `${key}: today is 13 days after the last point`);
    assert.equal(d.period.fellBack, false);
  }
  // every point: the page as it always was
  const all = run("all"), none = compute(p, { today: T });
  assert.equal(all.period.key, "all"); assert.equal(all.period.asked, null);
  const { period, drivers: dr, compare, ...rest } = all;
  assert.equal(JSON.stringify(rest), JSON.stringify(none));
  near(none.accounts[0].twr, 0.6, 1e-9);
  // the words, one sentence per case
  assert.equal(W.periodSentence(all.period), "From 10/31/2021, the first saved point, to 10/31/2026, the last.");
  assert.equal(W.periodSentence(run("1y").period), "From 10/31/2025 to 10/31/2026: the saved points nearest to a year ago and to today.");
  assert.equal(W.periodSentence(run("ytd").period), "From 4/30/2026 to 10/31/2026: your first saved point this year and the one nearest to today.");
  assert.equal(W.periodSentence(run("3y").period), "From 10/31/2023 to 10/31/2026: the saved points nearest to 3 years ago and to today.");
  // points saved on the very days asked: no "nearest"
  const exact = compute(pointsPlan([["2025-11-13", 100], ["2026-05-13", 104], ["2026-11-13", 110]]), { today: T, period: "1y", parts: true });
  assert.equal(exact.period.moved, false);
  assert.equal(W.periodSentence(exact.period), "From 11/13/2025 to 11/13/2026.");
  // 5 years asked of one year of points: it starts at the first saved point, said so
  const short = compute(investmentsPlan(), { today: T, period: "5y", parts: true });
  assert.equal(short.period.from, "2025-09-16");
  assert.equal(W.periodSentence(short.period), "From 9/16/2025 to 9/16/2026: your saved points go back only to 9/16/2025.");
  assert.deepEqual(PERIODS.map((x) => W.periodStatus({ key: x.key })), ["this year so far", "1 year", "3 years", "5 years", "every saved point"]);
});

test("this year so far never starts at a point from last autumn: a December point is the start of the year, an earlier one is not (critic M2)", () => {
  assert.equal(YTD_SLACK_DAYS, 31);
  // the critic's case: a point 47 days before 1 January and one this November; the year holds one point, so nothing to measure
  const two = pointsPlan([["2025-11-15", 10000], ["2026-11-10", 9300]]);
  const ytd = compute(two, { today: "2026-11-15", period: "ytd", parts: true });
  assert.equal(ytd.period.fellBack, true, "not the whole year before, said as this year");
  assert.equal(ytd.period.key, "all");
  const y1 = compute(two, { today: "2026-11-15", period: "1y", parts: true });
  assert.equal(y1.period.fellBack, false); assert.equal(y1.overall.from, "2025-11-15", "a year back still starts there");
  // a point saved in December counts as the start of the year (within a month), said as the nearest
  const dec = pointsPlan([["2025-06-30", 9000], ["2025-12-20", 10000], ["2026-06-30", 10500], ["2026-11-10", 11000]]);
  const d = compute(dec, { today: "2026-11-15", period: "ytd", parts: true });
  assert.equal(d.overall.from, "2025-12-20"); assert.equal(d.overall.to, "2026-11-10");
  near(d.accounts[0].twr, 11000 / 10000 - 1);
  assert.equal(W.periodSentence(d.period), "From 12/20/2025 to 11/10/2026: the saved points nearest to the start of the year and to today.");
  // one day past the month: the first point in the year instead
  const nov = pointsPlan([["2025-11-30", 10000], ["2026-03-31", 10400], ["2026-11-10", 11000]]);
  const n = compute(nov, { today: "2026-11-15", period: "ytd", parts: true });
  assert.equal(n.overall.from, "2026-03-31");
  assert.equal(W.periodSentence(n.period), "From 3/31/2026 to 11/10/2026: your first saved point this year and the one nearest to today.");
});

test("your own dates are moved to the nearest saved points and said plainly; a stretch with one point falls back to every point", () => {
  const p = pointsPlan(FIVE);
  const moved = compute(p, { today: T, period: { from: "2022-01-01", to: "2024-06-30" }, parts: true });
  assert.equal(moved.period.key, "own"); assert.equal(moved.overall.from, "2021-10-31"); assert.equal(moved.overall.to, "2024-04-30");
  near(moved.accounts[0].twr, 121 / 100 - 1);
  assert.equal(W.periodSentence(moved.period), "You asked for 1/1/2022 to 6/30/2024; the nearest saved points are 10/31/2021 and 4/30/2024, so those are measured.");
  assert.equal(W.periodStatus(moved.period), "your own dates");
  const asked = compute(p, { today: T, period: { from: "2023-04-30", to: "2025-04-30" }, parts: true });
  assert.equal(asked.period.moved, false);
  assert.equal(W.periodSentence(asked.period), "From 4/30/2023 to 4/30/2025, as you asked.");
  near(asked.accounts[0].twr, 126 / 104 - 1);
  // the dates the wrong way round are taken the right way round
  const swapped = compute(p, { today: T, period: { from: "2025-04-30", to: "2023-04-30" }, parts: true });
  assert.equal(swapped.overall.from, "2023-04-30");
  // a month with no point in it: the nearest point to both ends is the same one
  const one = compute(p, { today: T, period: { from: "2026-01-01", to: "2026-01-15" }, parts: true });
  assert.equal(one.period.fellBack, true); assert.equal(one.period.key, "all");
  assert.equal(one.overall.from, "2021-10-31", "every point instead");
  assert.equal(W.periodStatus(one.period), "every saved point");
  assert.equal(W.FELL_BACK, "No two saved points fall in that stretch, so there is nothing to measure in it. The page shows every saved point instead.");
  // two accounts: one with no point in the stretch is left out of it, said apart from "save today's totals"
  p.accounts.push({ id: "r", name: "Roth IRA", type: "roth", balance: 20000, history: [{ date: "2021-10-31", balance: 9000 }, { date: "2026-10-31", balance: 20000 }] });
  const two = compute(p, { today: T, period: "1y", parts: true });
  assert.ok(two.notes.includes("Roth IRA is left out of this stretch: just one of its saved balances falls in it."), two.notes.join(" | "));
  assert.ok(!two.notes.some((n) => /only one saved balance/.test(n)), "not the note that sends you to Net worth");
  assert.equal(two.accounts.filter((a) => a.ready).length, 1);
});

// ---------------------------------------------------------------- Compare with: your own mix
test("your own mix: the yearly return of s x stocks + b x bonds + c x bills over the whole calendar years, against a hand chain", () => {
  const year = (y) => RETURNS.find((r) => r.year === y);
  // 80% stocks, 20% bonds, 2021 to 2025, by hand
  const r = [2021, 2022, 2023, 2024, 2025].map((y) => 0.8 * year(y).stocks + 0.2 * year(y).bonds);
  const chain = r.reduce((p, x) => p * (1 + x), 1);
  const m = mixOver("2020-12-31", "2026-03-31", { stocks: 0.8, bonds: 0.2, bills: 0 });
  assert.equal(m.years, 5); assert.equal(m.from, 2021); assert.equal(m.to, 2025);
  near(m.total, chain - 1, 1e-12); near(m.annual, Math.pow(chain, 1 / 5) - 1, 1e-12);
  near(m.annual, 0.1097, 0.0001, "80/20 made about 11.0% a year over 2021-2025");
  // with cash (3-month Treasury bills)
  const c = [2023, 2024, 2025].map((y) => 0.6 * year(y).stocks + 0.3 * year(y).bonds + 0.1 * year(y).bills).reduce((p, x) => p * (1 + x), 1);
  near(mixOver("2023-01-01", "2025-12-31", { stocks: 0.6, bonds: 0.3, bills: 0.1 }).annual, Math.pow(c, 1 / 3) - 1, 1e-12);
  assert.equal(mixOver("2025-09-16", "2026-09-16", { stocks: 1, bonds: 0, bills: 0 }), null, "no whole calendar year inside");
  // the plan's mix is still the old benchmarkOver, untouched
  const p = pointsPlan(FIVE);
  const d = compute(p, { today: T });
  assert.deepEqual(d.benchmark, benchmarkOver("2021-10-31", "2026-10-31", 0.7));
  // saved: the page compares with it; nothing else of the output moves
  p.investments.benchmark = { stocks: 0.8, bonds: 0.2, bills: 0 };
  const o = compute(p, { today: T });
  assert.deepEqual(o.benchmark, mixOver("2021-10-31", "2026-10-31", { stocks: 0.8, bonds: 0.2, bills: 0 }));
  const { benchmark: b1, ...r1 } = o, { benchmark: b0, ...r0 } = d;
  assert.equal(JSON.stringify(r1), JSON.stringify(r0));
  assert.deepEqual(benchmarkMix(p), { stocks: 0.8, bonds: 0.2, bills: 0, source: "own" });
});

test("your own mix is read only when it makes sense: three shares, none below 0, adding to 100%", () => {
  const p = migrate(emptyPlan());
  for (const [b, want] of [
    [undefined, null], [null, null], ["80/20", null],
    [{ stocks: 0.8, bonds: 0.2 }, { stocks: 0.8, bonds: 0.2, bills: 0 }],
    [{ stocks: 0.5, bonds: 0.3, bills: 0.2 }, { stocks: 0.5, bonds: 0.3, bills: 0.2 }],
    [{ stocks: 0.8, bonds: 0.1 }, null], [{ stocks: 1.2, bonds: -0.2 }, null], [{ stocks: "x", bonds: 1 }, null],
  ]) { p.investments.benchmark = b; assert.deepEqual(ownBenchmark(p), want, JSON.stringify(b)); }
  // 0.6 + 0.3 + 0.1 is 0.9999999999999999 in floating point: kept as typed, not divided into 0.6000000000000001
  p.investments.benchmark = { stocks: 0.6, bonds: 0.3, bills: 0.1 };
  assert.deepEqual(ownBenchmark(p), { stocks: 0.6, bonds: 0.3, bills: 0.1 });
  p.investments.benchmark = { stocks: 0.602, bonds: 0.3, bills: 0.1 };   // 100.2%: within half a point, scaled to 1
  near(Object.values(ownBenchmark(p)).reduce((a, b) => a + b, 0), 1, 1e-12);
  p.investments.benchmark = undefined;
  assert.deepEqual(benchmarkMix(p), { stocks: 0.7, bonds: 0.30000000000000004, bills: 0, source: "plan" });
  assert.deepEqual(COMPARE_PRESETS, [0.4, 0.6, 0.8, 1]);
});

test("Compare with: every sentence, one per case", () => {
  const b = { years: 5, from: 2021, to: 2025, total: 0.68, annual: 0.10972 }, one = { years: 1, from: 2025, to: 2025, total: 0.15, annual: 0.15 };
  const own = { stocks: 0.8, bonds: 0.2, bills: 0, source: "own" }, plan = { stocks: 0.7, bonds: 0.3, bills: 0, source: "plan" };
  assert.equal(W.mixWords(own), "80% stocks and 20% bonds");
  assert.equal(W.mixWords({ stocks: 0.6, bonds: 0.3, bills: 0.1 }), "60% stocks, 30% bonds and 10% cash");
  assert.equal(W.mixWords({ stocks: 1, bonds: 0, bills: 0 }), "all stocks");
  assert.equal(W.mixWords({ stocks: 0, bonds: 0, bills: 1 }), "all cash");
  assert.equal(W.compareStatus(own), "set by you");
  assert.equal(W.compareStatus(plan), "plan's 70% stocks");
  assert.equal(W.compareLine(own, b), "Your own mix, 80% stocks and 20% bonds, made +11.0% a year over 2021-2025.");
  assert.equal(W.compareLine(plan, one), "Your plan's mix, 70% stocks and 30% bonds, made +15.0% a year over 2025.");
  // no figure: why, one sentence per case; the green line after a save says it (no promise of a figure that cannot come)
  assert.equal(LAST_RETURN_YEAR, 2025);
  assert.equal(W.compareLine(own, null, "short"), "No figure yet: that needs your saved balances to cover a whole calendar year, January to December.");
  assert.equal(W.compareLine(own, null, "late"), "No figure: the yearly index returns here end with 2025, and the stretch measured starts after 1/1/2025.");
  assert.equal(W.compareLine(own, null, "picked"), "No figure for the stretch picked, which holds no whole calendar year; since the first saved point there is one.");
  assert.equal(W.compareSaved(own, b), "Saved. You now compare with 80% stocks and 20% bonds, which made +11.0% a year over 2021-2025.");
  assert.equal(W.compareSaved(own, null, "late"), "Saved: you will compare with 80% stocks and 20% bonds. No figure: the yearly index returns here end with 2025, and the stretch measured starts after 1/1/2025.");
  assert.equal(W.compareSaved(plan, null, "short"), "Saved: you will compare with your plan's mix again, 70% stocks and 30% bonds. No figure yet: that needs your saved balances to cover a whole calendar year, January to December.");
  assert.equal(W.compareSaved(plan, b), "Saved. You compare with your plan's mix again: 70% stocks and 30% bonds, which made +11.0% a year over 2021-2025.");
  assert.equal(W.compareBack(plan), "Back to comparing with 70% stocks and 30% bonds, as before.");
  assert.equal(W.mixOff(90), "These add up to 90%. Make them come to 100%.");
  // the hero's clause
  assert.equal(W.heroClause(0.7, plan, null), "");
  assert.equal(W.heroClause(0.7, plan, b), "; a plain 70/30 index mix made +11.0% a year over 2021-2025");
  assert.equal(W.heroClause(0.7, own, b), "; your own mix of 80% stocks and 20% bonds made +11.0% a year over 2021-2025");
});

test("Compare with says why there is no figure: the stretch picked, a stretch that starts after the last year of returns, or one too short yet (critic P1)", () => {
  // the investing household: one year of points from 9/16/2025, after 1 January 2025: no whole year of the returns can fit
  const late = compute(investmentsPlan(), { today: "2026-09-16", parts: true });
  assert.equal(late.benchmark, null); assert.equal(late.compare.why, "late");
  // 2024-03-01 to 2025-06-01: no whole year yet, but 2025 will fit once a point is saved after it ends
  const short = compute(pointsPlan([["2024-03-01", 100], ["2025-06-01", 110]]), { today: "2025-06-10", parts: true });
  assert.equal(short.compare.why, "short");
  // five years of points, the last year picked: none in it, but since the first point there is one
  const picked = compute(pointsPlan(FIVE), { today: T, period: "1y", parts: true });
  assert.equal(picked.benchmark, null); assert.equal(picked.compare.why, "picked");
  assert.equal(compute(pointsPlan(FIVE), { today: T, parts: true }).compare.why, null, "a figure: nothing to explain");
});

// ---------------------------------------------------------------- gain on each holding since you bought it
test("which holdings drove it: gains since bought, best first; the shares add up to 100%, the contributions to the whole return, the gains to the whole gain", async () => {
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs");
  const dr = drivers(migrate(heldPlan()), { today: T });
  assert.deepEqual(dr.rows.map((r) => [r.symbol, r.gain]), [["AGTHX", 12000], ["FFFHX", 10800], ["VTI", 9000], ["FXAIX", 8000], ["BND", -360]]);
  assert.deepEqual(dr.total, { value: 167440, paid: 128000, gain: 39440, ret: 39440 / 128000 });
  near(dr.rows.reduce((s, r) => s + r.share, 0), 1, 1e-12, "shares");
  near(dr.rows.reduce((s, r) => s + r.contribution, 0), dr.total.ret, 1e-12, "contributions");
  near(dr.rows.reduce((s, r) => s + r.gain, 0), dr.total.gain, 1e-9, "gains");
  near(dr.rows[0].ret, 12000 / 30000); near(dr.rows[0].share, 12000 / 39440);
  assert.deepEqual(dr.left, []); assert.equal(dr.between, 0); assert.equal(dr.shown.length, 5);
  // the words
  assert.equal(W.driversIntro(dr, "USD"), "Since each was bought, your holdings are up $39,440 on the $128,000 you paid (+30.8%). Best first, worst last.");
  assert.equal(W.driverSub(dr.rows[0], dr.total, "USD"), "+40.0% on $30,000 paid · 30% of the whole gain");
  assert.equal(W.driverSub(dr.rows[4], dr.total, "USD"), "−4.0% on $9,000 paid · takes 1% off the whole gain");
  assert.equal(W.NOT_THE_PERIOD, "This counts from when each was bought, not the stretch the page measures: the app keeps no record of each holding's value over time.");
  // more than ten: the best five and the worst five, the rest counted in between
  const big = migrate(heldPlan());
  for (let i = 0; i < 8; i++) big.holdings.push({ id: `x${i}`, accountId: "a-brk", symbol: `X${i}`, name: "", shares: 10, price: 100 + i, priceAsOf: T, costBasis: 1000, assetClass: "us_stocks", lots: [] });
  const b = drivers(big, { today: T });
  assert.equal(b.rows.length, 13); assert.equal(b.between, 3);
  assert.deepEqual(b.shown.map((r) => r.symbol), ["AGTHX", "FFFHX", "VTI", "FXAIX", "X7", "X3", "X2", "X1", "X0", "BND"], "X6, X5 and X4 are in between");
  assert.equal(W.betweenWords(3), "3 more in between.");
});

test("which holdings drove it: a loss overall, a holding with no price or no cost left out, and the Tax lots' yearly rate", async () => {
  const p = migrate(emptyPlan());
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 0 });
  p.holdings = [
    { id: "a", accountId: "b", symbol: "AAA", shares: 100, price: 80, priceAsOf: "2026-11-01", costBasis: 10000, assetClass: "us_stocks", lots: [] },
    { id: "c", accountId: "b", symbol: "CCC", shares: 100, price: 105, priceAsOf: "2026-11-01", costBasis: 10000, assetClass: "us_stocks", lots: [] },
    { id: "n", accountId: "b", symbol: "NOPRICE", shares: 10, price: null, costBasis: 500, assetClass: "us_stocks", lots: [] },
    { id: "z", accountId: "b", symbol: "NOCOST", shares: 10, price: 50, priceAsOf: "2026-11-01", costBasis: 0, assetClass: "us_stocks", lots: [] },
    // two lots that cover the shares and their cost: bought over years
    { id: "l", accountId: "b", symbol: "LOT", shares: 30, price: 200, priceAsOf: "2026-11-01", costBasis: 4000, assetClass: "us_stocks", lots: [{ id: "1", date: "2020-11-01", shares: 20, cost: 2000 }, { id: "2", date: "2023-11-01", shares: 10, cost: 2000 }] },
  ];
  const dr = drivers(p, { today: T });
  assert.deepEqual(dr.left, [{ id: "n", symbol: "NOPRICE", why: "price" }, { id: "z", symbol: "NOCOST", why: "cost" }]);
  assert.equal(W.leftWords(dr.left), "Left out: NOPRICE (no price typed in), NOCOST (no cost typed in).");
  const lot = dr.rows.find((r) => r.symbol === "LOT");
  assert.equal(lot.since, "2020-11");
  near(lot.yearly, xirr([{ date: "2020-11-01", amount: -2000 }, { date: "2023-11-01", amount: -2000 }, { date: "2026-11-01", amount: 6000 }]), 1e-12);
  assert.equal(W.sinceWords(lot), `about ${W.pc(lot.yearly)} a year since Nov 2020`);
  // lots that do not cover the shares: no date, no rate
  p.holdings.find((h) => h.id === "l").lots.pop();
  const d2 = drivers(p, { today: T }).rows.find((r) => r.symbol === "LOT");
  assert.equal(d2.since, null); assert.equal(d2.yearly, null); assert.equal(W.sinceWords(d2), "");
  // lots that cover the shares but not their cost: the date, no rate
  p.holdings.find((h) => h.id === "l").lots = [{ id: "1", date: "2020-11-01", shares: 30, cost: 3000 }];
  const d3 = drivers(p, { today: T }).rows.find((r) => r.symbol === "LOT");
  assert.equal(d3.since, "2020-11"); assert.equal(d3.yearly, null);
  assert.equal(W.sinceWords(d3), "since Nov 2020");
  assert.equal(W.driverSub(d3, { gain: 0 }, "USD"), "+50.0% on $4,000 paid, since Nov 2020");
  // a loss overall: the intro and the share words of each case
  p.holdings = p.holdings.filter((h) => ["a", "c"].includes(h.id));
  const loss = drivers(p, { today: T });
  assert.equal(loss.total.gain, -1500);
  assert.equal(W.driversIntro(loss, "USD"), "Since each was bought, your holdings are down $1,500 on the $20,000 you paid (−7.5%). Best first, worst last.");
  assert.equal(W.shareWords(loss.rows[0], loss.total), "makes the whole loss 33% smaller");
  assert.equal(W.shareWords(loss.rows[1], loss.total), "133% of the whole loss");
  assert.equal(W.shareWords({ gain: 0, share: null }, { gain: 0 }), "");
  // nothing countable
  assert.equal(W.driversIntro({ rows: [], left: [], total: { gain: 0 } }, "USD"), "Type what you paid for each holding on Holdings, and this shows which gained and which lost since you bought them.");
});

test("a stray entry in a holding's purchases never breaks the page, and a purchase dated after the price gives no date (critic M1, M4)", async () => {
  const p = migrate(emptyPlan());
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 0, history: [{ date: "2025-11-01", balance: 900 }, { date: "2026-11-01", balance: 1000 }] });
  p.holdings = [{ id: "v", accountId: "b", symbol: "VTI", shares: 10, price: 100, priceAsOf: "2026-11-01", costBasis: 800, assetClass: "us_stocks", lots: [null, "x", 7, [], { id: "1", date: "2020-11-01", shares: 10, cost: 800 }] }];
  const d = compute(p, { today: T, parts: true });
  assert.equal(d.drivers.rows.length, 1, "the page draws");
  assert.equal(d.drivers.rows[0].since, "2020-11", "only records count, as on Tax lots");
  const { _test } = await import("./view.js"); _test.reset();
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(new URL("./view.js", import.meta.url).href, p, T);
  assert.match(r.text(), /Gain on each holding since you bought it/);
  // a purchase dated 2030 (after the price date): no "since", no yearly rate
  p.holdings[0].lots = [{ id: "1", date: "2030-01-01", shares: 10, cost: 800 }];
  const f = drivers(p, { today: T }).rows[0];
  assert.equal(f.since, null); assert.equal(f.yearly, null); assert.equal(W.sinceWords(f), "");
});

/** The page as the shell runs it: a store that keeps each update, and the redraw after it (the shell's comes 50 ms later, after the tap's own code). */
async function harness(plan, today = T) {
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const revealed = [];
  const ui = { ...(await import("../../../core/ui/dom.js")), reveal: (el, o) => { revealed.push([el, o]); return false; } };
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  let p = migrate(structuredClone(plan)), root = null;
  const saved = [];
  const ctx = { ui, fmt: { ...fmt, today: () => today }, get plan() { return p; }, route: { group: "investments", id: "performance", rest: [], query: {} }, module: { group: "investments", id: "performance" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); p = d; saved.push(d); } }, redraw: () => draw() };
  const draw = () => { root = new FakeElement("main"); render(root, ctx); return root; };
  draw();
  const partOf = (id) => root.querySelectorAll("details").find((x) => x.dataset.part === id);
  return { get root() { return root; }, get plan() { return p; }, saved, draw, partOf, revealed, chip: (id, label) => partOf(id).querySelectorAll(".chip").find((x) => x.textContent === label) };
}

test("the page: Gain on each holding since you bought it also before any saved point; Compare with saves only investments.benchmark, says the new answer, and Undo takes it back", async () => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs");
  const view = new URL("./view.js", import.meta.url).href;
  const { _test } = await import("./view.js"); _test.reset();
  // no saved points: the hero says what to do, one quiet row has the holdings' gains
  const r0 = await renderPage(view, heldPlan(), T);
  const parts0 = r0.root.querySelectorAll("details").map((x) => [x.dataset.part, x.querySelector(".fold-status")?.textContent, x.hasAttribute("open")]);
  assert.deepEqual(parts0, [["drivers", "5 holdings", false]]);
  assert.ok(!/stretch the page measures/.test(r0.text()), "no period to set it apart from");
  // Compare with: a chip saves the mix at once
  const h = await harness(pointsPlan(FIVE));
  const before = JSON.stringify(h.plan);
  const chips = h.partOf("compare").querySelectorAll(".chip").map((x) => [x.textContent, x.getAttribute("aria-pressed")]);
  assert.deepEqual(chips, [["Your plan's mix: 70% stocks", "true"], ["40% stocks", "false"], ["60% stocks", "false"], ["80% stocks", "false"], ["All stocks", "false"], ["Type my own", "false"]]);
  assert.match(textOf(h.partOf("compare")), /Your plan's mix, 70% stocks and 30% bonds, made \+\d+\.\d% a year over 2022-2025\./);
  h.chip("compare", "80% stocks").click();
  assert.equal(h.saved.length, 1);
  assert.deepEqual(h.plan.investments.benchmark, { stocks: 0.8, bonds: 0.2, bills: 0 }, "whole percents, not 1 - 0.8 = 0.19999999999999996");
  const { benchmark, ...rest } = h.plan.investments, { benchmark: none, ...was } = JSON.parse(before).investments;
  assert.deepEqual(rest, was, "nothing else in the plan");
  assert.equal(JSON.stringify({ ...h.plan, investments: null, meta: null }), JSON.stringify({ ...JSON.parse(before), investments: null, meta: null }));
  // the shell's redraw: the row open, the green line naming the new answer, with Undo; only that row opened (R17)
  h.draw();
  assert.deepEqual(h.root.querySelectorAll("details").map((x) => [x.dataset.part, x.hasAttribute("open")]), [["period", false], ["compare", true], ["how", false]], "no holdings: no gain on each holding");
  const ok = h.partOf("compare").querySelector(".notice.ok");
  const want = W.compareSaved(benchmarkMix(h.plan), compute(h.plan, { today: T }).benchmark);
  assert.match(want, /^Saved\. You now compare with 80% stocks and 20% bonds, which made \+\d+\.\d% a year over 2022-2025\.$/);
  assert.ok(textOf(ok).startsWith(want), textOf(ok));
  assert.equal(h.partOf("compare").querySelector(".fold-status").textContent, "set by you");
  assert.match(h.root.querySelector(".lede").textContent, /your own mix of 80% stocks and 20% bonds made \+\d+\.\d% a year over 2022-2025\.$/);
  assert.deepEqual(h.partOf("compare").querySelectorAll(".chip").filter((x) => x.getAttribute("aria-pressed") === "true").map((x) => x.textContent), ["80% stocks"]);
  // Undo: the one change taken back, and the next draw says so in the open row
  ok.querySelectorAll("button").find((x) => x.textContent === "Undo").click();
  assert.equal(h.saved.length, 2);
  assert.equal(h.plan.investments.benchmark, undefined, "the mix is gone again");
  h.draw();
  assert.equal(h.partOf("compare").hasAttribute("open"), true);
  assert.equal(textOf(h.partOf("compare").querySelector(".notice.ok")), "Back to comparing with 70% stocks and 30% bonds, as before.");
  assert.match(h.root.querySelector(".lede").textContent, /a plain 70\/30 index mix made/);
  // Type my own: three boxes that must come to 100
  h.chip("compare", "Type my own").click();
  const form = h.partOf("compare").querySelector("form");
  assert.deepEqual(form.querySelectorAll("input").map((x) => x.getAttribute("name")), ["stocks", "bonds", "bills"]);
  const box = (n) => form.querySelectorAll("input").find((x) => x.getAttribute("name") === n);
  box("stocks").value = "50"; box("bonds").value = "30"; box("bills").value = "10";
  form.dispatch("submit");
  assert.equal(h.saved.length, 2, "90 is held back");
  box("bills").value = "20";
  form.dispatch("submit");
  assert.deepEqual(h.plan.investments.benchmark, { stocks: 0.5, bonds: 0.3, bills: 0.2 });
  h.draw();
  assert.deepEqual(h.partOf("compare").querySelectorAll(".chip").filter((x) => x.getAttribute("aria-pressed") === "true").map((x) => x.textContent), ["Yours: 50% stocks, 30% bonds and 20% cash"]);
  // back to the plan's mix: the plan's chip removes the field, said in green
  h.chip("compare", "Your plan's mix: 70% stocks").click();
  assert.equal(h.plan.investments.benchmark, undefined);
  h.draw();
  assert.match(textOf(h.partOf("compare").querySelector(".notice.ok")), /^Saved\. You compare with your plan's mix again: 70% stocks and 30% bonds, which made/);
  _test.reset();
});

test("the page: My own dates shows two boxes; a date after the other is refused plainly; a stretch with one point opens its row with the red line", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { _test } = await import("./view.js"); _test.reset();
  const h = await harness(pointsPlan(FIVE));
  assert.equal(h.partOf("period").querySelector("form"), null, "no box until My own dates");
  h.chip("period", "My own dates").click();
  const form = h.partOf("period").querySelector("form");
  const box = (n) => form.querySelectorAll("input").find((x) => x.getAttribute("name") === n);
  assert.deepEqual([box("from").value, box("to").value], ["2021-10-31", "2026-10-31"], "the first and last saved points to start from");
  box("from").value = "2024-01-01"; box("to").value = "2023-01-01";
  form.dispatch("submit");
  assert.equal(_test.period, null, "held back");
  box("from").value = "2022-01-01"; box("to").value = "2024-06-30";
  form.dispatch("submit");
  assert.deepEqual(_test.period, { from: "2022-01-01", to: "2024-06-30" });
  assert.equal(h.saved.length, 0, "nothing saved");
  assert.equal(h.partOf("period").hasAttribute("open"), true);
  assert.equal(h.partOf("period").querySelector(".fold-status").textContent, "your own dates");
  assert.match(textOf(h.partOf("period")), /You asked for 1\/1\/2022 to 6\/30\/2024; the nearest saved points are 10\/31\/2021 and 4\/30\/2024, so those are measured\./);
  assert.match(h.root.querySelector(".lede").textContent, /^From 10\/31\/2021 to 4\/30\/2024: \$100,000 grew to \$121,000/);
  // a stretch with one saved point: the red line, the row open (it holds something to fix) on every draw
  form.querySelectorAll("input").find((x) => x.getAttribute("name") === "from").value = "2026-01-01";
  h.partOf("period").querySelector("form").querySelectorAll("input").find((x) => x.getAttribute("name") === "from").value = "2026-01-01";
  h.partOf("period").querySelector("form").querySelectorAll("input").find((x) => x.getAttribute("name") === "to").value = "2026-01-15";
  h.partOf("period").querySelector("form").dispatch("submit");
  h.draw();
  assert.equal(h.partOf("period").hasAttribute("open"), true, "fix > 0 opens it");
  assert.equal(h.partOf("period").querySelector(".fold-status").textContent, "1 to fix");
  assert.equal(textOf(h.partOf("period").querySelector(".notice.error")), W.FELL_BACK);
  assert.match(h.root.querySelector(".lede").textContent, /^From 10\/31\/2021 to 10\/31\/2026:/, "every point instead");
  // Since the first saved point: as the page always was
  h.chip("period", "Since the first saved point").click();
  assert.equal(_test.period, null);
  _test.reset();
});

test("the page, after the critics: a saved mix with no figure says why once; the line after Undo is brought into view; a saved third opens as 33.3; dates that take in every point are every point; no cost, no row (P1, P5, M4, P6)", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { _test } = await import("./view.js"); _test.reset();
  // P1: one year of points from 9/16/2025: All stocks is saved, the green line says there is no figure and why, once
  const h = await harness(investmentsPlan(), "2026-09-16");
  h.chip("compare", "All stocks").click();
  h.draw();
  const part = textOf(h.partOf("compare"));
  assert.match(part, /Saved: you will compare with all stocks\. No figure: the yearly index returns here end with 2025, and the stretch measured starts after 1\/1\/2025\./);
  assert.equal(part.split("No figure").length - 1, 1, "said once, not again under the chips");
  assert.ok(!/You now compare with/.test(part), "no line that reads as a result");
  // P5: the line after Undo is brought wholly into view (so the shell does not say it again at the bottom)
  h.partOf("compare").querySelector(".notice.ok").querySelectorAll("button").find((x) => x.textContent === "Undo").click();
  h.draw();
  const back = h.partOf("compare").querySelector(".notice.ok");
  assert.equal(textOf(back), "Back to comparing with 70% stocks and 30% bonds, as before.");
  assert.ok(h.revealed.some(([el, o]) => el === back && o.block === "nearest"), "revealed");
  _test.reset();
  // M4: a third each, saved from a file: the boxes open at 33.3 and save again untouched
  const t = pointsPlan(FIVE); t.investments.benchmark = { stocks: 1 / 3, bonds: 1 / 3, bills: 1 / 3 };
  const h2 = await harness(t);
  h2.chip("compare", "Type my own").click();
  const form = h2.partOf("compare").querySelector("form");
  assert.deepEqual(form.querySelectorAll("input").map((x) => x.value), ["33.3", "33.3", "33.3"]);
  form.dispatch("submit");
  assert.equal(h2.saved.length, 1, "99.9 is 100 within half a point: taken");
  _test.reset();
  // P6: the two dates the boxes start with take in every saved point: that is "every saved point", not "your own dates"
  const h3 = await harness(pointsPlan(FIVE));
  h3.chip("period", "My own dates").click();
  h3.partOf("period").querySelector("form").dispatch("submit");
  assert.equal(_test.period, null);
  assert.equal(h3.partOf("period").querySelector(".fold-status").textContent, "every saved point");
  assert.equal(h3.partOf("period").hasAttribute("open"), true, "its row stays open");
  _test.reset();
  // P6: a holding with no cost typed in: no row with only a hint in it
  const nearly = migrate(emptyPlan());
  nearly.accounts.push({ id: "b", name: "My brokerage", type: "brokerage", balance: 2500, history: [] });
  nearly.holdings.push({ id: "v", accountId: "b", symbol: "VTI", shares: 10, price: 250, priceAsOf: "2026-11-01", costBasis: null, assetClass: "", lots: [] });
  const h4 = await harness(nearly);
  assert.deepEqual(h4.root.querySelectorAll("details").map((x) => x.dataset.part), [], "no quiet row on the not-ready page without a cost");
  _test.reset();
});

// ---------------------------------------------------------------- invariance: nothing new asked or typed, nothing moves
const KEYS_81A5288 = ["ready", "accounts", "overall", "expected", "benchmark", "stockShare", "notes", "pointsNeeded", "hasAccounts"];
async function everyPlan() {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const withPoints = heldPlan();
  for (const [id, pts] of [["a-401", [["2023-06-30", 52000], ["2024-06-30", 64000], ["2025-06-30", 74000], ["2026-10-31", 85800]]], ["a-brk", [["2024-01-02", 9100], ["2026-10-31", 8640]]]]) withPoints.accounts.find((a) => a.id === id).history = pts.map(([date, balance]) => ({ date, balance }));
  return [investmentsPlan(), familyPlan(T), renterDebtPlan(), retiredCouplePlan(T), emptyPlan(), heldPlan(), withPoints, pointsPlan(FIVE), ...ARCHETYPES.map((a) => a.build())].map((p) => migrate(structuredClone(p)));
}
test("invariance: with no period, no parts and no own mix, the output has 81a5288's keys and every byte of the page as it was; asking for the parts adds three keys and moves nothing else", async () => {
  let ready = 0;
  for (const p of await everyPlan()) for (const today of [T, "2026-09-16"]) {
    const a = compute(p, { today });
    assert.deepEqual(Object.keys(a), KEYS_81A5288);
    const b = compute(p, { today, parts: true });
    assert.deepEqual(Object.keys(b), [...KEYS_81A5288, "period", "drivers", "compare"]);
    const { period, drivers: dr, compare, ...rest } = b;
    assert.equal(JSON.stringify(rest), JSON.stringify(a));
    const { period: p2, drivers: d2, compare: c2, ...all } = compute(p, { today, period: "all", parts: true });
    assert.equal(JSON.stringify(all), JSON.stringify(a), "the chip Since the first saved point is the page as it was");
    assert.equal(period.key, "all"); assert.equal(compare.mix.source, "plan");
    if (a.ready) ready++;
  }
  assert.ok(ready >= 6, `plans with saved points: ${ready / 2}`);
});
