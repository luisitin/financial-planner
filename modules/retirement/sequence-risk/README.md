# Order of returns  (`retirement/sequence-risk`)

**Status:** usable (phase 5)
**Purpose:** Why bad years early in retirement hurt most: the same years of returns in three orders, on your plan.

## Inputs
The projection inputs and the history table (through `withdrawal-strategy`'s `worstWindow`).

## Outputs
`startYear`, `average` (geometric stocks/bonds/inflation of the retirement years), `runs[]` (as it happened, worst years first, best years first: `success`, `failAge`, `endReal`, `lowestReal`), `steady` (the plan's own assumption).

## Formulas
The working years keep their real order; the retirement years are sorted by the stock return ascending (worst first) or descending (best first). Same set of years, same average, different order.

## Tests
`tests/retirement-pages.test.mjs`: three runs; best-first ends at least as high as the actual order, worst-first at most.
