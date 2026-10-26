# Chance the money lasts  (`retirement/monte-carlo`)

**Status:** usable (phase 5); `heavy: true` (runs on the PC through `/api/compute/retirement/monte-carlo` when connected)
**Purpose:** The plan run thousands of times with returns drawn at random: the share of runs where the money lasts, and the range.

## Inputs
The projection inputs; `params.paths` (default 2,000; the server caps at `compute.maxPaths`), `params.seed`.

## Outputs
`successRate`, `medianEndReal`, `failAges` (p10, p50, count), `bands[]` per year (p10..p90 of real total), `byAge[]` (share still funded), `verdict` (strong >= 85%, fair >= 70%, weak).

## Formulas
`drawSequences`: lognormal yearly simple returns with the plan's arithmetic mean and standard deviation for stocks and bonds. For gross return `G = 1 + R`, set `v = ln(1 + (s / (1 + m))^2)`, `sigma = sqrt(v)`, and `mu = ln(1 + m) - v/2`; then `G = exp(mu + sigma Z)`. The requested `corr` (default 0.1) is the correlation of the sampled simple returns, not the hidden normal draws: the normal correlation is `ln(1 + corr * sqrt((exp(vStocks)-1)(exp(vBonds)-1))) / (sigmaStocks * sigmaBonds)`. With zero volatility, the draw returns the configured mean directly, so deterministic compounding is exact. This is the standard lognormal moment conversion (Aitchison and Brown, *The Lognormal Distribution*, 1957).

The 99.9% checks in `tests/montecarlo-stats.test.mjs` use the two-sided normal quantile 3.290526731 (NIST/SEMATECH e-Handbook, Normal Distribution) and the lognormal skewness `(exp(v)+2)*sqrt(exp(v)-1)` and excess kurtosis `exp(4v)+2exp(3v)+3exp(2v)-6` (Aitchison and Brown, 1957). The standard-error estimate for the sample standard deviation is `s*sqrt((excessKurtosis+2)/(4n))`, the large-sample variance formula for the sample variance followed by the square-root delta method. The correlation check uses Fisher's `atanh(r)`, whose standard error is `1/sqrt(n-3)` (Fisher, “On the probable error of a coefficient of correlation deduced from a small sample,” 1921).

The share of successful runs is a sample proportion `p`; its standard error is `sqrt(p(1-p)/n)` (NIST/SEMATECH e-Handbook, Binomial Distribution). `binomialStandardError(p, n)` in `core/math/montecarlo.js` returns this value. The convergence test compares independent fixed-seed estimates and uses the square root of the sum of their two variance estimates. In the worked statistical tests, all return assumptions and seeds are invented examples; 20,000 draws are used for the distribution checks as requested, and the success-rate comparison uses 5,000 and 20,000 paths.

## Tests
`tests/montecarlo-stats.test.mjs`: reproducible seeds, exact zero-volatility compounding, 99.9% mean and standard-deviation intervals, lognormal skew and kurtosis, joint return correlation, success-rate convergence, and the binomial standard-error helper. `tests/retirement-pages.test.mjs`: ordered bands and the server cap.

## Ideas / not yet
- Random inflation; fat tails (historical bootstrap); the chart's touch readout.
