# Fees  (`investments/fees`)

**Status:** usable (phase 7)
**Purpose:** What your funds and any advisor charge each year and what that costs over a lifetime.

## Inputs
Holdings (expense ratios from the fund table or typed), `investments.advisoryFee` (a fraction of the portfolio a year), `assumptions` and `retirement.stocksNow` (the blended return), the People page (years to the plan's end, years to retirement), the Contributions page (yearly contributions added until retirement).

## Outputs
`items[]` (fee a year per holding), `fundFees`, `advisoryYearly`, `feesYearly`, `weightedEr`, `allIn`, `years`, `withFees`, `withoutFees`, `lifetimeCost`, `withCheap`, `cheapSaves` (at 0.05%), `priciest[]`, `unknownCount`, `notes`.

## Formulas
`growWithFees(start, years, rate, fee, yearly, contribYears, growth)`: the balance grown at rate minus fee, contributions added at the end of each working year and growing with pay. The lifetime cost is the end value without fees less the end value with them, in the dollars of the end year.

## Edge cases
Holdings with no expense ratio on file are listed as unknown and left out of the average (individual stocks: enter 0). Loads, 12b-1 fees and spreads are not counted.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Fees as a share of expected return; fund alternatives by class.
