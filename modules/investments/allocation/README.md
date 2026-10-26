# Allocation  (`investments/allocation`)

**Status:** usable (phase 7)
**Purpose:** Your mix by asset class across every account against the mix you aim for, and how far each class has drifted.

## Inputs
Holdings (`investments/holdings`), `investments.target` (`{ us_stocks, intl_stocks, bonds, cash, real_estate, other }` fractions, or null = built from `retirement.stocksNow`: 60/40 US/international, the rest bonds), `investments.band` (0.05).

## Outputs
`rows[]` per class: actual and target fractions, drift, dollars held, dollars to move, `flagged` and why; `flaggedCount`, `worst`, `stockShareActual` / `stockShareTarget`, `unknownValue`, `coverage` (holdings against the Net worth balances), `byAccountClass[]`, `notes`. `targetMix(plan)` is shared with the Rebalance, Risk and Backtest pages.

## Formulas
The 5/25 rule: a class is flagged when its drift exceeds the band (5 points) or a quarter of its own target. Balanced and target-date funds count by their split. Unclassified holdings are left out of the percentages and named in a note.

## Edge cases
No holdings: the target form still works. Accounts without holdings are not in the mix; a note gives the coverage.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Sub-classes (small caps, emerging markets), regions, a donut chart if the designer wants one.
