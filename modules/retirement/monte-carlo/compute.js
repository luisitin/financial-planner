// modules/retirement/monte-carlo/compute.js -- PURE and heavy (runs on the PC when connected).
// The same projection thousands of times with returns drawn at random around the plan's
// assumptions (lognormal, the plan's means and swings), to say how often the money lasts.
import { project } from "../../../core/math/retirement.js";
import { mulberry32, normal, percentile } from "../../../core/math/montecarlo.js";
import { buildInputs } from "../projection/compute.js";

/** Yearly return sequences: lognormal draws with the given arithmetic mean and standard deviation, stocks and bonds drawn together with a mild correlation. */
export function drawSequences(n, years, { stocks, bonds, stdevStocks, stdevBonds, corr = 0.1, seed = 1 }) {
  const rand = mulberry32(seed);
  const muS = Math.log(1 + stocks) - 0.5 * Math.log(1 + (stdevStocks / (1 + stocks)) ** 2), sigS = Math.sqrt(Math.log(1 + (stdevStocks / (1 + stocks)) ** 2));
  const muB = Math.log(1 + bonds) - 0.5 * Math.log(1 + (stdevBonds / (1 + bonds)) ** 2), sigB = Math.sqrt(Math.log(1 + (stdevBonds / (1 + bonds)) ** 2));
  // Convert the requested correlation of simple returns to the correlation of their normal log draws.
  const spread = Math.sqrt(Math.expm1(sigS ** 2) * Math.expm1(sigB ** 2));
  const normalCorr = spread > 0 ? Math.log1p(corr * spread) / (sigS * sigB) : corr;
  const out = [];
  for (let p = 0; p < n; p++) {
    const seq = [];
    for (let y = 0; y < years; y++) {
      const z1 = normal(rand), z2 = normalCorr * z1 + Math.sqrt(1 - normalCorr * normalCorr) * normal(rand);
      seq.push({ stocks: stdevStocks === 0 ? stocks : Math.exp(muS + sigS * z1) - 1, bonds: stdevBonds === 0 ? bonds : Math.exp(muB + sigB * z2) - 1 });
    }
    out.push(seq);
  }
  return out;
}

/**
 * compute(plan, { today, paths = 2000, seed = 1, maxPaths }) -> {
 *   ready, paths, successRate, medianEndReal, failAges: { p10, p50 } (ages money ran out among failing paths),
 *   bands: [{ year, age, p10, p25, p50, p75, p90 }] real totals per year, byAge: [{ age, alive: share of paths still funded }],
 *   verdict: "strong" | "fair" | "weak", inputsSummary
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing };
  const want = Math.max(100, Number(params.paths ?? 2000));
  const paths = Math.min(want, Number(params.maxPaths ?? 20000));
  const years = b.inputs.endYear - b.inputs.startYear + 1;
  const seqs = drawSequences(paths, years, { stocks: b.inputs.returns.stocks, bonds: b.inputs.returns.bonds, stdevStocks: b.inputs.stdev.stocks, stdevBonds: b.inputs.stdev.bonds, seed: Number(params.seed ?? 1) });
  const perYear = Array.from({ length: years }, () => []);
  let successes = 0; const failAges = [];
  const alive = new Array(years).fill(0);
  for (const seq of seqs) {
    const r = project(b.inputs, { sequence: seq });
    if (r.success) successes++; else failAges.push(r.failAge);
    r.rows.forEach((row, i) => { perYear[i].push(row.totalReal); if (row.shortfall <= 0 && (i === 0 || r.failYear === null || row.year < r.failYear)) alive[i]++; });
  }
  const bands = perYear.map((vals, i) => { const s = [...vals].sort((x, y) => x - y); const row = { year: b.inputs.startYear + i, age: b.inputs.startYear + i - b.inputs.people[0].birthYear }; for (const p of [10, 25, 50, 75, 90]) row[`p${p}`] = percentile(s, p / 100); return row; });
  const successRate = successes / paths;
  const fa = [...failAges].sort((x, y) => x - y);
  return {
    ready: true, paths, successRate, medianEndReal: bands[bands.length - 1].p50,
    failAges: fa.length ? { p10: percentile(fa, 0.1), p50: percentile(fa, 0.5), count: fa.length } : null,
    bands, byAge: alive.map((n, i) => ({ age: bands[i].age, year: bands[i].year, funded: n / paths })),
    verdict: successRate >= 0.85 ? "strong" : successRate >= 0.7 ? "fair" : "weak",
    retireYear: b.inputs.retireYear, endYear: b.inputs.endYear, spendingYearly: b.inputs.spending.yearly, seed: Number(params.seed ?? 1),
  };
}
