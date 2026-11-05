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

## No Social Security in the plan (2026-11-01)
When an adult has no Social Security figure and has not said they get none (`overview/setup` `ssMissingFor`, the same check as the
Dashboard's "Retirement: Needs Social Security"), the page opens with a notice from `modules/retirement/ss-notice.js`: "Social
Security is not counted yet, so this page looks worse than it is", a filled "Add Social Security" and an outlined "We won't get
Social Security", which saves the setup's own `guide.setup.ss[personId] = "none"` so it is never asked again. Before, only a
grey sentence at the end of a paragraph said why the plan looked short.

## Tests
`tests/montecarlo-stats.test.mjs`: reproducible seeds, exact zero-volatility compounding, 99.9% mean and standard-deviation intervals, lognormal skew and kurtosis, joint return correlation, success-rate convergence, and the binomial standard-error helper. `tests/retirement-pages.test.mjs`: ordered bands and the server cap.

## Ideas / not yet
- Random inflation; fat tails (historical bootstrap); the chart's touch readout.

## The careful spending figure (round 5, 2026-11-02)
`spendingAtChance(inputs, { chance = 0.9, seed = 1, legacy = 0 })` is the most a year (today's dollars, whole $100s, the same
every year after inflation, as `affordableSpending` does) that still lasts to the end, and leaves at least `legacy` (Goal
seek's goal), in at least 9 of 10 of the market paths drawn around the plan's returns. It returns it with `rate` (the share
that lasts at that figure), `planned` (the share that lasts at the plan's own spending spent the same way: steady spending,
whatever withdrawal rule the plan picked) and `average` (affordableSpending: every year earning exactly the average return).
- **The paths:** the seed's first 2,000 (`drawSequences(2000, years, { seed: 1 })`), the Chance page's own draw, whatever
  `paths` a page asks `compute()` for (it passes its own draw when it holds 2,000 or more). So the figure is the same on
  every page and between visits, and a plan that spends exactly the careful figure lasts in at least 9 of 10 of the paths
  the Chance page counts (review 2026-11-02: the figure was worked on 300 other paths, and $110,100 lasted in only 88% of
  these; it is $109,000 now). For a steady-spending plan `planned` is exactly the Chance page's `successRate`.
- **The search:** a first guess on the first 300 paths (halving the gap between a figure that lasts and one that does not,
  to $100), then settled on all 2,000: a figure a little above the guess (4%, at least $1,000) that falls short, one below
  that lasts, and the gap halved to $100. A path that lasts at some spending lasts at any less, and one that falls short at
  some spending falls short at any more, so each path keeps the most it lasted at and the least it fell short at, and only
  paths whose answer is not known yet run again: about 3,900 to 4,000 runs of the projection on the fixtures (`runs`),
  where the 300-path search alone took about 4,200. Tests check the answer against every path run in full.
- **A slice at a time:** `carefulSteps(inputs, options)` is the same search as a generator that yields every 40 runs and
  returns the same object; `modules/retirement/careful.js` drives it between frames on a phone (or asks the PC), so the page
  is drawn first and never freezes while it works (review 2026-11-02: the page was blocked for about a second).
- On the fixtures the average figure lasts in only about 4 of 10 markets (retirement fixture: $131,224 against $109,000;
  the family: $111,897 against $90,200). `compute()` carries the careful figure as `careful`; `careful: false` leaves it
  out (the Chance page itself and the reports, which do not show it). The projection's verdict and `affordable` are
  unchanged (frozen answer keys).
- **Zero:** when even spending nothing falls short in more than 1 path in 10, the figure is $0 and the pages show no
  careful line. That happens today for a partner's pay with little in savings: `core/math/retirement.js` takes the tax on
  income above spending from savings (`need = max(0, spending - income)`, with the tax on top). Paying that tax from the
  income instead changes seven frozen answer keys (roth-conversions-irmaa-010 to -100, `table.0.bracketTop`), so it waits
  for the owner.
