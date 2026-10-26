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
