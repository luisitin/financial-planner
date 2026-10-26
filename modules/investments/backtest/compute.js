// modules/investments/backtest/compute.js -- PURE. Any stocks/bonds/cash mix run through the
// years since 1871 (Shiller to 1927, Damodaran from 1928): growth of 10,000, the yearly rate,
// the worst year, the deepest fall and how long it took to recover, the best and worst
// ten-year stretches, against a second mix for comparison. Rebalanced once a year.
import { EARLY } from "./data/shiller.js";
import { RETURNS } from "../../retirement/historical/data/returns.js";
import { mixReturns, growth, maxDrawdown, seriesStats, cagr } from "../../../core/math/returns.js";
import { targetMix } from "../allocation/compute.js";
import { compute as computeHoldings, ASSET_CLASSES } from "../holdings/compute.js";

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

/**
 * compute(plan, { today, mixA, mixB, from, real }) -> { a: runMix, b: runMix, mixA: { stocks, bonds, bills, label }, mixB, from, real, firstYear, lastYear, presets, startYears, notes }
 * mixA defaults to the plan's target (Allocation), mixB to 60/40; either may be a preset key or { stocks, bonds, bills }.
 */
export function compute(plan, params = {}) {
  const t = targetMix(plan).mix;
  const own = { ...toHistoryWeights(t), label: "Your target mix" };
  const h = computeHoldings(plan, params);
  const held = h.hasData && h.classifiedShare > 0 ? { ...toHistoryWeights(Object.fromEntries(h.byClass.filter((c) => c.cls !== "unknown").map((c) => [c.cls, c.share]))), label: "What you hold" } : null;
  const pick = (m, fallback) => { if (!m) return fallback; if (typeof m === "string") { if (m === "own") return own; if (m === "held" && held) return held; const p = PRESETS.find((x) => x.key === m); return p ? { stocks: p.stocks, bonds: p.bonds, bills: p.bills, label: p.label } : fallback; } return { stocks: Number(m.stocks) || 0, bonds: Number(m.bonds) || 0, bills: Number(m.bills) || 0, label: m.label ?? "Custom" }; };
  const mixA = pick(params.mixA, own), mixB = pick(params.mixB, { stocks: 0.6, bonds: 0.4, bills: 0, label: "60 / 40" });
  const from = START_YEARS.includes(Number(params.from)) ? Number(params.from) : 1928;
  const real = params.real === true;
  const a = runMix(mixA, { from, real }), b = runMix(mixB, { from, real });
  const notes = [];
  if (from < 1928) notes.push("Before 1928 the figures come from Shiller's S&P and long-bond series; cash is the January long-bond yield standing in for short rates, so treat the cash part of those years as approximate.");
  notes.push("Stocks are the S&P 500 (large US companies); international stocks, REITs and gold in your mix are run as US stocks here, for want of a history as long. One rebalance a year, no fees, no taxes.");
  return { a, b, mixA, mixB, own, held, from, real, firstYear: HISTORY[0].year, lastYear: HISTORY[HISTORY.length - 1].year, presets: PRESETS, startYears: START_YEARS, notes };
}
