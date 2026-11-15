// core/math/montecarlo.js -- seeded random draws and a generic yearly simulation.
// Pure. This is the kind of work modules mark `heavy: true` so the PC runs it with
// many more paths than a phone would.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Standard normal via Box-Muller from a uniform generator. */
export function normal(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
/** Standard error of a sample proportion (for example, the share of successful paths). */
export function binomialStandardError(p, n) {
  return Math.sqrt(p * (1 - p) / n);
}
/**
 * Simulate a balance over `years` with a random return each year.
 * { start, years, meanReturn, stdev, paths = 1000, seed = 1, flow(year, balance) -> net contribution (+) or withdrawal (-) for that year }
 * -> { successRate, byYear: [{ year, p10, p50, p90, mean }], final: { p10, p50, p90 } }
 */
export function simulate({ start, years, meanReturn, stdev, paths = 1000, seed = 1, flow = () => 0 }) {
  const rand = mulberry32(seed);
  const balances = Array.from({ length: years + 1 }, () => new Array(paths));
  let failures = 0;
  for (let p = 0; p < paths; p++) {
    let b = start; balances[0][p] = b; let failed = false;
    for (let y = 1; y <= years; y++) {
      const r = meanReturn + stdev * normal(rand);
      b = b * (1 + r) + flow(y, b);
      if (b < 0) { b = 0; failed = true; }
      balances[y][p] = b;
    }
    if (failed) failures++;
  }
  const byYear = balances.map((arr, year) => { const s = [...arr].sort((a, b) => a - b); return { year, p10: percentile(s, 0.1), p50: percentile(s, 0.5), p90: percentile(s, 0.9), mean: s.reduce((a, b) => a + b, 0) / s.length }; });
  const last = byYear[years];
  return { successRate: 1 - failures / paths, byYear, final: { p10: last.p10, p50: last.p50, p90: last.p90 }, paths, seed };
}

// ---------------------------------------------------------------- years picked at random, and a value that drifts (gap next-60 #35)
/** pickIndices(n, years, count, seed = 1) -> n paths of `years` whole numbers from 0 to count - 1, each floor(u x count) of a
 * fresh mulberry32(seed) draw u, path by path, year by year: the same seed gives the same picks. */
export function pickIndices(n, years, count, seed = 1) {
  const rand = mulberry32(seed);
  const out = [];
  for (let p = 0; p < n; p++) { const path = new Array(years); for (let y = 0; y < years; y++) path[y] = Math.min(count - 1, Math.floor(rand() * count)); out.push(path); }
  return out;
}
/** lag1(xs) -> the sample lag-1 autocorrelation sum((x_t - m)(x_(t+1) - m)) / sum((x_t - m)^2) (Box and Jenkins); 0 for fewer
 * than 2 values or no spread. */
export function lag1(xs) {
  const n = xs?.length ?? 0;
  if (n < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / n;
  let num = 0, den = 0;
  for (let t = 0; t < n; t++) { den += (xs[t] - m) ** 2; if (t + 1 < n) num += (xs[t] - m) * (xs[t + 1] - m); }
  return den > 0 ? num / den : 0;
}
/** ar1Paths(n, years, { mean, phi, sd, seed = 1 }) -> n paths of `years` values that drift around `mean`: x_0 = 0, then
 * x_t = phi x_(t-1) + sd sqrt(1 - phi^2) z_t (z standard normal from mulberry32(seed)), value = mean + x_t. Settled, the values
 * swing by `sd` (the AR(1) stationary variance sd_e^2 / (1 - phi^2)); a high value tends to be followed by another (phi > 0). */
export function ar1Paths(n, years, { mean, phi, sd, seed = 1 }) {
  const rand = mulberry32(seed);
  const f = Math.max(-0.999, Math.min(0.999, Number(phi) || 0)), e = Math.max(0, Number(sd) || 0) * Math.sqrt(1 - f * f);
  const out = [];
  for (let p = 0; p < n; p++) {
    const path = new Array(years);
    let x = 0;
    for (let y = 0; y < years; y++) { if (y > 0) x = f * x + e * normal(rand); path[y] = mean + x; }
    out.push(path);
  }
  return out;
}
