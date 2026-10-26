// modules/retirement/sequence-risk/compute.js -- PURE. The same average return, in a different
// order, gives a very different retirement: bad years early, while you are withdrawing, do
// lasting damage. This page shows it on the household's own plan with three orderings of one
// real stretch of history plus the plan's own steady assumption.
import { project } from "../../../core/math/retirement.js";
import { buildInputs } from "../projection/compute.js";
import { RETURNS } from "../historical/data/returns.js";
import { worstWindow } from "../withdrawal-strategy/compute.js";

const geo = (seq, k) => Math.exp(seq.reduce((s, r) => s + Math.log(1 + r[k]), 0) / seq.length) - 1;
/**
 * compute(plan, { today }) -> { ready, startYear (of the historical stretch), average: { stocks, bonds },
 *   runs: [{ key, name, note, success, failAge, endReal, lowestReal }], steady: same for the plan's assumptions, firstDecade: text }
 * The three orderings share exactly the same yearly returns: as they happened, worst years first, best years first.
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing };
  const years = b.inputs.endYear - b.inputs.startYear + 1;
  if (years > RETURNS.length) return { ready: false, missing: ["the plan is longer than the history on file"] };
  const w = worstWindow(b.inputs);
  const seq = w.seq;
  // the retirement years are what matter: reorder only those, keep the working years as they were
  const retireIndex = Math.max(0, b.inputs.retireYear - b.inputs.startYear);
  const head = seq.slice(0, retireIndex), tail = seq.slice(retireIndex);
  const byStocks = (dir) => [...tail].sort((x, y) => dir * (x.stocks - y.stocks));
  const variants = [
    { key: "actual", name: `As it happened from ${w.startYear}`, note: "the real order of those years", seq },
    { key: "worst-first", name: "Worst years first", note: "the same years, the bad ones at the start of retirement", seq: [...head, ...byStocks(1)] },
    { key: "best-first", name: "Best years first", note: "the same years, the good ones at the start of retirement", seq: [...head, ...byStocks(-1)] },
  ];
  const run = (s) => { const r = project({ ...b.inputs, strategy: "fixed-real" }, s ? { sequence: s } : {}); return { success: r.success, failAge: r.failAge, endReal: r.endBalanceReal, lowestReal: Math.min(...r.rows.map((x) => x.totalReal)) }; };
  const runs = variants.map((v) => ({ key: v.key, name: v.name, note: v.note, ...run(v.seq) }));
  return {
    ready: true, startYear: w.startYear, years, average: { stocks: geo(tail, "stocks"), bonds: geo(tail, "bonds"), inflation: geo(tail, "inflation") },
    runs, steady: { name: "Steady, as assumed", note: `${Math.round(b.inputs.returns.stocks * 1000) / 10}% stocks, ${Math.round(b.inputs.returns.bonds * 1000) / 10}% bonds every year`, ...run(null) },
    retireYear: b.inputs.retireYear, spendingYearly: b.inputs.spending.yearly,
  };
}
