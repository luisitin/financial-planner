// modules/retirement/historical/compute.js -- PURE and heavy. The plan replayed through every
// stretch of real history since 1928 (Damodaran's yearly stock, bond, bill and inflation
// figures): if you had started this exact plan in 1929, in 1966, in 2000... how would it have
// gone? Only start years with enough history for the whole plan are used.
import { project, affordableSpending } from "../../../core/math/retirement.js";
import { buildInputs } from "../projection/compute.js";
import { RETURNS } from "./data/returns.js";

/** The plan's horizon replayed from every possible start year. */
export function replayAll(inputs, { fromRetirement = false } = {}) {
  const years = inputs.endYear - inputs.startYear + 1;
  const runs = [];
  for (let s = 0; s + years <= RETURNS.length; s++) {
    const slice = RETURNS.slice(s, s + years).map((r) => ({ stocks: r.stocks, bonds: r.bonds, cash: r.bills, inflation: r.inflation }));
    const r = project(inputs, { sequence: slice });
    runs.push({ startYear: RETURNS[s].year, success: r.success, failYear: r.failYear, failAge: r.failAge, endReal: r.endBalanceReal, minReal: Math.min(...r.rows.map((x) => x.totalReal)) });
  }
  return runs;
}
/**
 * compute(plan, { today, quick }) -> {
 *   ready, windows, years, successRate, worst: [{ startYear, failAge | endReal }] (5), best: [...] (3), medianEndReal,
 *   runs: [...all], safeSpending (real yearly spending that survived every start year; null when quick),
 *   dataRange: [first, last], note
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing };
  const years = b.inputs.endYear - b.inputs.startYear + 1;
  if (years > RETURNS.length) return { ready: false, missing: [`the plan runs ${years} years; history covers ${RETURNS.length}`] };
  const runs = replayAll(b.inputs);
  const successRate = runs.filter((r) => r.success).length / runs.length;
  const sorted = [...runs].sort((a, c) => (a.failAge ?? 999) - (c.failAge ?? 999) || a.endReal - c.endReal);
  const ends = runs.map((r) => r.endReal).sort((a, c) => a - c);
  let safeSpending = null;
  if (!params.quick) {
    // the spending every start year could carry: bisection over the worst starts (the ones that define the floor)
    const worstStarts = sorted.slice(0, 6).map((r) => r.startYear);
    safeSpending = Infinity;
    for (const sy of worstStarts) {
      const s = RETURNS.findIndex((r) => r.year === sy);
      const seq = RETURNS.slice(s, s + years).map((r) => ({ stocks: r.stocks, bonds: r.bonds, cash: r.bills, inflation: r.inflation }));
      safeSpending = Math.min(safeSpending, affordableSpending(b.inputs, { sequence: seq }, { steps: 24 }));
    }
  }
  return {
    ready: true, windows: runs.length, years, successRate, runs,
    worst: sorted.slice(0, 5), best: [...runs].sort((a, c) => c.endReal - a.endReal).slice(0, 3),
    medianEndReal: ends[Math.floor(ends.length / 2)], safeSpending, spendingYearly: b.inputs.spending.yearly,
    dataRange: [RETURNS[0].year, RETURNS[RETURNS.length - 1].year], retireYear: b.inputs.retireYear,
    verdict: successRate >= 0.9 ? "strong" : successRate >= 0.75 ? "fair" : "weak",
  };
}
