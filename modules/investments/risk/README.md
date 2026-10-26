# Risk  (`investments/risk`)

**Status:** usable (phase 7)
**Purpose:** How rough the ride of your mix is: the worst year and deepest fall history has dealt a mix like yours, in your own dollars.

## Inputs
Holdings (the mix held, collapsed to stocks/bonds/cash), the Allocation target, the history 1871-2025 (`investments/backtest`), the Assumptions page's volatility figures, the People page (years to retirement).

## Outputs
`main` (what you hold, or the target when there are no holdings): standard deviation, average, worst year and when, deepest fall (peak, trough, recovery), share of losing years, all also in dollars; `held`, `target`, `plan` (the assumed volatility), `comparison[]` (100/0 to 0/100), `verdict` (rough/moderate/smooth), `notes`.

## Formulas
`runMix` over 1871-2025 and 1970-2025, `seriesStats`, `maxDrawdown` (`core/math/returns.js`). A "bad year" is one standard deviation below zero. The plan's own volatility is the root of the summed squared stock and bond terms (no correlation term).

## Edge cases
International stocks, REITs and other assets are run as US stocks (the only series as long). Within five years of retirement and over 70% stocks a warning names the worst fall.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Rolling-period charts; a Monte Carlo fan for the portfolio alone (the retirement pages have one for the plan).
