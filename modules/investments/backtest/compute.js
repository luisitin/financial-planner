// modules/investments/backtest/compute.js -- PURE. Any stocks/bonds/cash mix run through the
// years since 1871 (Shiller to 1927, Damodaran from 1928): growth of 10,000, the yearly rate,
// the worst year, the deepest fall and how long it took to recover, the best and worst
// ten-year stretches, against a second mix for comparison. Rebalanced once a year.
import { EARLY } from "./data/shiller.js";
import { RETURNS } from "../../retirement/historical/data/returns.js";
import { mixReturns, growth, maxDrawdown, seriesStats, cagr } from "../../../core/math/returns.js";
import { targetMix } from "../allocation/compute.js";
import { compute as computeHoldings, ASSET_CLASSES } from "../holdings/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { buildInputs } from "../../retirement/projection/compute.js";

/** Every year with returns, 1871 to the last Damodaran year. */
export const HISTORY = [...EARLY, ...RETURNS];
export const PRESETS = [
  { key: "100-0", label: "All stocks", stocks: 1, bonds: 0, bills: 0 },
  { key: "80-20", label: "80 / 20", stocks: 0.8, bonds: 0.2, bills: 0 },
  { key: "60-40", label: "60 / 40", stocks: 0.6, bonds: 0.4, bills: 0 },
  { key: "40-60", label: "40 / 60", stocks: 0.4, bonds: 0.6, bills: 0 },
  { key: "20-80", label: "20 / 80", stocks: 0.2, bonds: 0.8, bills: 0 },
  { key: "0-100", label: "All bonds", stocks: 0, bonds: 1, bills: 0 },
];
export const START_YEARS = [1871, 1928, 1950, 1970, 1990, 2000, 2010];

/** A six-class mix (Allocation's) collapsed to what history knows: stocks (US, international, REITs, other), bonds, bills (cash). */
export function toHistoryWeights(mix) {
  let stocks = 0, bonds = 0, bills = 0;
  for (const [cls, w] of Object.entries(mix ?? {})) { const k = ASSET_CLASSES[cls]?.kind; if (k === "bonds") bonds += w; else if (k === "cash") bills += w; else stocks += w; }
  const sum = stocks + bonds + bills || 1;
  return { stocks: stocks / sum, bonds: bonds / sum, bills: bills / sum };
}

/** Run one mix from `from` to `to` (inclusive, real or nominal): the series, the statistics, the fall, the ten-year stretches. */
export function runMix(weights, { from = 1871, to = Infinity, start = 10000, real = false } = {}) {
  const years = HISTORY.filter((y) => y.year >= from && y.year <= to);
  if (!years.length) return null;
  const nominal = mixReturns(years, weights);
  const returns = real ? nominal.map((r, i) => (1 + r) / (1 + years[i].inflation) - 1) : nominal;
  const values = growth(returns, start);
  const stats = seriesStats(returns);
  const dd = maxDrawdown(values);
  const n = years.length;
  const end = values[n];
  const tens = [];
  for (let i = 0; i + 10 <= n; i++) tens.push({ from: years[i].year, to: years[i + 9].year, rate: Math.pow(values[i + 10] / values[i], 0.1) - 1 });
  const bestTen = tens.length ? tens.reduce((a, x) => x.rate > a.rate ? x : a) : null, worstTen = tens.length ? tens.reduce((a, x) => x.rate < a.rate ? x : a) : null;
  const worstYear = years[returns.indexOf(stats.worst)]?.year ?? null, bestYear = years[returns.indexOf(stats.best)]?.year ?? null;
  return {
    weights, from: years[0].year, to: years[n - 1].year, years: n, values, labels: [years[0].year - 1, ...years.map((y) => y.year)], end, cagr: cagr(start, end, n), stats, worstYear, bestYear,
    drawdown: { depth: dd.depth, peakYear: dd.peakIndex > 0 ? years[dd.peakIndex - 1].year : years[0].year - 1, troughYear: dd.troughIndex > 0 ? years[dd.troughIndex - 1].year : null, recoveryYear: dd.recoveryIndex !== null && dd.recoveryIndex > 0 ? years[dd.recoveryIndex - 1].year : null },
    bestTen, worstTen, lossShare: stats.lossShare, real,
  };
}

// ---------------------------------------------------------------- money in or out each year (gap list, next 60, item 52)
/** The stretch lengths offered, in years, and the one shown first (a working life's saving or a retirement's spending). */
export const FLOW_YEARS = [10, 20, 30];
export const FLOW_YEARS_FIRST = 30;

/** The median of a list of numbers: the middle one, or the mean of the two middle ones when the count is even. */
export function median(xs) {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  if (!n) return null;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/**
 * withFlows(weights, { from, to, start, yearly, dir, years, history }) -> the mix run over every stretch of `years`
 * consecutive years in history from `from`, with `yearly` (today's dollars) put in ("in") or taken out ("out") at the
 * start of each year and raised with that year's prices. Worked in today's dollars: a year's return is the mix's
 * return over that year's inflation, (1 + R) / (1 + i) - 1, so the amount stays the same figure every year.
 *   in:  V <- (V + F) (1 + r)
 *   out: V >= F: V <- (V - F) (1 + r); else the money ran out that year (paid in full for `lasted` years), V = 0 after.
 * Returns { dir, yearly, start, years, from, last, history (years of history from `from`), n, starts: [{ start (year),
 * end (today's dollars), ranOut (year or null), lasted (years paid in full) }], ranOut (count), worst, middle (the
 * median end), best, minLasted, maxLasted (over the starts that ran out; null when none did) }. n = 0 when the history
 * from `from` is shorter than `years`. Worst: when some ran out, the one that ran out soonest (then the lower end);
 * otherwise the lowest end. Best: the highest end. A way other than "in" or "out" is no run at all (null); an amount
 * or a start that is not a finite number counts as 0 (critic M3: "sideways" ran as money in, 1e308 a year as Infinity).
 */
export function withFlows(weights, { from = 1928, to = Infinity, start = 0, yearly = 0, dir = "in", years = FLOW_YEARS_FIRST, history = HISTORY } = {}) {
  if (dir !== "in" && dir !== "out") return null;
  const rows = history.filter((y) => y.year >= from && y.year <= to);
  const real = mixReturns(rows, weights).map((r, i) => (1 + r) / (1 + rows[i].inflation) - 1);
  const amount = (x) => { const v = Number(x); return Number.isFinite(v) && v > 0 ? v : 0; };
  const F = amount(yearly), S = amount(start), k = Math.max(1, Math.round(Number(years) || FLOW_YEARS_FIRST));
  const out = dir === "out";
  const starts = [];
  for (let s = 0; s + k <= rows.length; s++) {
    let v = S, ranOut = null, lasted = k;
    for (let t = 0; t < k; t++) {
      if (out) {
        if (v < F) { ranOut = rows[s + t].year; lasted = t; v = 0; break; }
        v = (v - F) * (1 + real[s + t]);
      } else v = (v + F) * (1 + real[s + t]);
    }
    starts.push({ start: rows[s].year, end: v, ranOut, lasted });
  }
  const n = starts.length, gone = starts.filter((x) => x.ranOut !== null);
  const low = (a, b) => (a.end < b.end ? a : b);
  const worst = !n ? null : gone.length ? gone.reduce((a, b) => (b.lasted < a.lasted || (b.lasted === a.lasted && b.end < a.end) ? b : a)) : starts.reduce(low);
  const best = n ? starts.reduce((a, b) => (b.end > a.end ? b : a)) : null;
  return {
    dir: out ? "out" : "in", yearly: F, start: S, years: k, from: rows[0]?.year ?? from, last: rows[rows.length - 1]?.year ?? null, history: rows.length,
    n, starts, ranOut: gone.length, worst, middle: median(starts.map((x) => x.end)), best,
    minLasted: gone.length ? Math.min(...gone.map((x) => x.lasted)) : null, maxLasted: gone.length ? Math.max(...gone.map((x) => x.lasted)) : null,
  };
}

/** What the plan holds and plans, for the chips of "Add or take out money each year": { saving (a year into retirement
 * and investment accounts, the employer's match too; the Contributions page's total), spending (a year in retirement,
 * today's dollars, the figure Will the money last? spends before its health line), healthOnTop (true when Will the
 * money last? adds a health line on top of that spending: the figure here leaves it out, and the row says so; critic M1),
 * invested (the Risk page's rule: the holdings' value, else the investment accounts' balances) }; null where the plan
 * has none. */
export function flowChoices(plan, params = {}) {
  const today = params.today ?? null;
  const saving = computeContributions(plan, { today }).totalYearly;
  const b = buildInputs(plan, { today });
  const spending = b.inputs && b.spendingYearly > 0 ? b.spendingYearly : Number(b.figureMonthly) > 0 ? Number(b.figureMonthly) * 12 : null;
  const healthOnTop = !!b.inputs && b.health?.included === false && Number(b.health?.total) > 0;
  const h = computeHoldings(plan, params);
  const invested = h.total > 0 ? h.total : (plan.accounts ?? []).filter((a) => INVESTED_TYPES.includes(a.type)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  return { saving: saving > 0 ? saving : null, spending: spending > 0 ? spending : null, healthOnTop: spending > 0 && healthOnTop, invested: invested > 0 ? invested : null };
}
/** The account types the Risk page counts as invested money when there are no holdings. */
export const INVESTED_TYPES = ["brokerage", "401k", "ira", "roth", "hsa", "529", "crypto"];

/**
 * compute(plan, { today, mixA, mixB, from, real, flow }) -> { a: runMix, b: runMix, mixA: { stocks, bonds, bills, label }, mixB, from, real, firstYear, lastYear, presets, startYears, notes, flow? }
 * mixA defaults to the target chosen on Allocation, else to what is held (defaultA says which), mixB to 60/40; either may be a preset key or { stocks, bonds, bills }.
 * flow ({ dir: "in" | "out", yearly, start, years }, optional): adds `flow: { a, b }`, both mixes run by withFlows from
 * `from`; without it, or with another way, the output is what it was before (no key added).
 */
export function compute(plan, params = {}) {
  const { mix: t, source } = targetMix(plan);
  // "own" is the target chosen on Allocation; with none chosen it is the Projection's stock share, and says so
  const own = { ...toHistoryWeights(t), label: source === "own" ? "Your target mix" : "Your plan's mix" };
  const h = computeHoldings(plan, params);
  const held = h.hasData && h.classifiedShare > 0 ? { ...toHistoryWeights(Object.fromEntries(h.byClass.filter((c) => c.cls !== "unknown").map((c) => [c.cls, c.share]))), label: "What you hold" } : null;
  const pick = (m, fallback) => { if (!m) return fallback; if (typeof m === "string") { if (m === "own") return own; if (m === "held" && held) return held; const p = PRESETS.find((x) => x.key === m); return p ? { stocks: p.stocks, bonds: p.bonds, bills: p.bills, label: p.label } : fallback; } return { stocks: Number(m.stocks) || 0, bonds: Number(m.bonds) || 0, bills: Number(m.bills) || 0, label: m.label ?? "Custom" }; };
  // the first mix: your target when you chose one, else what you hold (a default nobody chose is not the headline)
  const defaultA = source === "own" || !held ? "own" : "held";
  const mixA = pick(params.mixA, defaultA === "own" ? own : held), mixB = pick(params.mixB, { stocks: 0.6, bonds: 0.4, bills: 0, label: "60 / 40" });
  const from = START_YEARS.includes(Number(params.from)) ? Number(params.from) : 1928;
  const real = params.real === true;
  const a = runMix(mixA, { from, real }), b = runMix(mixB, { from, real });
  const notes = [];
  if (from < 1928) notes.push("Before 1928 the figures come from Shiller's S&P and long-bond series; cash is the January long-bond yield standing in for short rates, so treat the cash part of those years as approximate.");
  notes.push("Stocks are the S&P 500 (large US companies); international stocks, real estate funds (REITs) and gold in your mix are treated as US stocks here, because their records do not go back as far. One rebalance a year, no fees, no taxes.");
  const out = { a, b, mixA, mixB, own, held, ownSource: source, defaultA, from, real, firstYear: HISTORY[0].year, lastYear: HISTORY[HISTORY.length - 1].year, presets: PRESETS, startYears: START_YEARS, notes };
  const f = params.flow;
  if (f && typeof f === "object" && (f.dir === "in" || f.dir === "out")) {
    const ask = { from, start: f.start, yearly: f.yearly, dir: f.dir, years: FLOW_YEARS.includes(Number(f.years)) ? Number(f.years) : FLOW_YEARS_FIRST };
    out.flow = { a: withFlows(mixA, ask), b: withFlows(mixB, ask) };
  }
  return out;
}
