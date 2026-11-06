// tests/estimate-math.test.mjs -- core/math/estimate.js, every formula worked by hand (the rules R3-R11 of
// modules/overview/guesses/README.md "The statistics").
import { test } from "node:test";
import assert from "node:assert/strict";
import { interpLinear, interpLog, sigmaFromMeanMedian, middleHalf, combineLog, propagate, elasticity, logitCombine, hurdle, typoCheck, roundGuess } from "../core/math/estimate.js";

const near = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b}`);

test("interpLinear: straight lines between the points, flat outside the ends, any order in", () => {
  const pts = [[10, 100], [0, 0], [20, 400]];
  assert.equal(interpLinear(pts, 5), 50);                       // 0 + (100 - 0) x 5/10
  assert.equal(interpLinear(pts, 15), 250);                     // 100 + 300 x 5/10
  assert.equal(interpLinear(pts, -3), 0, "flat below the first point");
  assert.equal(interpLinear(pts, 99), 400, "flat above the last point");
  assert.equal(interpLinear(pts, 10), 100, "a point itself");
  assert.equal(interpLinear([], 5), null);
  assert.equal(interpLinear(pts, NaN), null);
});

test("interpLog (R3): log-log between bucket middles, flat outside the end buckets, no jump anywhere", () => {
  const pts = [[10, 100], [1000, 10000]];
  near(interpLog(pts, 100), 1000, 1e-6, "slope 1 on log-log: 10x the pay, 10x the figure");
  const sq = [[10, 100], [1000, 1000000]];                      // y = x^2
  near(interpLog(sq, 100), 10000, 1e-6, "log-log keeps a power law: 100^2");
  assert.equal(interpLog(pts, 5), 100, "flat below");
  assert.equal(interpLog(pts, 5000), 10000, "flat above");
  assert.equal(interpLog(pts, 0), 100, "x <= 0 reads the first bucket");
  assert.equal(interpLog([[0, 5], [10, 100], [1000, 0]], 50), 100, "points a log cannot take are left out");
  // a $1 change of pay at a bucket middle moves the figure by well under 0.1%
  const a = interpLog(pts, 100), b = interpLog(pts, 101);
  assert.ok(Math.abs(b / a - 1) < 0.011, "continuous: 1% more pay, about 1% more");
});

test("sigmaFromMeanMedian (R6): sqrt(2 ln(mean / median)); null when the mean is not above the median", () => {
  near(sigmaFromMeanMedian(100 * Math.exp(0.125), 100), 0.5, 1e-12, "mean = median e^(s^2/2) with s = 0.5");
  near(sigmaFromMeanMedian(167970, 44115), Math.sqrt(2 * Math.log(167970 / 44115)), 1e-12);
  assert.equal(sigmaFromMeanMedian(100, 100), null);
  assert.equal(sigmaFromMeanMedian(90, 100), null);
  assert.equal(sigmaFromMeanMedian(100, 0), null);
});

test("middleHalf: v e^(-/+0.674 s), the 25th and 75th percentiles of a log-normal guess", () => {
  const [lo, hi] = middleHalf(100, 1);
  near(lo, 100 * Math.exp(-0.674), 1e-12); near(hi, 100 * Math.exp(0.674), 1e-12);
  near(lo, 50.97, 0.01); near(hi, 196.2, 0.1);
  near(lo * hi, 100 * 100, 1e-9, "symmetric on the log scale");
});

test("combineLog (R4): weights 1/s^2 on the log scale; the result is tighter than either", () => {
  const c = combineLog({ value: 100, sigma: 0.5 }, { value: 400, sigma: 0.5 });
  near(c.value, 200, 1e-9, "equal spreads: the geometric mean, sqrt(100 x 400)");
  near(c.sigma, 1 / Math.sqrt(8), 1e-12, "(4 + 4)^-1/2");
  const d = combineLog({ value: 100, sigma: 0.2 }, { value: 400, sigma: 0.4 });   // weights 25 and 6.25
  near(d.value, Math.exp((Math.log(100) * 25 + Math.log(400) * 6.25) / 31.25), 1e-9);
  near(d.sigma, 1 / Math.sqrt(31.25), 1e-12);
  assert.deepEqual(combineLog({ value: 100, sigma: null }, { value: 400, sigma: 0.5 }), { value: 400, sigma: 0.5 }, "no spread: no weight");
  assert.deepEqual(combineLog({ value: 100, sigma: 0 }, { value: 400, sigma: 0.5 }), { value: 100, sigma: 0 }, "exact wins");
  assert.equal(combineLog(null, null), null);
});

test("propagate and elasticity (R6): sqrt(s_own^2 + sum (e_i s_i)^2); d ln f / d ln x by a central difference", () => {
  near(propagate(0.3, [{ elasticity: 2, sigma: 0.2 }]), 0.5, 1e-12, "sqrt(0.09 + 0.16)");
  near(propagate(null, [{ elasticity: 1, sigma: 0.3 }, { elasticity: 0.5, sigma: 0.8 }]), Math.sqrt(0.09 + 0.16), 1e-12);
  assert.equal(propagate(0.25, []), 0.25);
  near(elasticity((x) => x * x, 50), 2, 1e-9, "a square moves twice as fast in log terms");
  near(elasticity((x) => 3 * x, 7), 1, 1e-9);
  near(elasticity(() => 42, 7), 0, 1e-12, "a flat figure does not move");
  assert.equal(elasticity(() => 0, 7), null, "no log of zero");
});

test("logitCombine and hurdle (R5): one-way shares add on the log-odds scale; skip / ask / assume at 35% and 65%", () => {
  near(logitCombine(0.5, [0.8]), 0.8, 1e-9, "from an even base, one term is the term");
  near(logitCombine(0.5, [0.8, 0.8]), 1 / (1 + Math.exp(-2 * Math.log(4))), 1e-9, "two lifts of logit 1.386: 16/17");
  near(logitCombine(0.2, [0.2, 0.2]), 0.2, 1e-9, "terms equal to the base change nothing");
  near(logitCombine(0.3, [0.6, 0.1]), 1 / (1 + Math.exp(-(Math.log(0.3 / 0.7) + Math.log(0.6 / 0.4) - Math.log(0.3 / 0.7) + Math.log(0.1 / 0.9) - Math.log(0.3 / 0.7)))), 1e-9);
  assert.equal(logitCombine(NaN, [0.5]), null);
  assert.deepEqual([0.34, 0.35, 0.5, 0.65, 0.66].map(hurdle), ["skip", "ask", "ask", "ask", "assume"]);
});

// review of C1 (2026-11-06, data 6): R5 "with no published share at all: always ask". In JavaScript null < 0.35 is true, so a
// null state cell used to skip silently
test("hurdle with no share (null, undefined, NaN, a string, Infinity) always asks", () => {
  assert.deepEqual([null, undefined, NaN, "0.2", Infinity, -Infinity].map(hurdle), ["ask", "ask", "ask", "ask", "ask", "ask"]);
  assert.deepEqual([0, 1].map(hurdle), ["skip", "assume"], "the ends are shares");
});

test("typoCheck (R9): only far from the guess (|z| > 2.33) and only when a slip lands inside the middle half (|z| <= 0.674)", () => {
  const est = { value: 2000, sigma: 0.5 };
  const slips = [{ id: "year-as-month", map: (t) => t / 12, words: "Is that a year?" }, { id: "extra-zero", map: (t) => t / 10, words: (t, m) => `Did you mean ${m}?` }];
  // 20,000: |ln 10| / 0.5 = 4.6 > 2.33; /12 = 1,667, |ln(0.833)| / 0.5 = 0.36 <= 0.674 -> the year slip, tried first
  assert.deepEqual(typoCheck(20000, est, slips), { slip: "year-as-month", value: 20000 / 12, words: "Is that a year?" });
  // 2,500 is near: |ln 1.25| / 0.5 = 0.45, never a slip
  assert.equal(typoCheck(2500, est, slips), null);
  // 9,000: far (3.0), /12 = 750 (z 1.96: outside), /10 = 900 (z 1.6: outside) -> nothing said
  assert.equal(typoCheck(9000, est, slips), null);
  // 25,000 with only the extra-zero slip: 2,500 is inside -> said, words from the function
  assert.deepEqual(typoCheck(25000, est, [slips[1]]), { slip: "extra-zero", value: 2500, words: "Did you mean 2500?" });
  assert.equal(typoCheck(20000, { value: 2000, sigma: null }, slips), null, "no spread, no check");
  assert.equal(typoCheck(0, est, slips), null);
});

test("roundGuess (R11): flows to $10 / $50, balances to 3 or 2 significant figures, rates to 0.1 point, ages whole", () => {
  assert.equal(roundGuess(437, "month"), 440);
  assert.equal(roundGuess(994, "month"), 990);
  assert.equal(roundGuess(1234, "month"), 1250);
  assert.equal(roundGuess(1224, "year"), 1200);
  assert.equal(roundGuess(12345, "month", 0.6, true), 12000, "measured and wide: 2 significant figures");
  assert.equal(roundGuess(12345, "month", 0.6, false), 12350, "declared spreads do not coarsen it");
  assert.equal(roundGuess(123456, "total", 0.1), 123000);
  assert.equal(roundGuess(123456, "total", 0.3), 120000);
  assert.equal(roundGuess(123456, "total", null), 120000);
  assert.equal(roundGuess(0.2236, "rate"), 0.224);
  assert.equal(roundGuess(0.0652, "rate"), 0.065);
  assert.equal(roundGuess(0.046, "rate"), 0.046);
  assert.equal(roundGuess(64.6, "age"), 65);
  assert.equal(roundGuess(2011.4, "year-date"), 2011);
  assert.deepEqual(roundGuess(["a1"], "list"), ["a1"]);
  assert.equal(roundGuess(0, "total", 0.1), 0);
  assert.ok(Number.isNaN(roundGuess(NaN, "month")));
});
