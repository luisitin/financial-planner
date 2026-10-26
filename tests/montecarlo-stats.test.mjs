// Statistical checks for the retirement return engine. Example assumptions and seeds
// below are invented test inputs, not market forecasts. Distribution formulas: Aitchison
// and Brown (1957); 99.9% two-sided z: NIST/SEMATECH e-Handbook, Normal Distribution.
import { test } from "node:test";
import assert from "node:assert/strict";
import { binomialStandardError, simulate } from "../core/math/montecarlo.js";
import { drawSequences } from "../modules/retirement/monte-carlo/compute.js";

const Z_999 = 3.290526731; // NIST/SEMATECH e-Handbook: two-sided 99.9% normal quantile.
const EXAMPLE = { stocks: 0.06, bonds: 0.03, stdevStocks: 0.18, stdevBonds: 0.06, corr: 0.35, seed: 47821 };

function sample(values) {
  const n = values.length;
  const mean = values.reduce((sum, x) => sum + x, 0) / n;
  const centered = values.map((x) => x - mean);
  const m2 = centered.reduce((sum, x) => sum + x ** 2, 0) / n;
  const m3 = centered.reduce((sum, x) => sum + x ** 3, 0) / n;
  const m4 = centered.reduce((sum, x) => sum + x ** 4, 0) / n;
  return {
    mean,
    sd: Math.sqrt(m2 * n / (n - 1)),
    skew: m3 / m2 ** 1.5,
    excessKurtosis: m4 / m2 ** 2 - 3,
  };
}

function lognormalMoments(mean, sd) {
  const v = Math.log1p((sd / (1 + mean)) ** 2);
  return {
    excessKurtosis: Math.exp(4 * v) + 2 * Math.exp(3 * v) + 3 * Math.exp(2 * v) - 6,
    skew: (Math.exp(v) + 2) * Math.sqrt(Math.expm1(v)),
  };
}

test("retirement return paths repeat for a seed and change for a different seed", () => {
  const a = drawSequences(20, 5, EXAMPLE);
  assert.deepEqual(drawSequences(20, 5, EXAMPLE), a);
  assert.notDeepEqual(drawSequences(20, 5, { ...EXAMPLE, seed: EXAMPLE.seed + 1 }), a);
});

test("zero volatility compounds exactly at the configured simple return", () => {
  const years = 10;
  const sequence = drawSequences(1, years, {
    stocks: EXAMPLE.stocks, bonds: EXAMPLE.bonds,
    stdevStocks: 0, stdevBonds: 0, seed: EXAMPLE.seed,
  })[0];
  let actual = 1000, expected = 1000; // Invented starting balance for a deterministic worked example.
  for (const row of sequence) {
    assert.equal(row.stocks, EXAMPLE.stocks);
    assert.equal(row.bonds, EXAMPLE.bonds);
    actual *= 1 + row.stocks;
    expected *= 1 + EXAMPLE.stocks;
  }
  assert.equal(actual, expected);
});

test("20,000 simple-return draws match lognormal 99.9% mean and standard-deviation intervals", () => {
  const n = 20000; // Requested sample size; assumptions are the invented EXAMPLE above.
  const draws = drawSequences(n, 1, EXAMPLE).map((path) => path[0].stocks);
  const observed = sample(draws);
  const mean = EXAMPLE.stocks, sd = EXAMPLE.stdevStocks;
  const { excessKurtosis } = lognormalMoments(mean, sd);
  const meanSe = sd / Math.sqrt(n);
  // Delta-method standard error for the sample SD, using the lognormal fourth moment.
  const sdSe = sd * Math.sqrt((excessKurtosis + 2) / (4 * n));
  assert.ok(Math.abs(observed.mean - mean) <= Z_999 * meanSe, `mean ${observed.mean} outside ${Z_999} SE of ${mean}`);
  assert.ok(Math.abs(observed.sd - sd) <= Z_999 * sdSe, `SD ${observed.sd} outside ${Z_999} SE of ${sd}`);
});

test("20,000 return draws have the skew and excess kurtosis of a lognormal distribution", () => {
  const n = 20000; // Requested sample size; assumptions are the invented EXAMPLE above.
  const draws = drawSequences(n, 1, EXAMPLE).map((path) => path[0].stocks);
  const observed = sample(draws);
  const expected = lognormalMoments(EXAMPLE.stocks, EXAMPLE.stdevStocks);
  // Near-normal large-sample standard errors; the example's log-space variance is small.
  assert.ok(Math.abs(observed.skew - expected.skew) < 5 * Math.sqrt(6 / n), `skew ${observed.skew} vs lognormal ${expected.skew}`);
  assert.ok(Math.abs(observed.excessKurtosis - expected.excessKurtosis) < 5 * Math.sqrt(24 / n), `excess kurtosis ${observed.excessKurtosis} vs lognormal ${expected.excessKurtosis}`);
});

test("20,000 paired stock and bond returns match their configured simple-return correlation", () => {
  const n = 20000; // Requested sample size; assumptions are the invented EXAMPLE above.
  const pairs = drawSequences(n, 1, EXAMPLE).map((path) => path[0]);
  const stocks = sample(pairs.map((x) => x.stocks));
  const bonds = sample(pairs.map((x) => x.bonds));
  const covariance = pairs.reduce((sum, pair) => sum + (pair.stocks - stocks.mean) * (pair.bonds - bonds.mean), 0) / (n - 1);
  const correlation = covariance / (stocks.sd * bonds.sd);
  // Fisher transform CI; source: Fisher (1921), probable error of a correlation coefficient.
  const observedZ = Math.atanh(correlation), configuredZ = Math.atanh(EXAMPLE.corr);
  assert.ok(Math.abs(observedZ - configuredZ) <= Z_999 / Math.sqrt(n - 3), `return correlation ${correlation} differs from configured ${EXAMPLE.corr}`);
});

test("success rate stabilizes as the number of paths grows", () => {
  // Invented one-year threshold example: only count paths able to cover a 900 withdrawal
  // from a starting balance of 1,000; fixed independent seeds make both estimates repeatable.
  const run = (paths, seed) => simulate({
    start: 1000, years: 1, meanReturn: 0, stdev: 0.5, paths, seed,
    flow: () => -900,
  }).successRate;
  const at5000 = run(5000, 19457), at20000 = run(20000, 19450);
  const differenceSe = Math.hypot(binomialStandardError(at5000, 5000), binomialStandardError(at20000, 20000));
  assert.ok(Math.abs(at5000 - at20000) <= differenceSe, `${at5000} vs ${at20000} (SE ${differenceSe})`);
});

test("binomial success-rate standard error is sqrt(p(1-p)/n)", () => {
  // Worked example: p=0.25 of 100 paths gives sqrt(0.25*0.75/100).
  assert.equal(binomialStandardError(0.25, 100), Math.sqrt(0.25 * 0.75 / 100));
  assert.equal(binomialStandardError(0, 100), 0);
  assert.equal(binomialStandardError(1, 100), 0);
});
