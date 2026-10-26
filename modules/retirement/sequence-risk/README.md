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

## Independent formula answer key

`tests/golden/retirement/sequence-risk.csv` adds 500 invented plans covering
tail-only sorting, geometric averages, actual/worst/best run summaries, steady
assumptions and readiness. Every group has 60 grid, 30 edge and 10 extreme rows.
Regenerate with `python tools/golden_retirement/sequence_risk.py`; replay with
`tests/golden-retirement.test.mjs`. The exact layout, quoted contracts and
sources are in `tests/golden/retirement/briefs/sequence-risk.md`.

The source observations are independently downloaded from
[Damodaran's NYU workbook](https://www.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls)
and frozen to six decimal places in
`tests/golden/retirement/sources/damodaran-1928-2025.csv`. Stock returns, bond
returns, bill returns and FRED CPI changes move together when a year is sorted.
The geometric average of n returns is `product(1+r)^(1/n)-1`. With no retirement
years it is undefined and the existing output is NaN. Real year-end money is
nominal money divided by the price level; the first year starts at price level 1.

Every tenth fixture has an independently asserted second calculation: log-space
means, source-year permutations and discounted liabilities for end/lowest
balances and failure timing. Some fixtures separate cash reserves from the
investment portfolio to check that bill returns travel with historical years.
All household figures and dates are invented; no production code or return file
is used to calculate expected outputs.
