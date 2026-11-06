// core/math/estimate.js -- PURE. The statistics behind "our guesses" (docs/CONVENTIONS.md "Guesses"; the build spec's
// rules R1-R11, written out with their sources in modules/overview/guesses/README.md). No tables live here: the sourced
// tables are in modules/overview/guesses/data/. Every function is small and tested in tests/estimate-math.test.mjs.
//
//   interpLinear(points, x)                   straight-line interpolation, flat outside the end points
//   interpLog(points, x)                      the same on log x and log y (R3: a $1 change never makes a guess jump)
//   sigmaFromMeanMedian(mean, median)         the log-scale spread of a log-normal cell from its mean and median (R6)
//   middleHalf(v, s)                          the middle half of a log-normal guess: v x e^(-/+0.674 s)
//   combineLog(a, b)                          two independent log-normal estimates combined by precision (R4)
//   propagate(sigmaOwn, parts)                the spread carried through a chain of guesses (R6)
//   elasticity(f, x, h)                       how much a guess moves, in log terms, per log change of one input
//   logitCombine(pAll, terms)                 one-way shares combined on the log-odds scale (R5)
//   hurdle(p)                                 whether something exists: "skip" | "ask" | "assume" (R5)
//   typoCheck(typed, est, slips)              a typed figure far from the guess that a common slip explains (R9)
//   roundGuess(value, unit, sigma, measured)  rounding by strength (R11)

const finite = (x) => typeof x === "number" && Number.isFinite(x);
const sorted = (points) => points.filter((p) => Array.isArray(p) && finite(p[0]) && finite(p[1])).sort((a, b) => a[0] - b[0]);

/** points: [[x, y]...] (any order); y at x on the straight lines between them, held flat outside the end points. */
export function interpLinear(points, x) {
  const p = sorted(points);
  if (!p.length || !finite(x)) return null;
  if (x <= p[0][0]) return p[0][1];
  if (x >= p[p.length - 1][0]) return p[p.length - 1][1];
  for (let i = 1; i < p.length; i++) {
    if (x <= p[i][0]) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i];
      return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return p[p.length - 1][1];
}

/**
 * The same on log x and log y (R3): buckets are interpolated between their middles on log scales and held flat outside
 * the end buckets. Points with x <= 0 or y <= 0 are left out (a log needs a positive number); x <= 0 reads the first.
 */
export function interpLog(points, x) {
  const p = sorted(points).filter(([a, b]) => a > 0 && b > 0);
  if (!p.length || !finite(x)) return null;
  if (x <= p[0][0]) return p[0][1];
  if (x >= p[p.length - 1][0]) return p[p.length - 1][1];       // the end bucket's own figure, exactly
  const y = interpLinear(p.map(([a, b]) => [Math.log(a), Math.log(b)]), Math.log(x));
  return y === null ? null : Math.exp(y);
}

/** sigma = sqrt(2 ln(mean/median)) for a log-normal cell; null when the mean is not above the median (R6). */
export const sigmaFromMeanMedian = (mean, median) => (finite(mean) && finite(median) && mean > median && median > 0 ? Math.sqrt(2 * Math.log(mean / median)) : null);

/** The middle half (25th to 75th percentile) of a log-normal guess v with log-scale spread s. */
export const middleHalf = (v, s) => [v * Math.exp(-0.674 * s), v * Math.exp(0.674 * s)];

/**
 * Two independent log-normal estimates of one thing, combined by precision (R4):
 * ln v = sum(ln v_i / s_i^2) / sum(1 / s_i^2), s = (sum 1 / s_i^2)^-1/2.
 * An estimate with no spread (null) carries no weight; one with spread 0 is exact and wins.
 */
export function combineLog(a, b) {
  const ok = (e) => e && finite(e.value) && e.value > 0;
  const has = (e) => ok(e) && finite(e.sigma) && e.sigma >= 0;
  if (!has(a) && !has(b)) return ok(a) ? { value: a.value, sigma: null } : ok(b) ? { value: b.value, sigma: null } : null;
  if (!has(a)) return { value: b.value, sigma: b.sigma };
  if (!has(b)) return { value: a.value, sigma: a.sigma };
  if (a.sigma === 0) return { value: a.value, sigma: 0 };
  if (b.sigma === 0) return { value: b.value, sigma: 0 };
  const wa = 1 / a.sigma ** 2, wb = 1 / b.sigma ** 2;
  return { value: Math.exp((Math.log(a.value) * wa + Math.log(b.value) * wb) / (wa + wb)), sigma: 1 / Math.sqrt(wa + wb) };
}

/** The spread carried through a chain (R6): sigma^2 = sigmaOwn^2 + sum (e_i sigma_i)^2. parts: [{ elasticity, sigma }]. */
export function propagate(sigmaOwn, parts = []) {
  let s2 = finite(sigmaOwn) ? sigmaOwn ** 2 : 0;
  for (const p of parts) if (finite(p?.elasticity) && finite(p?.sigma)) s2 += (p.elasticity * p.sigma) ** 2;
  return Math.sqrt(s2);
}

/** d ln f / d ln x, by a central difference: [ln f(x e^h) - ln f(x e^-h)] / 2h. null when f is not positive there. */
export function elasticity(f, x, h = 0.1) {
  const hi = f(x * Math.exp(h)), lo = f(x * Math.exp(-h));
  return finite(hi) && finite(lo) && hi > 0 && lo > 0 ? (Math.log(hi) - Math.log(lo)) / (2 * h) : null;
}

const logit = (p) => Math.log(p / (1 - p));
const clampP = (p) => Math.min(1 - 1e-9, Math.max(1e-9, p));
/**
 * One-way shares combined on the log-odds scale (R5): logit p = logit pAll + sum (logit p_i - logit pAll).
 * pAll and each term are shares (0..1); a term that is not a number is left out.
 */
export function logitCombine(pAll, terms = []) {
  if (!finite(pAll)) return null;
  const base = logit(clampP(pAll));
  let z = base;
  for (const t of terms) if (finite(t)) z += logit(clampP(t)) - base;
  return 1 / (1 + Math.exp(-z));
}

/**
 * The hurdle rule (R5): under 35% of people like this have it -> "skip"; over 65% -> "assume"; between -> "ask". No
 * published share (null, undefined, not a finite number) -> always "ask" (null < 0.35 is true in JavaScript).
 */
export const hurdle = (p) => (!finite(p) ? "ask" : p < 0.35 ? "skip" : p > 0.65 ? "assume" : "ask");

/**
 * The typo check (R9). It fires only when the typed figure is far from the guess, |ln(typed/guess)| / sigma > 2.33,
 * AND one of the common slips maps it inside the guess's middle half, |z| <= 0.674. est: { value, sigma }.
 * slips: [{ id, map: (typed) -> meant | null, words: string | (typed, meant) -> string }].
 * -> null | { slip, value (the figure the slip says was meant), words }
 */
export function typoCheck(typed, est, slips = []) {
  if (!finite(typed) || typed <= 0 || !est || !finite(est.value) || est.value <= 0 || !finite(est.sigma) || est.sigma <= 0) return null;
  if (Math.abs(Math.log(typed / est.value)) / est.sigma <= 2.33) return null;
  for (const s of slips) {
    const meant = typeof s?.map === "function" ? s.map(typed) : null;
    if (!finite(meant) || meant <= 0) continue;
    if (Math.abs(Math.log(meant / est.value)) / est.sigma <= 0.674) return { slip: s.id, value: meant, words: typeof s.words === "function" ? s.words(typed, meant) : s.words ?? "" };
  }
  return null;
}

const sig = (v, n) => (v === 0 ? 0 : Number(Number(v).toPrecision(n)));
/**
 * Rounding by strength (R11), so a guess never looks more exact than it is:
 *   month, year (flows): to $10 under $1,000, else to $50; when the spread is measured and above 0.5, 2 significant figures
 *   total (balances):    3 significant figures when sigma <= 0.15, else 2
 *   rate:                to 0.1 of a percentage point (0.001)
 *   age, year-date:      whole numbers
 * Anything else (a list) comes back unchanged.
 */
export function roundGuess(value, unit, sigma = null, measured = false) {
  if (!finite(value)) return value;
  switch (unit) {
    case "month": case "year":
      if (measured && finite(sigma) && sigma > 0.5) return sig(value, 2);
      return Math.abs(value) < 1000 ? Math.round(value / 10) * 10 : Math.round(value / 50) * 50;
    case "total": return sig(value, finite(sigma) && sigma <= 0.15 ? 3 : 2);
    case "rate": return Math.round(value * 1000) / 1000;
    case "age": case "year-date": return Math.round(value);
    default: return value;
  }
}
