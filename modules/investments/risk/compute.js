// modules/investments/risk/compute.js -- PURE. How rough the ride of your mix is: the ups and
// downs, the worst year and the deepest fall history has dealt a mix like yours since 1871, the
// odds of a losing year, and what those look like in your own dollars, next to the plan's
// own volatility assumption.
import { runMix, toHistoryWeights, HISTORY, median } from "../backtest/compute.js";
import { mixReturns } from "../../../core/math/returns.js";
import { targetMix } from "../allocation/compute.js";
import { compute as computeHoldings } from "../holdings/compute.js";

/** The mix's statistics over the full history, scaled to `amount` of your money. */
export function riskOf(weights, amount, label) {
  const r = runMix(weights, { from: 1871 });
  const recent = runMix(weights, { from: 1970 });
  return {
    label, weights, stdev: r.stats.stdev, mean: r.stats.geometric, worstYear: r.stats.worst, worstYearWhen: r.worstYear, drawdown: r.drawdown, lossShare: r.stats.lossShare,
    worstYearDollars: amount * r.stats.worst, drawdownDollars: amount * r.drawdown.depth, badYear: -amount * r.stats.stdev, recentStdev: recent.stats.stdev, recentWorst: recent.stats.worst, recentWorstWhen: recent.worstYear,
  };
}


// ---------------------------------------------------------------- ups and downs over longer stretches (gap list, next 60, item 52)
/** The stretches offered, in years, and the one shown first. */
export const STRETCHES = [1, 5, 10];
export const STRETCH_FIRST = 10;
/** The first year with a true 3-month Treasury bill record (Damodaran); before it the bundled "bills" is the January
 *  10-year yield standing in for short rates, so the Sharpe ratio and the "cash" pairs start here. */
export const BILLS_FROM = 1928;
/** The recent years the stocks-and-bonds link is read over a second time (it changed sign around the turn of the century). */
export const RECENT_FROM = 2000;

/**
 * rolling(weights, { years, from, history }) -> every stretch of `years` consecutive years from `from`: the compound
 * yearly rate g = (prod (1 + R_t))^(1/years) - 1 of the mix (rebalanced each year), before inflation, and the same after
 * it (r_t = (1 + R_t) / (1 + i_t) - 1). { years, n, from, to, worst: { rate, from, to }, middle (the median rate),
 * best: { rate, from, to }, lost (stretches with g < 0), lostShare, lostReal (after inflation), lostRealShare }.
 */
export function rolling(weights, { years = STRETCH_FIRST, from = 1871, history = HISTORY } = {}) {
  const rows = history.filter((y) => y.year >= from);
  const R = mixReturns(rows, weights), r = R.map((x, i) => (1 + x) / (1 + rows[i].inflation) - 1);
  const k = Math.max(1, Math.round(Number(years) || STRETCH_FIRST));
  const rate = (xs, i) => { let p = 1; for (let t = i; t < i + k; t++) p *= 1 + xs[t]; return Math.pow(p, 1 / k) - 1; };
  const all = [];
  for (let i = 0; i + k <= rows.length; i++) all.push({ rate: rate(R, i), real: rate(r, i), from: rows[i].year, to: rows[i + k - 1].year });
  const n = all.length;
  if (!n) return { years: k, n: 0, from: rows[0]?.year ?? from, to: rows.at(-1)?.year ?? null, worst: null, middle: null, best: null, lost: 0, lostShare: 0, lostReal: 0, lostRealShare: 0 };
  const pick = (better) => all.reduce((a, b) => (better(b.rate, a.rate) ? b : a));
  const w = pick((x, y) => x < y), b = pick((x, y) => x > y);
  const lost = all.filter((x) => x.rate < 0).length, lostReal = all.filter((x) => x.real < 0).length;
  return { years: k, n, from: rows[0].year, to: rows.at(-1).year, worst: { rate: w.rate, from: w.from, to: w.to }, middle: median(all.map((x) => x.rate)), best: { rate: b.rate, from: b.from, to: b.to },
    lost, lostShare: lost / n, lostReal, lostRealShare: lostReal / n };
}

/** The sample mean and standard deviation (n - 1) of a list. */
const meanSd = (xs) => { const n = xs.length, m = xs.reduce((s, x) => s + x, 0) / n; return { m, sd: n > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0 }; };
/**
 * sharpe(weights, { from, history }) -> the Sharpe ratio, ex post (W. F. Sharpe, "The Sharpe Ratio", Journal of
 * Portfolio Management, Fall 1994): each year's return of the mix less the 3-month Treasury bill's, D_t = R_t - c_t;
 * S = mean(D) / stdev(D) (sample, n - 1). { ratio (null when D never varies: all cash), excess (mean D), spread
 * (stdev D), from, to, n }.
 */
export function sharpe(weights, { from = BILLS_FROM, history = HISTORY } = {}) {
  const rows = history.filter((y) => y.year >= from);
  const D = mixReturns(rows, weights).map((x, i) => x - (rows[i].bills ?? 0));
  const { m, sd } = meanSd(D);
  return { ratio: sd > 1e-12 ? m / sd : null, excess: m, spread: sd, from: rows[0]?.year ?? from, to: rows.at(-1)?.year ?? null, n: rows.length };
}

/** correlation(xs, ys) -> Pearson's r of two lists of the same length: sum((x - mx)(y - my)) / sqrt(sum((x - mx)^2) sum((y - my)^2)); null when either never varies. */
export function correlation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.slice(0, n).reduce((s, x) => s + x, 0) / n, my = ys.slice(0, n).reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
/** The builder's plain words for a correlation, with the cut-offs at 0.2, 0.5 and 0.8 either way (README). */
export function togetherWords(r) {
  if (r === null || !Number.isFinite(r)) return "cannot be told apart";
  if (r >= 0.8) return "move closely together";
  if (r >= 0.5) return "often move together";
  if (r >= 0.2) return "move a little together";
  if (r > -0.2) return "barely move together";
  if (r > -0.5) return "move a little in opposite directions";
  if (r > -0.8) return "often move in opposite directions";
  return "move closely in opposite directions";
}
/** The three pairs of stocks, bonds and cash (3-month bills), read over `from` to the last year and again from `recent`:
 *  [{ a, b, r, recentR, words, recentWords, from, recent }]. */
export function together({ from = BILLS_FROM, recent = RECENT_FROM, history = HISTORY } = {}) {
  const over = (start) => history.filter((y) => y.year >= start);
  const all = over(from), late = over(recent);
  const col = (rows, k) => rows.map((y) => y[k] ?? 0);
  return [["stocks", "bonds"], ["stocks", "bills"], ["bonds", "bills"]].map(([a, b]) => {
    const r = correlation(col(all, a), col(all, b)), recentR = correlation(col(late, a), col(late, b));
    return { a, b, r, recentR, words: togetherWords(r), recentWords: togetherWords(recentR), from: all[0]?.year ?? from, recent: late[0]?.year ?? recent };
  });
}

/**
 * compute(plan, { today }) -> {
 *   ready (holdings), amount, held: riskOf | null, target: riskOf, plan: { stdev, mean } (the Assumptions page), comparison: [riskOf for 100/0, 60/40, 40/60, 0/100],
 *   yearsToRetire, verdict, notes, longer? (with params.stretch: { rolling of the main mix over that many years, sharpe:
 *   { main, stocks, bonds }, together }; without it the output is what it was before, no key added)
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const { mix: t, source: targetSource } = targetMix(plan);
  const amount = h.total > 0 ? h.total : (plan.accounts ?? []).filter((a) => ["brokerage", "401k", "ira", "roth", "hsa", "529", "crypto"].includes(a.type)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const targetW = toHistoryWeights(t);
  // with no target chosen on Allocation, the comparison is with the Projection's stock share: say so, not "your target"
  const target = riskOf(targetW, amount, targetSource === "own" ? "Your target mix" : "Your plan's mix");
  const heldW = h.hasData && h.classifiedShare > 0 ? toHistoryWeights(Object.fromEntries(h.byClass.filter((c) => c.cls !== "unknown").map((c) => [c.cls, c.share]))) : null;
  const held = heldW ? riskOf(heldW, amount, "What you hold") : null;
  const a = plan.assumptions ?? {};
  const rt = plan.retirement ?? {};
  const s = Number(rt.stocksNow ?? 0.7);
  const planStdev = Math.sqrt(Math.pow(s * Number(a.stdevStocks ?? 0.15), 2) + Math.pow((1 - s) * Number(a.stdevBonds ?? 0.05), 2));   // no correlation term: a rough figure
  const comparison = [[1, 0], [0.8, 0.2], [0.6, 0.4], [0.4, 0.6], [0.2, 0.8], [0, 1]].map(([st, bo]) => riskOf({ stocks: st, bonds: bo, bills: 0 }, amount, `${Math.round(st * 100)} / ${Math.round(bo * 100)}`));
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const self = (plan.household?.people ?? []).find((p) => p.role === "self" && p.birthDate) ?? null;
  const yearsToRetire = self ? Math.max(0, Number(self.retirementAge ?? a.retirementAge ?? 65) - (year - Number(String(self.birthDate).slice(0, 4)))) : null;
  const main = held ?? target;
  const verdict = main.stdev > 0.14 ? "rough" : main.stdev > 0.08 ? "moderate" : "smooth";   // all-stock has moved about 19% a year since 1871, 60/40 about 12%, all-bond about 8%
  const notes = [];
  if (yearsToRetire !== null && yearsToRetire < 5 && main.weights.stocks > 0.7) notes.push(`Retirement is ${yearsToRetire} year${yearsToRetire === 1 ? "" : "s"} away and the mix is ${Math.round(main.weights.stocks * 100)}% stocks: a fall like ${main.drawdown.peakYear}-${main.drawdown.troughYear} right before it would be hard to wait out. The Stocks by age page shows the usual shape.`);
  if (!h.hasData) notes.push(`No holdings yet: the figures use ${targetSource === "own" ? "your target mix" : "your plan's mix (the stock share set on the Will the money last? page)"} and the balances of your investment accounts.`);
  const out = { ready: true, amount, held, target, plan: { stdev: planStdev, mean: s * Number(a.returnStocks ?? 0.07) + (1 - s) * Number(a.returnBonds ?? 0.04) }, comparison, yearsToRetire, verdict, main, notes, hasHoldings: h.hasData, targetSource };
  if (params.stretch !== undefined && params.stretch !== null) {
    const k = STRETCHES.includes(Number(params.stretch)) ? Number(params.stretch) : STRETCH_FIRST;
    out.longer = { rolling: rolling(main.weights, { years: k }), sharpe: { main: sharpe(main.weights), stocks: sharpe({ stocks: 1, bonds: 0, bills: 0 }), bonds: sharpe({ stocks: 0, bonds: 1, bills: 0 }) }, together: together() };
  }
  return out;
}
