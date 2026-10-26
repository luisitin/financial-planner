# Financial independence  (`retirement/fire`)

**Status:** usable (phase 5)
**Purpose:** The pot that could pay for your life without a paycheck, how far you are, and the years to get there at your pace.

## Inputs
Spending (the retirement figure or today's expenses), invested money (taxable + deferred + free buckets), contributions, income and expenses (what is left over), `assumptions`, `retirement.withdrawalRate`, `retirement.stocksNow`.

## Outputs
`fiNumber`, `invested`, `progress`, `gap`, `savingYearly`, `savingsRate`, `realReturn`, `yearsToFi`, `fiAge`, `fiYear`, `coast` (number, reached), `retireAge`.

## Formulas
- FI number = yearly spending / withdrawal rate (4% -> 25x).
- Saving a year = contributions (own + employer) + max(0, left over each month x 12 - own contributions) so nothing is counted twice.
- Real return = the stock/bond blend at `stocksNow` deflated by inflation. Years to FI: grow the invested pot by the real return plus the yearly saving until it reaches the number (80-year cap).
- Coast number = FI number / (1 + real return)^(years to the retirement age).

## Tests
`tests/retirement-pages.test.mjs`.

## Ideas / not yet
- Barista variant (part-time income), the classic savings-rate-to-years table, a chart of the path.
