// modules/retirement/monte-carlo/compute.js -- PURE and heavy (runs on the PC when connected).
// The same projection thousands of times with returns drawn at random around the plan's
// assumptions (lognormal, the plan's means and swings), to say how often the money lasts.
import { project, affordableSpending } from "../../../core/math/retirement.js";
import { mulberry32, normal, percentile } from "../../../core/math/montecarlo.js";
import { buildInputs } from "../projection/compute.js";

/** Yearly return sequences: lognormal draws with the given arithmetic mean and standard deviation, stocks and bonds drawn together with a mild correlation. */
export function drawSequences(n, years, { stocks, bonds, stdevStocks, stdevBonds, corr = 0.1, seed = 1 }) {
  return shapeSequences(drawShocks(n, years, seed), { stocks, bonds, stdevStocks, stdevBonds, corr });
}

/**
 * drawShocks(n, years, seed) -> n paths of `years` pairs [a, b] of standard normal draws: the luck of each pretend year, before
 * it is turned into returns. Drawn once, it can be shaped into the returns of several versions of a plan (shapeSequences), so
 * a copy with other expected returns meets the same good and bad years as the plan (Compare, stress test 2026-11-11, W7).
 * The draws come in the order drawSequences always used, so drawSequences(n, years, {..., seed}) is unchanged.
 */
export function drawShocks(n, years, seed = 1) {
  const rand = mulberry32(seed);
  const out = [];
  for (let p = 0; p < n; p++) {
    const path = [];
    for (let y = 0; y < years; y++) { const a = normal(rand); path.push([a, normal(rand)]); }
    out.push(path);
  }
  return out;
}

/** shapeSequences(shocks, { stocks, bonds, stdevStocks, stdevBonds, corr }) -> the yearly returns of each path (lognormal, as drawSequences). Paths longer than needed may be sliced first. */
export function shapeSequences(shocks, { stocks, bonds, stdevStocks, stdevBonds, corr = 0.1 }) {
  const muS = Math.log(1 + stocks) - 0.5 * Math.log(1 + (stdevStocks / (1 + stocks)) ** 2), sigS = Math.sqrt(Math.log(1 + (stdevStocks / (1 + stocks)) ** 2));
  const muB = Math.log(1 + bonds) - 0.5 * Math.log(1 + (stdevBonds / (1 + bonds)) ** 2), sigB = Math.sqrt(Math.log(1 + (stdevBonds / (1 + bonds)) ** 2));
  // Convert the requested correlation of simple returns to the correlation of their normal log draws.
  const spread = Math.sqrt(Math.expm1(sigS ** 2) * Math.expm1(sigB ** 2));
  const normalCorr = spread > 0 ? Math.log1p(corr * spread) / (sigS * sigB) : corr;
  const k = Math.sqrt(1 - normalCorr * normalCorr);
  return shocks.map((path) => path.map(([z1, n2]) => {
    const z2 = normalCorr * z1 + k * n2;
    return { stocks: stdevStocks === 0 ? stocks : Math.exp(muS + sigS * z1) - 1, bonds: stdevBonds === 0 ? bonds : Math.exp(muB + sigB * z2) - 1 };
  }));
}

/** The chance a careful spending figure is worked to: the money lasts in about 9 of 10 markets. */
export const CAREFUL_CHANCE = 0.9;
/** The first so many paths of the draw give a first guess at the careful figure (cheap: 300 paths, not 2,000). */
export const CAREFUL_PATHS = 300;
/** The draw the careful figure is settled on: the Chance page's own 2,000 paths (same seed), so a plan spending exactly the
 * careful figure lasts in at least 9 of 10 of the paths that page counts, never "9 of 10" next to 88% (round 5, 2026-11-02). */
export const CAREFUL_SETTLE_PATHS = 2000;

/**
 * spendingAtChance(inputs, { chance, seed, paths, coarse, sequences, legacy }) -> { yearly, chance, rate, planned, average, paths, runs }:
 * the most a year (today's dollars, whole $100s, the same every year after inflation: the "fixed-real" rule that
 * `affordableSpending` uses) that still lasts to the end, leaving at least `legacy`, in at least `chance` of the market paths
 * drawn around the plan's returns: the `paths` (2,000) of `drawSequences(paths, years, { seed })`, or `sequences` when given
 * (compute() passes its own draw). A first guess on the first `coarse` (300) paths, then settled on all of them.
 * `rate` is the share of paths that last at `yearly`; `planned` the share that last at the plan's own spending spent the same
 * way (steady, whatever rule the plan picked); `average` is affordableSpending's figure (every year earning exactly the
 * average return: about a 4 in 10 chance on the fixtures); `runs` how many times the projection ran.
 * Cost: a path that lasts at some spending lasts at any less, and one that falls short at some spending falls short at any
 * more, so each path remembers the most it lasted at and the least it fell short at, and only paths whose answer is not yet
 * known run again (about 4,000 runs in all on the fixtures, where a plain 300-path search alone took 4,200).
 */
export function spendingAtChance(inputs, options = {}) {
  const it = carefulSteps(inputs, options);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

/**
 * carefulSteps(inputs, options): the same search as spendingAtChance, as a generator that yields every few dozen runs of the
 * projection and returns the same answer, so a page working it out on a phone can do it a slice at a time between frames
 * (the screen stays live) instead of in one long block. Still pure: it never looks at the clock; the caller decides when to
 * ask for the next slice.
 */
export function* carefulSteps(inputs, { chance = CAREFUL_CHANCE, seed = 1, paths = CAREFUL_SETTLE_PATHS, coarse = CAREFUL_PATHS, sequences = null, legacy = 0, slice = 40 } = {}) {
  const average = affordableSpending(inputs);
  yield 0;
  const years = inputs.endYear - inputs.startYear + 1;
  const seqs = sequences ?? drawSequences(paths, years, { stocks: inputs.returns.stocks, bonds: inputs.returns.bonds, stdevStocks: inputs.stdev.stocks, stdevBonds: inputs.stdev.bonds, seed });
  yield 0;
  const N = seqs.length;
  const okAt = new Array(N).fill(-Infinity), shortAt = new Array(N).fill(Infinity);
  let runs = 0, next = slice;
  const lasts = (k, s) => {
    if (s <= okAt[k]) return true;
    if (s >= shortAt[k]) return false;
    runs++;
    const r = project({ ...inputs, strategy: "fixed-real", spending: { yearly: s } }, { sequence: seqs[k] });
    const ok = r.success && (legacy <= 0 || r.endBalanceReal >= legacy - 0.5);
    if (ok) okAt[k] = s; else shortAt[k] = s;
    return ok;
  };
  function* count(s, n = N) { let c = 0; for (let k = 0; k < n; k++) { if (lasts(k, s)) c++; if (runs >= next) { next = runs + slice; yield runs; } } return c; }
  function* enough(s, n = N) { return (yield* count(s, n)) >= Math.ceil(chance * n - 1e-9); }
  const down100 = (x) => Math.max(0, Math.floor(x / 100) * 100);
  // 1. a first guess on the first paths: halve the gap between a figure that lasts and one that does not, to $100
  const nC = Math.min(coarse, N);
  let lo = 0, hi = down100(Math.max(average, 1000) * 1.25) + 100;
  for (let k = 0; k < 8 && (yield* enough(hi, nC)); k++) { lo = hi; hi = down100(hi * 1.5); }
  while (hi - lo > 100) { const mid = down100((lo + hi) / 2); if (mid <= lo) break; if (yield* enough(mid, nC)) lo = mid; else hi = mid; }
  // 2. settle on every path: a figure a little above the guess that falls short, one below it that lasts, then halve the gap
  const margin = Math.max(1000, down100(lo * 0.04));
  hi = lo + margin;
  let found = null;
  for (let k = 0; k < 12 && (yield* enough(hi)); k++) { found = hi; hi += margin * 2 ** (k + 1); }
  if (found !== null) lo = found;
  else {
    lo = Math.max(0, hi - 2 * margin);
    for (let k = 0; k < 40 && lo > 0 && !(yield* enough(lo)); k++) { hi = lo; lo = Math.max(0, lo - margin * 2 ** (k + 2)); }
  }
  if (lo > 0 || (yield* enough(0))) while (hi - lo > 100) { const mid = down100((lo + hi) / 2); if (mid <= lo) break; if (yield* enough(mid)) lo = mid; else hi = mid; }
  else lo = 0;   // even spending nothing falls short in more than 1 of 10 paths
  const rate = (yield* count(lo)) / N, planned = (yield* count(inputs.spending?.yearly ?? 0)) / N;
  return { yearly: lo, chance, rate, planned, average, paths: N, runs };
}

/**
 * carefulSettled(plan, build, options): carefulSteps for a whole plan, settled (left2 fix round 1, 2026-11-12, M-1). The health
 * line is priced from the plan's spending (Medicare's income-related surcharge and the marketplace credit move with what is
 * drawn), so a plan that types the careful figure as its spending has slightly different health costs: on
 * qa/fixtures/retirement-plan.mjs at $110,100 the first search gives $97,800, and a plan spending $97,800 lasts in only 0.8985
 * of the paths. So when the plan's spending is a typed figure (`retirement.spendingMonthly`, not Get started's own figure and
 * not one typed over today's bills, which reads the bills: projection README), the plan is run again with the figure typed;
 * while that plan lasts in fewer than 9 of 10 paths, its own careful figure is taken and checked the same way (at most 4 more
 * searches): $97,700 (0.899), then $97,600 (0.9005). A figure that already lasts is kept, so a plan spending less than its
 * careful figure ($78,000 on the fixture: $96,900, 0.9085) gets the answer it always had. `planned` stays the share at the
 * plan's own spending; `rate` is the share a plan spending `yearly` lasts in. `build(plan)` -> projection inputs or null. A
 * plan whose spending is read from today's bills is searched once, as before. Same yields as carefulSteps.
 */
export function* carefulSettled(plan, build, options = {}) {
  const inputs = build(plan);
  if (!inputs) return null;
  const first = yield* carefulSteps(inputs, options);
  const rt = plan?.retirement ?? {};
  const typed = Number(rt.spendingMonthly) > 0 && plan?.guide?.setup?.retireAuto !== true && rt.spendingFrom !== "expenses";
  if (!typed || first.yearly <= 0) return first;
  const want = options.chance ?? CAREFUL_CHANCE;
  let cur = first, runs = first.runs;
  for (let k = 0; k < 5; k++) {
    const q = structuredClone(plan); q.retirement.spendingMonthly = cur.yearly / 12;
    const I = build(q);
    if (!I) break;
    const next = yield* carefulSteps(I, options);
    runs += next.runs;
    if (next.planned >= want - 1e-9 || next.yearly >= cur.yearly || k === 4) { cur = { ...cur, rate: next.planned }; break; }
    cur = next;
  }
  return { ...cur, planned: first.planned, average: first.average, runs };
}
/** settledAtChance(plan, build, options): carefulSettled run to the end. */
export function settledAtChance(plan, build, options = {}) {
  const it = carefulSettled(plan, build, options);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

/**
 * compute(plan, { today, paths = 2000, seed = 1, maxPaths, careful = true, legacy = 0 }) -> {
 *   ready, paths, successRate, medianEndReal, failAges: { p10, p50 } (ages money ran out among failing paths),
 *   bands: [{ year, age, p10, p25, p50, p75, p90 }] real totals per year, byAge: [{ age, alive: share of paths still funded }],
 *   verdict: "strong" | "fair" | "weak", inputsSummary,
 *   careful: spendingAtChance(...) for the plan (the spending that lasts in 9 of 10 markets, the share that lasts at the plan's
 *            spending spent steadily, and the average-market figure); null with careful: false (pages that do not show it)
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
    // settled on the seed's first 2,000 paths whatever `paths` asks for (the Chance page's own draw: one answer on every page);
    // `legacy` is what the money should still hold at the end (Goal seek's goal)
    // and settled on the plan spending it (carefulSettled, M-1)
    careful: params.careful === false ? null : settledAtChance(plan, (q) => (q === plan ? b.inputs : buildInputs(q, params).inputs ?? null), { seed: Number(params.seed ?? 1), legacy: Math.max(0, Number(params.legacy) || 0), sequences: paths >= CAREFUL_SETTLE_PATHS ? seqs.slice(0, CAREFUL_SETTLE_PATHS) : null }),
  };
}
