# Backtest  (`investments/backtest`)

**Status:** usable (phase 7)
**Purpose:** Any stocks-and-bonds mix run through the years since 1871, side by side with another: growth, the worst years, the deepest fall.

## Inputs
`data/shiller.js` (1871-1927 from Robert Shiller's monthly data via `tools/extract-shiller.py`: S&P price plus dividends, a 10-year bond bought at January's yield and sold a year later, the January long yield as a stand-in for cash, CPI) and `modules/retirement/historical/data/returns.js` (Damodaran 1928-2025); page state: the two mixes (your target, what you hold, or presets 100/0 to 0/100), the start year, real or nominal.

## Outputs
`runMix(weights, { from, to, start, real })`: `values[]` (growth of 10,000), `cagr`, `stats`, `worstYear`, `bestYear`, `drawdown` (depth, peak, trough, recovery years), `bestTen`, `worstTen`, `lossShare`; `compute()` returns runs `a` and `b`, the mixes, presets, start years, notes. `HISTORY` and `toHistoryWeights` are shared with the Risk page.

## Formulas
Yearly rebalancing: the mix's return each year is the weighted sum of the classes' returns. Real returns divide by (1 + inflation). Ten-year stretches are compound rates over every ten consecutive years.

## Edge cases
Before 1928 the cash figure is approximate (a note). No fees, no taxes, one rebalance a year. The chart is log-scaled (a `log` option added to `modules/retirement/charts.js`).

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Withdrawals during the backtest (the retirement History page does that for the whole plan); more asset classes if a long series (Simba's sheet) is added.
