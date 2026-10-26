# Year by year  (`retirement/cash-flow`)

**Status:** usable (phase 5)
**Purpose:** Every year of the plan in one table: ages, what comes in, what goes out, what is taken from where, what is left.

## Inputs
Everything the projection uses (through `retirement/projection` compute). `compute(plan, { today, real = true })`.

## Outputs
`rows[]` per year: `in` (contributions, income, lines), `out` (spending, taxes), `from` (cash, taxable, deferred, free), `rmd`, `end` buckets and total, `shortfall`; `totals`, `retireYear`, `people`, `verdict`, `shortYear`. Real (today's dollars) by default: nominal values divided by that year's price level.

## Tests
`tests/retirement-pages.test.mjs`: real vs nominal, totals.

## Ideas / not yet
- Export the table to CSV (Reports phase); columns for each income line.
