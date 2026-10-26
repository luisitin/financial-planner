// modules/investments/risk/compute.js -- PURE. How rough the ride of your mix is: the ups and
// downs, the worst year and the deepest fall history has dealt a mix like yours since 1871, the
// odds of a losing year, and what those look like in your own dollars, next to the plan's
// own volatility assumption.
import { runMix, toHistoryWeights } from "../backtest/compute.js";
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

/**
 * compute(plan, { today }) -> {
 *   ready (holdings), amount, held: riskOf | null, target: riskOf, plan: { stdev, mean } (the Assumptions page), comparison: [riskOf for 100/0, 60/40, 40/60, 0/100],
 *   yearsToRetire, verdict, notes
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const t = targetMix(plan).mix;
  const amount = h.total > 0 ? h.total : (plan.accounts ?? []).filter((a) => ["brokerage", "401k", "ira", "roth", "hsa", "529", "crypto"].includes(a.type)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const targetW = toHistoryWeights(t);
  const target = riskOf(targetW, amount, "Your target mix");
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
  if (yearsToRetire !== null && yearsToRetire < 5 && main.weights.stocks > 0.7) notes.push(`Retirement is ${yearsToRetire} year${yearsToRetire === 1 ? "" : "s"} away and the mix is ${Math.round(main.weights.stocks * 100)}% stocks: a fall like ${main.drawdown.peakYear}-${main.drawdown.troughYear} right before it would be hard to wait out. The Glide path page shows the usual shape.`);
  if (!h.hasData) notes.push("No holdings yet: the figures use your target mix and the balances of your investment accounts.");
  return { ready: true, amount, held, target, plan: { stdev: planStdev, mean: s * Number(a.returnStocks ?? 0.07) + (1 - s) * Number(a.returnBonds ?? 0.04) }, comparison, yearsToRetire, verdict, main, notes, hasHoldings: h.hasData };
}
